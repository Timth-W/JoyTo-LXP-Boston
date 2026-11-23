"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { SegmentedControl } from "@/components/MobileUI";
import { OutingList } from "@/components/OutingList";
import { Empty, PageHead } from "@/components/ui";
import { useI18n } from "@/i18n";
import { isCompanionRequest, isPastAt, outingsOf } from "@/lib/selectors";
import { useStore } from "@/lib/store";

export default function OutingsPage() {
  const { state, me } = useStore();
  const { t } = useI18n();
  const [now, setNow] = useState(() => new Date());
  const [view, setView] = useState<"upcoming" | "past" | "requests">("upcoming");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!me) return null;
  const all = outingsOf(state, me.id);
  const requests = all.filter(isCompanionRequest);
  const scheduled = all.filter((i) => !isCompanionRequest(i));
  const upcoming = scheduled.filter((i) => !isPastAt(i.date, now));
  const past = scheduled.filter((i) => isPastAt(i.date, now)).reverse();

  return (
    <div className="outings-page" data-outing-view={view}>
      <PageHead
        title={t.senior.outingsTitle}
        eyebrow={t.outingsPage.eyebrow}
        lead={t.outingsPage.lead}
        action={
          <Link href="/senior/outings/new" className="btn desktop-ui">
            <Icon name="plus" /> {t.senior.newOuting}
          </Link>
        }
      />
      <div className="mobile-ui">
        <SegmentedControl
          label={t.senior.outingsTitle}
          value={view}
          onChange={setView}
          options={[
            { value: "upcoming", label: t.senior.upcoming, icon: "calendar" },
            { value: "past", label: t.senior.past, icon: "clock" },
            { value: "requests", label: t.mobile.companionRequests, icon: "users" },
          ]}
        />
      </div>
      <div className="outings-overview">
        <div className="outings-primary">
          <section className="outings-section" data-outing-section="upcoming" aria-labelledby="upcoming-title">
            <div className="outings-section-head">
              <h2 id="upcoming-title">{t.senior.upcoming}</h2>
              <span className="outings-count">{t.outingsPage.count(upcoming.length)}</span>
            </div>
            {upcoming.length ? (
              <OutingList items={upcoming} outingBase="/senior/outings" featured />
            ) : (
              <Empty
                icon="calendar"
                action={
                  <Link href="/senior/activities" className="btn btn-secondary">
                    {t.senior.browseActivities}
                  </Link>
                }
              >
                <strong>{t.senior.noUpcoming}</strong>
                <span className="outings-empty-help">{t.outingsPage.emptyUpcoming}</span>
              </Empty>
            )}
          </section>
          <section className="outings-section" data-outing-section="past" aria-labelledby="past-title">
            <div className="outings-section-head">
              <div className="stack-sm">
                <h2 id="past-title">{t.senior.past}</h2>
                <p className="muted">{t.outingsPage.pastLead}</p>
              </div>
              <span className="outings-count">{t.outingsPage.count(past.length)}</span>
            </div>
            {past.length ? (
              <OutingList items={past} outingBase="/senior/outings" featured />
            ) : (
              <div className="outings-past-empty">
                <Icon name="heart" size={28} />
                <div>
                  <strong>{t.senior.noPast}</strong>
                  <p>{t.outingsPage.emptyPast}</p>
                </div>
              </div>
            )}
          </section>
          <section className="outings-section" data-outing-section="requests" aria-labelledby="requests-title">
            <h2 id="requests-title">{t.mobile.companionRequests}</h2>
            {requests.length ? (
              <OutingList items={requests} outingBase="/senior/outings" featured />
            ) : (
              <Empty icon="users">{t.mobile.noRequests}</Empty>
            )}
          </section>
        </div>
        <aside className="outings-inspiration" aria-labelledby="inspiration-title">
          <span className="outings-inspiration-icon">
            <Icon name="leaf" size={28} />
          </span>
          <p className="hand">{t.outingsPage.inspirationEyebrow}</p>
          <h2 id="inspiration-title">{t.outingsPage.inspirationTitle}</h2>
          <p>{t.outingsPage.inspirationText}</p>
          <Link href="/senior/activities" className="btn btn-secondary">
            {t.senior.browseActivities}
            <Icon name="arrowRight" size={18} />
          </Link>
          <Link href="/senior/joy" className="link-btn">
            <Icon name="sparkle" size={19} />
            {t.joy.start}
          </Link>
        </aside>
      </div>
      <Link href="/senior/outings/new" className="btn btn-block mobile-ui outings-create">
        <Icon name="plus" /> {t.senior.newOuting}
      </Link>
    </div>
  );
}
