"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { OutingList } from "@/components/OutingList";
import { Empty, PageHead } from "@/components/ui";
import { useI18n } from "@/i18n";
import { isPastAt, outingsOf } from "@/lib/selectors";
import { useStore } from "@/lib/store";

export default function OutingsPage() {
  const { state, me } = useStore();
  const { t } = useI18n();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!me) return null;
  const all = outingsOf(state, me.id);
  const upcoming = all.filter((i) => !isPastAt(i.date, now));
  const past = all.filter((i) => isPastAt(i.date, now)).reverse();

  return (
    <div className="outings-page">
      <PageHead
        title={t.senior.outingsTitle}
        eyebrow={t.outingsPage.eyebrow}
        lead={t.outingsPage.lead}
        action={
          <Link href="/senior/outings/new" className="btn btn-block-mobile">
            <Icon name="plus" /> {t.senior.newOuting}
          </Link>
        }
      />
      <div className="outings-overview">
        <div className="outings-primary">
          <section className="outings-section" aria-labelledby="upcoming-title">
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
          <section className="outings-section" aria-labelledby="past-title">
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
    </div>
  );
}
