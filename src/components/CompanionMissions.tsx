"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/i18n";
import { rankMissions } from "@/lib/matching";
import { priceFor } from "@/lib/pricing";
import { COMPANION_TONE, companionStatus, missionForCompanion, missionsWithCompanionOffer } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import type { User } from "@/lib/types";
import { Icon } from "./Icon";
import { SegmentedControl } from "./MobileUI";
import { BackLink, Badge, Empty, PageHead } from "./ui";

export function CompanionSetupNotices({ companion }: { companion: User }) {
  const { t } = useI18n();
  return (
    <>
      {!companion.companion?.verified ? (
        <div className="notice notice-warn">
          <Icon name="shield" />
          <p>{t.companion.notVerified}</p>
        </div>
      ) : null}
      {!companion.availability.length ? (
        <Link href="/companion/profile/availability" className="notice notice-coral" style={{ textDecoration: "none" }}>
          <Icon name="calendar" />
          <span>{t.companion.noAvailability}</span>
        </Link>
      ) : null}
    </>
  );
}

type Tab = "reco" | "mine";

export function CompanionMissionList({ companion, initialTab = "reco" }: { companion: User; initialTab?: Tab }) {
  const { state } = useStore();
  const { t, f } = useI18n();
  const [tab, setTab] = useState(initialTab);
  const recommended = rankMissions(state, companion);
  const mine = missionsWithCompanionOffer(state, companion.id);
  const list = tab === "reco" ? recommended.map(({ item }) => item) : mine;

  return (
    <>
      <SegmentedControl
        label={t.nav.missions}
        value={tab}
        onChange={setTab}
        options={[
          { value: "reco", label: `${t.companion.recommended} (${recommended.length})`, icon: "sparkle" },
          { value: "mine", label: `${t.companion.myMissions} (${mine.length})`, icon: "heart" },
        ]}
      />
      {list.length ? (
        <div className="grid">
          {list.map((mission) => {
            const details = missionForCompanion(state, mission, companion.id);
            const status = companionStatus(state, mission, companion.id);
            return (
              <Link key={mission.id} href={`/companion/missions/${mission.id}`} className="card card-link">
                <div className="row-between">
                  <span className="eyebrow">{t.outingTypes[mission.type]}</span>
                  <Badge tone={COMPANION_TONE[status]}>{t.status.companion[status]}</Badge>
                </div>
                <h2 style={{ fontSize: "1.15rem" }}>{t.companion.withSenior(details.seniorFirstName, f.date(mission.start))}</h2>
                <div className="meta">
                  <span>
                    <Icon name="clock" size={16} /> {f.duration(mission.durationMin)}
                  </span>
                  <span>
                    <Icon name="euro" size={16} /> {t.companion.youEarn(f.money(priceFor(mission.durationMin).companionCents))}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty icon="bench">{tab === "reco" ? t.companion.noMission : t.companion.noMyMissions}</Empty>
      )}
    </>
  );
}

export function CompanionMissionsScreen({ initialTab }: { initialTab: Tab }) {
  const { me } = useStore();
  const { t } = useI18n();
  if (!me) return null;

  return (
    <div className="stack-lg mobile-role-home companion-missions">
      <BackLink href="/companion" />
      <PageHead title={t.nav.missions} />
      <CompanionSetupNotices companion={me} />
      <CompanionMissionList key={initialTab} companion={me} initialTab={initialTab} />
    </div>
  );
}
