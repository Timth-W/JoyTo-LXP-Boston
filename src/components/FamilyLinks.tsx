"use client";

/**
 * Links between a senior and their relatives (son, daughter, grandchild…).
 * The senior shares an invite code; the relative enters it. Either side can remove the link.
 */
import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useI18n } from "@/i18n";
import { RELATION_IDS } from "@/lib/constants";
import { linksOfFamily, linksOfSenior, userById } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import type { FamilyLink, Relation, User } from "@/lib/types";
import { Icon } from "./Icon";
import { ConfirmAction } from "./MobileUI";
import { CopyButton, Person, useToast } from "./ui";

export function FamilyIllustration() {
  return (
    <div className="mobile-ui family-illustration">
      <Image src="/joyto-family.png" alt="" fill unoptimized />
    </div>
  );
}

function LinkRow({ link, other, viewer }: { link: FamilyLink; other: User; viewer: User }) {
  const { mutate } = useStore();
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const question = viewer.role === "senior" ? t.profile.removeConfirm(other.firstName) : t.family.unlinkConfirm(other.firstName);
  return (
    <li style={{ flexWrap: "wrap" }}>
      <div className="list-body">
        <Person user={other} subtitle={viewer.role === "senior" ? t.relations[link.relation] : t.roles.senior} />
      </div>
      {confirming ? (
        <div className="row">
          <span className="small strong">{question}</span>
          <button
            type="button"
            className="btn btn-danger-solid btn-sm"
            onClick={() => void mutate("unlink-family", { linkId: link.id, byUserId: viewer.id }).catch(() => undefined)}
          >
            {viewer.role === "senior" ? t.profile.removeLink : t.family.unlink}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>
            {t.common.cancel}
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirming(true)}>
          {viewer.role === "senior" ? t.profile.removeLink : t.family.unlink}
        </button>
      )}
    </li>
  );
}

/** Senior side: invite code + list of relatives. */
export function SeniorFamilyPanel({ senior }: { senior: User }) {
  const { state, mutate } = useStore();
  const { t } = useI18n();
  const links = linksOfSenior(state, senior.id);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmCode, setConfirmCode] = useState(false);
  const [shareError, setShareError] = useState(false);
  const [toast, showToast] = useToast();
  async function shareCode() {
    if (!senior.inviteCode) return;
    setShareError(false);
    const text = t.mobile.inviteMessage(senior.inviteCode);
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        showToast(t.mobile.copiedInvite);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setShareError(true);
    }
  }
  async function regenerateCode() {
    if (regenerating) return;
    setConfirmCode(false);
    setRegenerating(true);
    try {
      await mutate("regenerate-invite-code", { seniorId: senior.id });
    } catch {
      /* The shared backend notice explains failed requests. */
    } finally {
      setRegenerating(false);
    }
  }
  return (
    <section className="card profile-family-panel" aria-labelledby="family-title">
      <FamilyIllustration />
      <h2 id="family-title" className="row" style={{ fontSize: "1.25rem", gap: 10 }}>
        <Icon name="users" /> {t.mobile.familyHeading}
      </h2>
      <p className="muted">{t.mobile.familyPermissions}</p>
      <div className="profile-invitation">
        <span className="label">{t.profile.inviteCode}</span>
        <div className="code-box">
          <span className="code-value" data-testid="invite-code">
            {senior.inviteCode}
          </span>
          <div className="row">
            <CopyButton value={senior.inviteCode ?? ""} />
          </div>
        </div>
        <button type="button" className="btn btn-block" disabled={!senior.inviteCode} onClick={() => void shareCode()}>
          <Icon name="link" /> {t.mobile.shareInvite}
        </button>
        {shareError ? (
          <p className="error" role="alert">
            {t.mobile.inviteError}
          </p>
        ) : null}
        <button type="button" className="btn btn-ghost btn-sm" disabled={regenerating} onClick={() => setConfirmCode(true)}>
          <Icon name="refresh" size={18} /> {t.profile.regenerate}
        </button>
        <small className="help">{t.profileEditor.codeHelp}</small>
        <ol className="profile-invite-steps">
          {t.profileEditor.inviteSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
      <h3 className="profile-relatives-title">{t.profileEditor.linkedRelatives}</h3>
      {links.length ? (
        <ul className="list">
          {links.map((l) => {
            const other = userById(state, l.familyId);
            return other ? <LinkRow key={l.id} link={l} other={other} viewer={senior} /> : null;
          })}
        </ul>
      ) : (
        <div className="profile-family-empty">
          <Icon name="users" size={26} />
          <p>{t.profile.noFamily}</p>
        </div>
      )}
      {confirmCode ? (
        <ConfirmAction title={t.mobile.renewInvite} onCancel={() => setConfirmCode(false)} onConfirm={() => void regenerateCode()}>
          <p>{t.mobile.renewInviteHelp}</p>
        </ConfirmAction>
      ) : null}
      {toast}
    </section>
  );
}

