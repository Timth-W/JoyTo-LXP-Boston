"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ActivityCard } from "@/components/ActivityCard";
import { Icon } from "@/components/Icon";
import { JoyHero } from "@/components/joy/JoyHero";
import { OutingList } from "@/components/OutingList";
import { SeniorHomeActions } from "@/components/SeniorHomeActions";
import { Empty } from "@/components/ui";
import { useI18n } from "@/i18n";
import { rankActivities } from "@/lib/matching";
import { isCompanionRequest, pendingOffers, upcomingOutings, userById } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import { toLocalIso } from "@/lib/format";

export default function SeniorHome() {
  const { state, me } = useStore();
  const { t, f } = useI18n();
  const [today, setToday] = useState(state.now);

  useEffect(() => {
    setToday(toLocalIso(new Date()));
  }, []);

  if (!me) return null;

  const next = upcomingOutings(state, me.id)
    .filter((item) => !isCompanionRequest(item))
    .slice(0, 1);
  const suggestions = rankActivities(state, me, undefined, 2);
  const withOffers = state.missions.filter((m) => m.seniorId === me.id && m.status === "open" && pendingOffers(state, m.id).length);

  return (
    <div className="senior-home">
      <header className="senior-home-head">
        <div className="stack-sm">
          <h1>{t.senior.hello(me.firstName)}</h1>
          <p className="desktop-ui">{t.senior.homeLead}</p>
          <p className="mobile-ui">{t.mobile.today}</p>
        </div>
        <span className="senior-today">
          <Icon name="calendar" size={20} />
          {f.day(today)}
        </span>
      </header>

      <SeniorHomeActions />

      {withOffers.map((m) => (
        <Link key={m.id} href={`/senior/outings/${m.id}`} className="notice notice-warn" style={{ textDecoration: "none" }}>
          <Icon name="bell" />
          <strong>
            {t.senior.offersWaiting(
              f.names(pendingOffers(state, m.id).map((o) => userById(state, o.companionId)?.firstName ?? "")),
              f.date(m.start),
            )}
          </strong>
          <Icon name="chevronRight" />
        </Link>
      ))}

      <div className="senior-home-intro desktop-ui">
        <JoyHero role="senior" featured />
        <Link href="/senior/outings/new?from=home" className="link-btn senior-book-direct">
          <Icon name="heart" size={20} />
          {t.senior.newOuting}
          <Icon name="chevronRight" size={18} />
        </Link>
        <aside className="senior-shortcuts" aria-labelledby="shortcuts-title">
          <p className="hand">{t.senior.atYourPace}</p>
          <h2 id="shortcuts-title">{t.senior.shortcutTitle}</h2>
          <Link href="/senior/activities" className="senior-shortcut">
            <span className="senior-shortcut-icon">
              <Icon name="leaf" />
            </span>
            <span>{t.senior.browseActivities}</span>
            <Icon name="arrowRight" size={20} />
          </Link>
          <Link href="/senior/outings" className="senior-shortcut">
            <span className="senior-shortcut-icon">
              <Icon name="calendar" />
            </span>
            <span>{t.senior.outingsTitle}</span>
            <Icon name="arrowRight" size={20} />
          </Link>
        </aside>
      </div>

      <section
        className={`stack senior-home-section senior-home-next${next.length ? "" : " mobile-ui"}`}
        aria-labelledby="next-outing-title"
      >
        <div className="section-title">
          <h2 id="next-outing-title">
            <span className="desktop-ui">{t.senior.nextOuting}</span>
            <span className="mobile-ui">
              <Icon name="calendar" size={22} /> {t.mobile.homeNextOuting}
            </span>
          </h2>
          <Link href="/senior/outings" className="link-btn">
            {t.common.seeAll} <Icon name="arrowRight" size={18} />
          </Link>
        </div>
        {next.length ? (
          <OutingList items={next} outingBase="/senior/outings" featured showParticipants />
        ) : (
          <div className="card senior-next-empty">
            <p className="muted">{t.senior.noUpcoming}</p>
            <Link href="/senior/activities" className="link-btn">
              {t.senior.browseActivities} <Icon name="arrowRight" size={18} />
            </Link>
          </div>
        )}
      </section>

      {suggestions.length ? (
        <section className="stack senior-home-section" aria-labelledby="suggestions-title">
          <div className="section-title">
            <div className="stack-sm">
              <h2 id="suggestions-title">{t.senior.forYou}</h2>
              <p className="muted">{t.senior.forYouLead}</p>
            </div>
            <Link href="/senior/activities" className="link-btn">
              {t.common.seeAll} <Icon name="chevronRight" size={18} />
            </Link>
          </div>
          <div className="senior-activity-grid">
            {suggestions.map((r) => (
              <ActivityCard key={r.item.id} activity={r.item} viewer={me} via="assistant" featured />
            ))}
          </div>
        </section>
      ) : (
        <section aria-label={t.senior.forYou}>
          <Empty
            icon="leaf"
            action={
              <Link href="/senior/activities" className="btn btn-secondary">
                {t.senior.browseActivities}
              </Link>
            }
          >
            {t.senior.noSuggestions}
          </Empty>
        </section>
      )}
    </div>
  );
}
