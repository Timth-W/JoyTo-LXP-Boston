"use client";

import { useRef, useState, type FormEvent } from "react";
import { useI18n } from "@/i18n";
import { useStore } from "@/lib/store";
import type { Category, SectorId, Slot, User } from "@/lib/types";
import { InterestPicker, SectorPicker, SlotPicker } from "./ProfileFields";
import { LanguageSwitch } from "./LanguageSwitch";
import { Icon } from "./Icon";
import { Avatar, useToast } from "./ui";

/** Profile editor shared by the three roles; it only shows what makes sense for each role. */
export function ProfileForm({ user, section }: { user: User; section?: "information" | "interests" | "availability" }) {
  const { mutate } = useStore();
  const { t, f } = useI18n();
  const [toast, showToast] = useToast();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [bioDraft, setBio] = useState<string | null>(null);
  const bio = bioDraft ?? f.text(user.bio);
  const aboutChanged =
    firstName.trim() !== user.firstName || lastName.trim() !== user.lastName || (bioDraft !== null && bio.trim() !== f.text(user.bio));
  const [sector, setSector] = useState<SectorId>(user.sector);
  const [interests, setInterests] = useState<Category[]>(user.interests);
  const [availability, setAvailability] = useState<Slot[]>(user.availability);
  const [areas, setAreas] = useState<SectorId[]>(user.companion?.sectors ?? []);
  const [error, setError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<"first" | "last" | null>(null);
  const [saving, setSaving] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);
  const lastRef = useRef<HTMLInputElement>(null);
  const showAbout = !section || section === "information";
  const showInterests = !section || section === "interests";
  const showAvailability = !section || section === "availability";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (showAbout && !firstName.trim()) {
      setError(t.auth.errors.firstName);
      setInvalidField("first");
      firstRef.current?.focus();
      return;
    }
    if (showAbout && !lastName.trim()) {
      setError(t.auth.errors.lastName);
      setInvalidField("last");
      lastRef.current?.focus();
      return;
    }
    setError(null);
    setInvalidField(null);
    setSaving(true);
    try {
      await mutate("update-profile", {
        userId: user.id,
        patch: {
          ...(showAbout ? { firstName: firstName.trim(), lastName: lastName.trim() } : {}),
          ...(showAbout && bioDraft !== null ? { bio: bio.trim() } : {}),
          ...(user.role !== "family" && showAbout ? { sector } : {}),
          ...(user.role !== "family" && showInterests ? { interests } : {}),
          ...(user.role !== "family" && showAvailability ? { availability } : {}),
          ...(user.role === "companion" && showAbout ? { companionSectors: areas.length ? areas : [sector] } : {}),
        },
      });
      showToast(t.profile.saved);
    } catch {
      // The shared backend notice explains the failed request.
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="profile-editor" onSubmit={submit} noValidate aria-busy={saving}>
      {showAbout ? (
        <section className="card profile-section" aria-labelledby="profile-about-title">
          <div className="profile-section-head">
            <span className="profile-section-icon">
              <Icon name="user" />
            </span>
            <div>
              <h2 id="profile-about-title">{t.profileEditor.aboutTitle}</h2>
              <p>{t.profileEditor.aboutHelp}</p>
            </div>
          </div>
          <div className="profile-identity">
            <Avatar user={{ id: user.id, firstName, lastName }} size={64} />
            <div className="min-0">
              <strong className="profile-display-name">
                {firstName} {lastName}
              </strong>
              <p className="muted small" style={{ overflowWrap: "anywhere" }}>
                {t.roles[user.role]} · {user.email}
              </p>
            </div>
          </div>
          {error ? (
            <p className="error" role="alert" id="profile-name-error">
              {error}
            </p>
          ) : null}
          <div className="fields-2">
            <div className="field">
              <label htmlFor="pf-first">{t.auth.firstName}</label>
              <input
                id="pf-first"
                ref={firstRef}
                className="input"
                value={firstName}
                autoComplete="given-name"
                aria-invalid={invalidField === "first"}
                aria-describedby={invalidField === "first" ? "profile-name-error" : undefined}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  setError(null);
                  setInvalidField(null);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="pf-last">{t.auth.lastName}</label>
              <input
                id="pf-last"
                ref={lastRef}
                className="input"
                value={lastName}
                autoComplete="family-name"
                aria-invalid={invalidField === "last"}
                aria-describedby={invalidField === "last" ? "profile-name-error" : undefined}
                onChange={(e) => {
                  setLastName(e.target.value);
                  setError(null);
                  setInvalidField(null);
                }}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="pf-bio">{t.profile.bio}</label>
            <textarea
              id="pf-bio"
              className="input"
              value={bio}
              maxLength={280}
              onChange={(e) => setBio(e.target.value)}
              aria-describedby="profile-bio-help"
            />
            <div className="profile-bio-help">
              <small id="profile-bio-help">{t.profileEditor.bioHelp}</small>
              <span>{t.profileEditor.characters(bio.length)}</span>
            </div>
          </div>
          {section === "information" && user.role !== "family" ? (
            <SectorPicker legend={t.profile.sector} value={sector} onChange={setSector} />
          ) : null}
          {section === "information" && user.role === "companion" ? (
            <SectorPicker multiple legend={t.companion.profileAreas} value={areas} onChange={setAreas} />
          ) : null}
          {!section && aboutChanged ? (
            <button type="submit" className="btn profile-save-nearby" disabled={saving}>
              <Icon name="check" /> {saving ? t.profileEditor.saving : t.common.save}
            </button>
          ) : null}
        </section>
      ) : null}

      {user.role !== "family" ? (
        <>
          {showInterests ? (
            <section className="card profile-section" aria-labelledby="profile-preferences-title">
              <div className="profile-section-head">
                <span className="profile-section-icon">
                  <Icon name="leaf" />
                </span>
                <div>
                  <h2 id="profile-preferences-title">{section ? t.profile.interests : t.profileEditor.preferencesTitle}</h2>
                  <p>{t.profileEditor.preferencesHelp}</p>
                </div>
              </div>
              {!section ? <SectorPicker legend={t.profile.sector} value={sector} onChange={setSector} /> : null}
              {!section && user.role === "companion" ? (
                <SectorPicker multiple legend={t.companion.profileAreas} value={areas} onChange={setAreas} />
              ) : null}
              <InterestPicker cards={Boolean(section)} legend={t.profile.interests} value={interests} onChange={setInterests} />
            </section>
          ) : null}
          {showAvailability ? (
            <section className="card profile-section" aria-labelledby="profile-availability-title">
              <div className="profile-section-head">
                <span className="profile-section-icon">
                  <Icon name="calendar" />
                </span>
                <div>
                  <h2 id="profile-availability-title">{t.profile.availability}</h2>
                  <p>{t.profile.availabilityHelp}</p>
                </div>
              </div>
              <SlotPicker byDay legend={t.profileEditor.chooseSlots} value={availability} onChange={setAvailability} />
            </section>
          ) : null}
        </>
      ) : null}

      {!section ? (
        <section className="card profile-section">
          <div className="profile-section-head">
            <span className="profile-section-icon">
              <Icon name="settings" />
            </span>
            <div>
              <h2>{t.profile.account}</h2>
              <p>{t.profileEditor.accountHelp}</p>
            </div>
          </div>
          <div className="row-between">
            <span className="row" style={{ gap: 8 }}>
              <Icon name="globe" /> {t.profile.language}
            </span>
            <LanguageSwitch />
          </div>
        </section>
      ) : null}

      <div className="profile-save-bar">
        {!section ? <p>{t.profileEditor.saveHint}</p> : null}
        <button type="submit" className="btn btn-block-mobile" disabled={saving}>
          <Icon name="check" /> {saving ? t.profileEditor.saving : t.common.save}
        </button>
      </div>
      {toast}
    </form>
  );
}
