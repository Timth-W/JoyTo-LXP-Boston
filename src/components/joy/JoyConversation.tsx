"use client";

import Image from "next/image";
import { useEffect, useRef, type FormEvent } from "react";
import { useI18n } from "@/i18n";
import { activityById, attendees } from "@/lib/selectors";
import type { State, User } from "@/lib/types";
import type { Proposal } from "@/lib/joy/proposals";
import { proposalCard } from "@/lib/joy/script";
import { CATEGORY_ICON, Icon } from "../Icon";
import { LogoMark } from "../Logo";
import { DateBadge } from "../MobileUI";
import { Avatar, Badge } from "../ui";
import { JoyWave } from "./JoyWave";
import type { JoyMessage, JoyStatus } from "./useJoyVoice";

export function JoyConversation({
  viewer,
  state,
  messages,
  intro,
  liveReply,
  status,
  error,
  suggestions,
  onSelect,
  onSpeak,
  recording,
  canSpeak,
  showText,
  onWrite,
  text,
  onText,
  onSubmit,
  onEnd,
}: {
  viewer: User;
  state: State;
  messages: JoyMessage[];
  intro: JoyMessage;
  liveReply: string;
  status: JoyStatus;
  error: "start" | "mic" | null;
  suggestions: Proposal[];
  onSelect: (proposal: Proposal) => void;
  onSpeak: () => void;
  recording: boolean;
  canSpeak: boolean;
  showText: boolean;
  onWrite: () => void;
  text: string;
  onText: (text: string) => void;
  onSubmit: (event: FormEvent) => void;
  onEnd: () => void;
}) {
  const { t, f, locale } = useI18n();
  const copy = t.joy.conversation;
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef<HTMLLIElement>(null);
  const busy = status === "connecting" || status === "thinking";
  const lastMessage = messages.at(-1);
  const thread = messages[0]?.source === "joy" ? messages : [intro, ...messages];
  const statusLabel =
    status === "listening"
      ? copy.listening
      : status === "speaking"
        ? copy.speaking
        : status === "connecting"
          ? t.joy.connecting
          : status === "thinking"
            ? t.joy.demo.searching
            : copy.ready;
  const clock = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });

  useEffect(() => {
    if (showText && input.current?.getClientRects().length) input.current.focus();
  }, [showText]);

  useEffect(() => {
    const row = latest.current;
    if (lastMessage && messages.length > 1 && row?.getClientRects().length) row.scrollIntoView({ block: "nearest" });
  }, [lastMessage, messages.length]);

  return (
    <section className="joy-chat" aria-labelledby="joy-chat-title">
      <header className="joy-chat-hero">
        <div className="joy-chat-heading">
          <h1 id="joy-chat-title">{copy.title}</h1>
          <p>{copy.lead}</p>
        </div>
        <button type="button" className="btn btn-secondary joy-chat-end" onClick={onEnd}>
          <Icon name="close" size={18} /> {t.joy.end}
        </button>
        <div className="joy-chat-presence" role="status">
          <span className="joy-orb" data-status={status} aria-hidden="true">
            <JoyWave />
          </span>
          <span>{statusLabel}</span>
        </div>
        <Image className="joy-chat-art" src="/joyto-companion-home.webp" width={768} height={518} sizes="180px" alt="" />
      </header>

      <ol className="joy-chat-thread" aria-live="polite" aria-relevant="additions">
        {thread.map((message, index) => (
          <li key={index} className="joy-chat-message" data-source={message.source} ref={index === thread.length - 1 ? latest : null}>
            {message.source === "joy" ? (
              <span className="joy-chat-logo">
                <LogoMark size={23} />
              </span>
            ) : (
              <Avatar user={viewer} size={36} />
            )}
            <div className="joy-chat-bubble">
              {message.source === "joy" ? (
                <strong>
                  {t.joy.name} <Icon name="sparkle" size={16} />
                </strong>
              ) : null}
              {message.source === "voice" ? (
                <div className="joy-chat-voice" aria-label={copy.voiceMessage} role="img">
                  <Icon name="mic" size={21} />
                  <JoyWave />
                </div>
              ) : null}
              <p>{message.text}</p>
              <time dateTime={new Date(message.time).toISOString()}>{clock.format(message.time)}</time>
            </div>
          </li>
        ))}
        {liveReply ? (
          <li className="joy-chat-message" data-source="joy" aria-live="off">
            <span className="joy-chat-logo">
              <LogoMark size={23} />
            </span>
            <div className="joy-chat-bubble">
              <strong>
                {t.joy.name} <Icon name="sparkle" size={16} />
              </strong>
              <p>{liveReply}</p>
            </div>
          </li>
        ) : null}
      </ol>
      {error ? (
        <p className="notice notice-warn small" role="status">
          {error === "mic" ? t.joy.micDenied : t.joy.error}
        </p>
      ) : null}

      {suggestions.length ? (
        <section className="joy-chat-suggestions" aria-labelledby="joy-chat-suggestions-title">
          <h2 id="joy-chat-suggestions-title">
            <Icon name="sparkle" size={20} />
            {t.joy.proposalsTitle}
          </h2>
          {suggestions.map((proposal) => {
            const card = proposalCard(proposal, state, viewer, { t, f, locale });
            const activity =
              proposal.kind === "join" || (proposal.kind === "upcoming" && !proposal.missionId)
                ? activityById(state, proposal.activityId)
                : undefined;
            const people = activity ? attendees(state, activity.id) : [];
            return (
              <button type="button" key={proposal.id} className="joy-chat-card" onClick={() => onSelect(proposal)}>
                {activity ? (
                  <DateBadge date={activity.start} />
                ) : (
                  <span className="cat-icon">
                    <Icon name={card.icon} />
                  </span>
                )}
                <span className="joy-chat-card-copy">
                  <span className="joy-chat-category">
                    {activity ? <Icon name={CATEGORY_ICON[activity.category]} size={17} /> : null}
                    {activity ? t.categories[activity.category] : t.joy.proposalKinds[proposal.kind]}
                  </span>
                  <strong>{card.title}</strong>
                  {activity ? (
                    <>
                      <span>
                        <Icon name="clock" size={16} /> {f.date(activity.start)}
                      </span>
                      <span>
                        <Icon name="pin" size={16} /> {f.text(activity.place)}
                      </span>
                    </>
                  ) : (
                    <span>{card.subtitle}</span>
                  )}
                  {people.length ? (
                    <span className="joy-chat-participants">
                      <span className="avatar-stack" aria-hidden="true">
                        {people.slice(0, 3).map((person) => (
                          <Avatar size={26} key={person.id} user={{ ...person, lastName: "" }} />
                        ))}
                      </span>
                      <Badge tone="ok">{t.activityDetail.participantCount(people.length)}</Badge>
                    </span>
                  ) : null}
                </span>
                <span className="joy-chat-arrow">
                  <Icon name="arrowRight" size={21} />
                </span>
              </button>
            );
          })}
        </section>
      ) : null}

      <div className="joy-chat-dock">
        {showText ? (
          <form id="joy-chat-composer" className="joy-chat-form" onSubmit={onSubmit}>
            <label htmlFor="joy-chat-text" className="sr-only">
              {copy.placeholder}
            </label>
            <input
              id="joy-chat-text"
              ref={input}
              className="input"
              value={text}
              onChange={(event) => onText(event.target.value)}
              placeholder={copy.placeholder}
              autoComplete="off"
              maxLength={300}
            />
            <button type="submit" className="btn" aria-label={t.joy.send} disabled={!text.trim() || busy}>
              <Icon name="send" size={21} />
            </button>
          </form>
        ) : null}
        <div className="joy-chat-actions">
          <button type="button" className="btn" onClick={onSpeak} disabled={!canSpeak}>
            <Icon name="mic" size={21} />
            {recording ? copy.stopListening : t.joy.speak}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onWrite}
            aria-expanded={showText}
            aria-controls={showText ? "joy-chat-composer" : undefined}
          >
            <Icon name="keyboard" size={20} />
            {copy.write}
          </button>
        </div>
      </div>
    </section>
  );
}