/** Relative side: form to enter a code. */
export function ConnectForm({ family, onLinked }: { family: User; onLinked?: (seniorId: string) => void }) {
  const { mutate } = useStore();
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [relation, setRelation] = useState<Relation>("daughter");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return setError(t.auth.errors.code);
    try {
      const result = await mutate("link-by-code", { familyId: family.id, code, relation });
      if (typeof result === "string") return setError(result === "alreadyLinked" ? t.auth.errors.alreadyLinked : t.auth.errors.code);
      setError(null);
      setCode("");
      onLinked?.(result.seniorId);
    } catch {
      // The shared backend notice explains the failed request.
    }
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="fields-2">
        <div className="field">
          <label htmlFor="cn-code">{t.auth.inviteCode}</label>
          <input
            id="cn-code"
            className="input"
            placeholder="JOY-0000"
            autoCapitalize="characters"
            value={code}
            aria-invalid={Boolean(error)}
            aria-describedby="cn-code-help"
            onChange={(e) => {
              setCode(e.target.value);
              setError(null);
            }}
          />
          {error ? (
            <span className="error" id="cn-code-help" role="alert">
              {error}
            </span>
          ) : (
            <small id="cn-code-help">{t.family.connectLead}</small>
          )}
        </div>
        <div className="field">
          <label htmlFor="cn-relation">{t.auth.relation}</label>
          <select id="cn-relation" className="input" value={relation} onChange={(e) => setRelation(e.target.value as Relation)}>
            {RELATION_IDS.map((r) => (
              <option key={r} value={r}>
                {t.relations[r]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="row">
        <button type="submit" className="btn btn-block-mobile">
          <Icon name="link" /> {t.family.connect}
        </button>
      </div>
    </form>
  );
}

/** Relative side: list of linked seniors and the connect form. */
export function FamilySeniorsPanel({ family }: { family: User }) {
  const { state } = useStore();
  const { t } = useI18n();
  const links = linksOfFamily(state, family.id);
  return (
    <>
      <section className="card" aria-labelledby="linked-title">
        <FamilyIllustration />
        <h2 id="linked-title" className="row" style={{ fontSize: "1.25rem", gap: 10 }}>
          <Icon name="users" /> {t.family.linkedSeniors}
        </h2>
        {links.length ? (
          <ul className="list">
            {links.map((l) => {
              const other = userById(state, l.seniorId);
              return other ? <LinkRow key={l.id} link={l} other={other} viewer={family} /> : null;
            })}
          </ul>
        ) : (
          <p className="muted">{t.family.noLinked}</p>
        )}
      </section>
      <section className="card" aria-labelledby="connect-title">
        <h2 id="connect-title" style={{ fontSize: "1.25rem" }}>
          {t.family.connectTitle}
        </h2>
        <p className="muted">{t.family.connectLead}</p>
        <ConnectForm family={family} />
        <Link href="/family" className="link-btn">
          {t.nav.home} <Icon name="chevronRight" size={18} />
        </Link>
      </section>
    </>
  );
}
