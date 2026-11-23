"use client";

/**
 * Joy: the voice assistant, JoyTo's flagship feature.
 * Joy greets the person by name, talks about what is planned and suggests outings
 * ("Hello Marie! You have Tea and crosswords tomorrow at 5 pm. Would you like to join…").
 * Each suggestion is a card: a tap (or a "yes" to Joy) opens a confirmation sheet, and only a
 * second tap on the green button books anything.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useI18n } from "@/i18n";
import type { AssistantRequest, AssistantResponse } from "@/lib/ai/schema";
import { dayKey } from "@/lib/format";
import { joinProposal, joyMoodProposals, joySuggestions, proposalsFor, type JoyMood, type Proposal } from "@/lib/joy/proposals";
import { greeting, keywords, proposalCard, proposalLine } from "@/lib/joy/script";
import { eligibleActivities, rankActivities } from "@/lib/matching";
import { attendees, seatsLeft } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import type { Category, DayKey, User } from "@/lib/types";
import { Icon } from "../Icon";
import { JoyCheckIn } from "./JoyCheckIn";
import { JoyConversation } from "./JoyConversation";
import { JoyWave } from "./JoyWave";
import { ProposalSheet, type Confirmation } from "./ProposalSheet";
import { useJoyVoice, type JoyMessage, type JoyStatus } from "./useJoyVoice";

const normalize = (text: string) =>
  ` ${text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z' ]+/g, " ")} `;

const YES =
  / (yes|yeah|yep|ok|okay|sure|please|of course|why not|gladly|oui|ouais|d'accord|daccord|volontiers|avec plaisir|pourquoi pas|bien sur|carrement|go) /;
const NO = / (no|nope|not now|later|something else|another|next|non|pas maintenant|plus tard|autre chose|une autre|suivant) /;
const BYE = / (bye|goodbye|stop|that's all|au revoir|a bientot|arrete|c'est tout) /;

export function JoyScreen({ viewer, seniorId }: { viewer: User; seniorId?: string }) {
  const { state } = useStore();
  const { t, f, locale } = useI18n();
  const x = useMemo(() => ({ t, f, locale }), [t, f, locale]);

  const [extraIds, setExtraIds] = useState<string[] | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [showText, setShowText] = useState(false);
  const [intro, setIntro] = useState<JoyMessage | null>(null);
  const [mood, setMood] = useState<JoyMood | null>(null);
  const textInput = useRef<HTMLInputElement>(null);
  const checkInStart = useRef<HTMLButtonElement>(null);
  const search = useRef<AbortController | null>(null);

  useEffect(() => {
    if (showText && textInput.current?.getClientRects().length) textInput.current.focus();
  }, [showText]);

  useEffect(() => () => search.current?.abort(), []);

  const proposals: Proposal[] = useMemo(() => {
    const base = proposalsFor(state, viewer, seniorId);
    if (viewer.role !== "senior") return base;
    const eligible = new Set(eligibleActivities(state, viewer).map((a) => a.id));
    const extras = (extraIds ?? []).filter((id) => eligible.has(id)).map((id) => joinProposal(state, viewer, id));
    const checkIn = mood ? joyMoodProposals(state, viewer, mood) : [];
    return Array.from(new Map([...extras, ...checkIn, ...base].map((proposal) => [proposal.id, proposal])).values());
  }, [state, viewer, seniorId, extraIds, mood]);
  const suggestions = useMemo(() => joySuggestions(proposals), [proposals]);

  const proposalsRef = useRef(proposals);
  const opening = greeting(state, viewer, proposals, x);
  proposalsRef.current = proposals;
  const focusRef = useRef(focusId);
  focusRef.current = focusId;

  /* ---------- Understanding the person in demo mode (simple rules + the text AI for seniors) ---------- */

  const findMatch = useCallback(
    (said: string) => {
      const words = new Set(normalize(said).trim().split(/\s+/));
      let best: { p: Proposal; score: number } | null = null;
      for (const p of proposalsRef.current) {
        const score = keywords(p, state, x).filter((k) => words.has(k)).length;
        if (score && (!best || score > best.score)) best = { p, score };
      }
      return best?.p ?? null;
    },
    [state, x],
  );

  const askTextAssistant = useCallback(
    async (message: string): Promise<string | null> => {
      if (viewer.role !== "senior") return null;
      const candidates = eligibleActivities(state, viewer).map((a) => ({
        id: a.id,
        title: f.text(a.title),
        category: a.category,
        start: a.start,
        place: f.text(a.place),
        seatsLeft: seatsLeft(state, a),
        attendees: attendees(state, a.id).map((p) => ({ firstName: p.firstName, interests: p.interests })),
      }));
      const body: AssistantRequest = {
        locale,
        message,
        today: state.now,
        profile: { firstName: viewer.firstName, interests: viewer.interests, availability: viewer.availability, sector: viewer.sector },
        history: [],
        candidates,
      };
      search.current?.abort();
      const request = new AbortController();
      search.current = request;
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: request.signal,
        });
        if (!res.ok) return null;
        const out = (await res.json()) as AssistantResponse;
        if (request.signal.aborted) return null;
        const ids = out.suggestions.slice(0, 2).map((s) => s.activityId);
        setExtraIds(ids);
        setFocusId(ids.length ? `join:${ids[0]}` : null);
        return out.clarification ? `${out.reply} ${out.clarification}` : out.reply;
      } catch {
        return null;
      }
    },
    [viewer, state, f, locale],
  );

  const respond = useCallback(
    async (said: string): Promise<string | null> => {
      const n = normalize(said);
      const list = joySuggestions(proposalsRef.current);
      const match = findMatch(said);
      const focused = list.find((p) => p.id === focusRef.current) ?? null;
      if (YES.test(n) && !NO.test(n)) {
        const target = match ?? focused ?? list[0];
        if (!target) return t.joy.nothing;
        setFocusId(target.id);
        setSheetId(target.id);
        return t.joy.demo.confirmPrompt;
      }
      if (BYE.test(n)) {
        window.setTimeout(() => voice.stop(), 3500);
        return t.joy.demo.bye;
      }
      if (match) {
        setFocusId(match.id);
        return proposalLine(match, state, viewer, x);
      }
      if (NO.test(n)) {
        const index = focused ? list.indexOf(focused) : -1;
        const next = list[index + 1];
        if (!next) return t.joy.nothing;
        setFocusId(next.id);
        return `${t.joy.demo.next} ${proposalLine(next, state, viewer, x)}`;
      }
      return (await askTextAssistant(said)) ?? t.joy.demo.notUnderstood;
    },
    // `voice` is declared below; it is only used inside a timer, after it exists.
    [findMatch, askTextAssistant, state, viewer, x, t],
  );

  /* ---------- Tool calls from GPT Realtime ---------- */

  const onFind = useCallback(
    async (args: { category?: string; day?: string }) => {
      if (viewer.role !== "senior") return [];
      const ranked = rankActivities(
        state,
        viewer,
        {
          categories: args.category ? [args.category as Category] : [],
          days: args.day ? [args.day as DayKey] : [],
          moment: null,
          wantsCompanion: false,
          wantsGroup: true,
        },
        3,
      )
        .filter((r) => !args.day || dayKey(r.item.start) === args.day)
        .slice(0, 2);
      const ids = ranked.map((r) => r.item.id);
      setExtraIds(ids);
      return ids.map((id) => {
        const p = joinProposal(state, viewer, id);
        return { proposal_id: p.id, line: proposalLine(p, state, viewer, x) };
      });
    },
    [state, viewer, x],
  );

  const voice = useJoyVoice(locale, {
    respond,
    onShow: (id) => setFocusId(id),
    onOpen: (id) => {
      if (!proposalsRef.current.some((p) => p.id === id)) return;
      setFocusId(id);
      setSheetId(id);
    },
    onFind,
  });

  const context = useCallback(
    () => ({
      role: viewer.role,
      firstName: viewer.firstName,
      greeting: opening,
      proposals: proposals.map((p) => {
        const c = proposalCard(p, state, viewer, x);
        return { id: p.id, line: proposalLine(p, state, viewer, x), label: `${c.title}, ${c.subtitle}` };
      }),
    }),
    [state, viewer, proposals, x, opening],
  );

  const startVoice = useCallback(() => {
    if (!intro) {
      setIntro({ source: "joy", text: opening, time: Date.now() });
      setFocusId(suggestions[0]?.id ?? null);
    }
    voice.start(context(), !intro);
  }, [voice, context, suggestions, opening, intro]);

  function openWriting() {
    if (!intro) setIntro({ source: "joy", text: opening, time: Date.now() });
    setShowText(true);
  }

  function onConfirmed(c: Confirmation) {
    setSheetId(null);
    voice.notify(c.app, c.spoken);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || voice.status === "connecting" || voice.status === "thinking") return;
    setText("");
    void voice.sendText(clean);
  }

  function endConversation() {
    search.current?.abort();
    voice.stop();
    setIntro(null);
    setExtraIds(null);
    setFocusId(null);
    setShowText(false);
    setText("");
    window.requestAnimationFrame(() => {
      if (checkInStart.current?.getClientRects().length) checkInStart.current.focus();
    });
  }

  const statusLabel: Record<JoyStatus, string> = {
    off: t.joy.ready,
    connecting: t.joy.connecting,
    speaking: t.joy.speaking,
    listening: t.joy.listening,
    thinking: t.joy.demo.searching,
    waiting: voice.canListen ? t.joy.ready : t.joy.typePlaceholder,
    error: t.joy.error,
  };
  const voiceSession = voice.active && !voice.textOnly;
  const sheet = proposals.find((p) => p.id === sheetId) ?? null;
  const focusedSuggestion = suggestions.slice(2).find((proposal) => proposal.id === focusId);
  const visibleSuggestions = focusedSuggestion ? [suggestions[0], focusedSuggestion] : suggestions.slice(0, 2);
  const conversationSuggestions =
    extraIds === null ? visibleSuggestions : proposals.filter((p) => p.kind === "join" && extraIds.includes(p.activityId));
  const recording =
    voiceSession && (voice.mode === "realtime" ? voice.micOn && voice.status !== "connecting" : voice.status === "listening");
  const canSpeak =
    recording ||
    (voice.ready &&
      voice.status !== "thinking" &&
      voice.status !== "connecting" &&
      (!voiceSession || voice.mode === "realtime" || (voice.canListen && voice.status === "waiting")));

  function speakInConversation() {
    setShowText(false);
    if (!voiceSession) startVoice();
    else if (voice.mode === "realtime") voice.toggleMic();
    else if (recording) voice.stopListening();
    else voice.listen();
  }

  function selectProposal(proposal: Proposal) {
    setFocusId(proposal.id);
    setSheetId(proposal.id);
  }

  return (
    <div className="joy-page" data-conversation={Boolean(intro)}>
      <JoyCheckIn mood={mood} ready={voice.ready} startRef={checkInStart} onMood={setMood} onSpeak={startVoice} onWrite={openWriting} />
      {intro ? (
        <JoyConversation
          viewer={viewer}
          state={state}
          messages={voice.messages}
          intro={intro}
          liveReply={voice.liveReply}
          status={voice.status}
          error={voice.error}
          suggestions={conversationSuggestions}
          onSelect={selectProposal}
          onSpeak={speakInConversation}
          recording={recording}
          canSpeak={canSpeak}
          showText={showText}
          onWrite={() => setShowText(!showText)}
          text={text}
          onText={setText}
          onSubmit={onSubmit}
          onEnd={endConversation}
        />
      ) : null}
      <header className="joy-page-head">
        <button type="button" className="icon-btn joy-close mobile-ui" aria-label={t.joy.checkIn.back} onClick={endConversation}>
          <Icon name="close" />
        </button>
        <p className="hand">{t.joy.pageEyebrow}</p>
        <h1 className="desktop-ui">{t.joy.pageTitle}</h1>
        <h1 className="mobile-ui">
          <Icon name="sparkle" /> {t.joy.name}
        </h1>
        <p>{t.joy.pageLead}</p>
      </header>
      <section className="joy-stage" aria-label={t.joy.name}>
        <div className="joy-presence">
          <button
            type="button"
            className="joy-orb"
            data-status={voice.error ? "error" : voice.status}
            onClick={voiceSession ? (voice.status === "waiting" && voice.canListen ? voice.listen : undefined) : startVoice}
            aria-label={voiceSession ? statusLabel[voice.status] : t.joy.start}
            disabled={!voice.ready || (voiceSession && !(voice.status === "waiting" && voice.canListen))}
          >
            <JoyWave />
          </button>
          <p className="joy-status" role="status">
            {voice.error ? statusLabel.error : voice.active ? statusLabel[voice.status] : t.joy.idleStatus}
          </p>
        </div>
        <div className="joy-conversation">
          <p className="joy-conversation-label">
            <Icon name="sparkle" size={18} />
            {t.joy.name}
          </p>
          <p className="joy-caption" aria-live="polite">
            {voice.joyLine || opening}
          </p>
          {!voice.active ? <p className="joy-conversation-hint">{t.joy.conversationHint}</p> : null}
          {voice.userLine ? (
            <p className="joy-user">
              <strong>{t.joy.you} :</strong> {voice.userLine}
            </p>
          ) : null}
          {voice.error ? <p className="notice notice-warn small">{voice.error === "mic" ? t.joy.micDenied : t.joy.error}</p> : null}

          {!voiceSession ? (
            <button type="button" className="btn joy-start" onClick={startVoice} disabled={!voice.ready}>
              <Icon name="mic" /> {t.joy.start}
            </button>
          ) : (
            <div className="joy-controls">
              {voice.mode === "demo" && voice.canListen ? (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={recording ? voice.stopListening : voice.listen}
                  disabled={voice.status !== "listening" && voice.status !== "waiting"}
                >
                  <Icon name="mic" size={20} /> {recording ? t.joy.conversation.stopListening : t.joy.speak}
                </button>
              ) : null}
              {voice.mode === "realtime" ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={voice.toggleMic} aria-pressed={!voice.micOn}>
                  <Icon name="mic" size={20} /> {voice.micOn ? t.joy.mute : t.joy.unmute}
                </button>
              ) : null}
              <button type="button" className="btn btn-secondary btn-sm" onClick={endConversation}>
                <Icon name="close" size={20} /> {t.joy.end}
              </button>
            </div>
          )}

          <button
            type="button"
            className="link-btn joy-write"
            aria-expanded={showText}
            onClick={() => (showText ? setShowText(false) : openWriting())}
          >
            <Icon name="chat" size={18} /> {t.mobile.typeToJoy}
          </button>
          {showText ? (
            <form className="joy-type" onSubmit={onSubmit}>
              <label htmlFor="joy-text" className="sr-only">
                {t.joy.typePlaceholder}
              </label>
              <input
                id="joy-text"
                ref={textInput}
                disabled={voice.status === "connecting"}
                className="input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t.joy.typePlaceholder}
                autoComplete="off"
                maxLength={300}
              />
              <button
                type="submit"
                className="icon-btn"
                aria-label={t.joy.send}
                disabled={!text.trim() || voice.status === "connecting" || voice.status === "thinking"}
              >
                <Icon name="send" />
              </button>
            </form>
          ) : null}
        </div>
        <p className="joy-trust">
          <Icon name="shield" size={19} />
          {t.joy.confirmationHint}
        </p>
      </section>

      <section className="joy-suggestions" aria-labelledby="joy-proposals">
        <div className="joy-suggestions-head">
          <div className="stack-sm">
            <h2 id="joy-proposals">{t.joy.proposalsTitle}</h2>
            <p>{t.joy.proposalsHint}</p>
          </div>
          <span className="joy-suggestions-note">
            <Icon name="heart" size={18} />
            {t.joy.yourChoice}
          </span>
        </div>
        {visibleSuggestions.length ? (
          <div className="proposal-grid">
            {visibleSuggestions.map((p) => {
              const c = proposalCard(p, state, viewer, x);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`proposal${focusId === p.id ? " focused" : ""}`}
                  data-kind={p.kind}
                  onClick={() => selectProposal(p)}
                >
                  <span className="proposal-top">
                    <span className="cat-icon" aria-hidden="true">
                      <Icon name={c.icon} />
                    </span>
                    <span className="proposal-kind">{t.joy.proposalKinds[p.kind]}</span>
                  </span>
                  <span className="proposal-body">
                    <span className="proposal-title">{c.title}</span>
                    <span className="proposal-sub">{c.subtitle}</span>
                  </span>
                  <span className="proposal-footer">
                    <span className="proposal-action">{c.action}</span>
                    <Icon name="arrowRight" size={20} />
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="joy-empty">
            <Icon name="leaf" size={32} />
            <p>{t.joy.noProposals}</p>
            <p className="muted">{t.joy.emptyHint}</p>
          </div>
        )}
      </section>

      {sheet ? <ProposalSheet proposal={sheet} viewer={viewer} onClose={() => setSheetId(null)} onConfirmed={onConfirmed} /> : null}
    </div>
  );
}
