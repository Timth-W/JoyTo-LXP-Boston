"use client";

import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/i18n";
import { Icon } from "./Icon";

export function SeniorHomeActions() {
  const { t } = useI18n();
  const shortcuts = [
    { href: "/senior/activities", icon: "calendar", label: t.mobile.homeExplore },
    { href: "/senior/outings/new?from=home", icon: "users", label: t.mobile.homeCompanion },
  ] as const;

  return (
    <div className="mobile-ui mobile-home-actions">
      <Link href="/senior/joy" className="mobile-joy-feature" aria-label={t.joy.start}>
        <div className="mobile-joy-art" aria-hidden="true">
          <Image src="/joyto-home-joy.webp" alt="" width={900} height={600} sizes="(max-width: 480px) 55vw, 450px" />
        </div>
        <div className="mobile-joy-copy">
          <span className="mobile-action-icon">
            <Icon name="mic" />
          </span>
          <h2>{t.joy.start}</h2>
          <p>{t.mobile.homeJoyLead}</p>
          <span className="btn mobile-joy-cta" aria-hidden="true">
            <Icon name="mic" size={20} /> {t.joy.start} <Icon name="arrowRight" size={18} />
          </span>
        </div>
      </Link>
      <div className="mobile-shortcuts">
        {shortcuts.map(({ href, icon, label }) => (
          <Link key={href} href={href}>
            <Icon name={icon} size={27} />
            <strong>{label}</strong>
            <span className="mobile-shortcut-arrow">
              <Icon name="arrowRight" size={19} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
