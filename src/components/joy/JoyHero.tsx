"use client";

import Link from "next/link";
import { useI18n } from "@/i18n";
import type { Role } from "@/lib/types";
import { Icon } from "../Icon";
import { LogoMark } from "../Logo";

/** Entry point to Joy on each home screen. Opening the page with ?start=1 makes Joy speak at once. */
export function JoyHero({ role, featured = false }: { role: Role; featured?: boolean }) {
  const { t } = useI18n();
  return (
    <section className={`card joy-hero${featured ? " joy-hero-featured" : ""}`} aria-label={t.joy.name}>
      <span className="joy-orb" data-status="off" aria-hidden="true">
        <LogoMark size={44} />
      </span>
      <div className="min-0 joy-hero-copy" style={{ flex: "1 1 220px" }}>
        {featured ? (
          <p className="joy-hero-label">
            <Icon name="sparkle" size={18} />
            {t.senior.joyEyebrow}
          </p>
        ) : null}
        <h2>{featured ? t.senior.joyPrompt : t.joy.name}</h2>
        <p className="muted">{featured ? t.senior.joyDescription : t.joy.lead}</p>
      </div>
      <Link href={`/${role}/joy?start=1`} className="btn btn-block-mobile">
        <Icon name="mic" /> {t.joy.start}
      </Link>
      {featured ? (
        <p className="joy-hero-reassurance">
          <Icon name="shield" size={17} />
          {t.senior.joyReassurance}
        </p>
      ) : null}
    </section>
  );
}
