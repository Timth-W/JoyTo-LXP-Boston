"use client";

import Image from "next/image";
import Link from "next/link";
import { CompanionMissionList, CompanionSetupNotices } from "@/components/CompanionMissions";
import { Icon } from "@/components/Icon";
import { JoyHero } from "@/components/joy/JoyHero";
import { PageHead } from "@/components/ui";
import { useI18n } from "@/i18n";
import { nextCompanionMission } from "@/lib/selectors";
import { useStore } from "@/lib/store";

export default function CompanionHome() {
  const { state, me } = useStore();
  const { t, f } = useI18n();
  if (!me) return null;

  const next = nextCompanionMission(state, me.id);
  const actions = [
    {
      variant: "find",
      href: "/companion/missions",
      icon: "calendar",
      title: t.companion.findMission,
      detail: t.companion.findMissionLead,
    },
    {
      variant: "next",
      href: next ? `/companion/missions/${next.id}` : "/companion/missions?view=mine",
      icon: "users",
      title: t.companion.nextMission,
      detail: next ? t.companion.nextMissionLead : t.companion.noNextMission,
    },
    {
      variant: "earnings",
      href: "/companion/earnings",
      icon: "coins",
      title: t.companion.dashboardEarnings,
      detail: t.companion.dashboardEarningsLead,
    },
  ] as const;

  return (
    <>
      <div className="mobile-ui companion-dashboard">
        <header className="companion-dashboard-hero">
          <div className="companion-dashboard-copy">
            <h1>{t.companion.dashboardHello(me.firstName)}</h1>
            <p>{t.companion.dashboardLead}</p>
          </div>
          <div className="companion-dashboard-art" aria-hidden="true">
            <Image src="/joyto-companion-home.webp" alt="" width={900} height={615} sizes="(max-width: 500px) 64vw, 430px" />
          </div>
        </header>
        <div className="companion-dashboard-actions">
          {actions.map(({ variant, href, icon, title, detail }) => (
            <Link key={variant} href={href} className="companion-dashboard-link" data-action={variant}>
              <span className="companion-dashboard-icon">
                <Icon name={icon} size={27} />
              </span>
              <span className="companion-dashboard-label">
                <strong>{title}</strong>
                <span>{detail}</span>
                {variant === "next" && next ? <time dateTime={next.start}>{f.date(next.start)}</time> : null}
              </span>
              <span className="companion-dashboard-arrow">
                <Icon name="arrowRight" size={20} />
              </span>
            </Link>
          ))}
        </div>
        <CompanionSetupNotices companion={me} />
      </div>
      <div className="desktop-ui stack-lg">
        <PageHead title={t.companion.hello(me.firstName)} />
        <JoyHero role="companion" />
        <CompanionSetupNotices companion={me} />
        <CompanionMissionList companion={me} />
      </div>
    </>
  );
}
