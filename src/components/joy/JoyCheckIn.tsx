"use client";

import Image from "next/image";
import { type Ref } from "react";
import { useI18n } from "@/i18n";
import type { JoyMood } from "@/lib/joy/proposals";
import { Icon, type IconName } from "../Icon";

const MOODS = [
  { id: "good", icon: "moodGood" },
  { id: "okay", icon: "moodOkay" },
  { id: "low", icon: "moodLow" },
] as const satisfies { id: JoyMood; icon: IconName }[];

export function JoyCheckIn({
  mood,
  ready,
  startRef,
  onMood,
  onSpeak,
  onWrite,
}: {
  mood: JoyMood | null;
  ready: boolean;
  startRef: Ref<HTMLButtonElement>;
  onMood: (mood: JoyMood) => void;
  onSpeak: () => void;
  onWrite: () => void;
}) {
  const { t } = useI18n();
  const copy = t.joy.checkIn;

  return (
    <section className="joy-checkin mobile-ui" aria-labelledby="joy-checkin-title">
      <div className="joy-checkin-art" aria-hidden="true">
        <div className="joy-checkin-leaves joy-checkin-leaves-start">
          <Icon name="leaf" size={96} />
        </div>
        <div className="joy-checkin-leaves joy-checkin-leaves-end">
          <Icon name="leaf" size={88} />
        </div>
        <Image src="/joyto-joy-welcome.webp" alt="" width={720} height={720} sizes="(max-width: 480px) 70vw, 320px" priority />
        <span className="joy-checkin-bubble">
          <Icon name="sparkle" size={18} /> {t.joy.name}
        </span>
      </div>

      <div className="joy-checkin-card">
        <header className="joy-checkin-copy">
          <p className="joy-checkin-eyebrow">{copy.eyebrow}</p>
          <h1 id="joy-checkin-title">{copy.title}</h1>
          <p>{copy.lead}</p>
        </header>

        <div className="joy-moods" role="group" aria-labelledby="joy-checkin-title">
          {MOODS.map(({ id, icon }) => (
            <button key={id} type="button" data-mood={id} aria-pressed={mood === id} onClick={() => onMood(id)}>
              <Icon name={icon} size={38} />
              <span>{copy[id]}</span>
              {mood === id && <Icon name="check" size={17} className="joy-mood-check" />}
            </button>
          ))}
        </div>
        <p className="joy-mood-reply" role="status">
          {mood ? copy[`${mood}Reply`] : null}
        </p>

        <div className="joy-checkin-actions">
          <button ref={startRef} type="button" className="btn joy-checkin-start" disabled={!ready} onClick={onSpeak}>
            <Icon name="mic" size={26} /> {t.joy.start}
          </button>
          <button type="button" className="btn btn-secondary btn-sm joy-checkin-write" onClick={onWrite}>
            <Icon name="keyboard" size={21} /> {copy.write}
          </button>
        </div>

        <p className="joy-checkin-note">
          <Icon name="shield" size={18} /> {copy.note}
        </p>
      </div>
    </section>
  );
}
