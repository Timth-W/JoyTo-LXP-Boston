"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CATEGORY_ICON, Icon } from "@/components/Icon";
import { BackLink, Empty, Person } from "@/components/ui";
import { useI18n } from "@/i18n";
import { activityById, attendees, isPast, isRegistered, seatsLeft } from "@/lib/selectors";
import { useStore } from "@/lib/store";

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const { state, me, mutate } = useStore();
  const { t, f } = useI18n();
  const [pending, setPending] = useState(false);
  if (!me) return null;
  const senior = me;
  const a = activityById(state, id);
  if (!a) {
    return (
      <Empty icon="alert" action={<Link href="/senior/activities">{t.common.back}</Link>}>
        {t.common.notFound}
      </Empty>
    );
  }
  const activity = a;
  const going = attendees(state, a.id);
  const others = going.filter((u) => u.id !== senior.id);
  const mine = isRegistered(state, a.id, senior.id);
  const left = seatsLeft(state, a);
  const past = isPast(state, a.start);

  async function updateRegistration(action: "register" | "unregister") {
    if (pending) return;
    setPending(true);
    try {
      if (action === "register") await mutate("register", { activityId: activity.id, seniorId: senior.id, via: "catalogue" });
      else await mutate("unregister", { activityId: activity.id, seniorId: senior.id });
    } catch {
      // The shared backend notice explains failed requests.
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="activity-detail-page">
      <BackLink href="/senior/activities" />
      <header className="activity-detail-head">
        <span className="chip" style={{ alignSelf: "flex-start" }}>
          <Icon name={CATEGORY_ICON[a.category]} size={16} /> {t.categories[a.category]}
        </span>
        <h1>{f.text(a.title)}</h1>
        <p>{f.text(a.description)}</p>
      </header>

      <div className="activity-detail-layout">
        <section className="card activity-practical" aria-labelledby="practical-title">
          <h2 id="practical-title">{t.activityDetail.practicalTitle}</h2>
          <dl className="activity-facts">
            <div>
              <dt>
                <span className="activity-fact-icon">
                  <Icon name="calendar" />
                </span>
                {t.activityDetail.when}
              </dt>
              <dd>{f.date(a.start)}</dd>
            </div>
            <div>
              <dt>
                <span className="activity-fact-icon">
                  <Icon name="pin" />
                </span>
                {t.activityDetail.where}
              </dt>
              <dd>
                {f.text(a.place)}
                <span className="activity-fact-secondary">{t.sectors[a.sector]}</span>
              </dd>
            </div>
            <div>
              <dt>
                <span className="activity-fact-icon">
                  <Icon name="users" />
                </span>
                {t.activityDetail.organizedBy}
              </dt>
              <dd>{f.text(a.organizer)}</dd>
            </div>
          </dl>
          <div className="activity-registration" aria-busy={pending}>
            {past ? (
              <span className="badge">{t.activity.past}</span>
            ) : mine ? (
              <>
                <span className="badge badge-ok">
                  <Icon name="check" size={17} />
                  {t.activity.registered}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={pending}
                  onClick={() => void updateRegistration("unregister")}
                >
                  {t.activity.unregister}
                </button>
              </>
            ) : left > 0 ? (
              <button type="button" className="btn btn-block-mobile" disabled={pending} onClick={() => void updateRegistration("register")}>
                <Icon name="check" /> {t.activity.imIn}
              </button>
            ) : (
              <span className="badge badge-danger">{t.activity.full}</span>
            )}
            {!past ? <span className="muted">{t.activity.seatsLeft(left)}</span> : null}
          </div>
        </section>

        {!past ? (
          <aside className="card activity-companion" aria-labelledby="companion-title">
            <span className="activity-companion-icon">
              <Icon name="heart" size={30} />
            </span>
            <p className="hand">{t.activityDetail.companionEyebrow}</p>
            <h2 id="companion-title">{t.activity.goWithCompanion}</h2>
            <p>{t.activity.goWithCompanionHelp}</p>
            <Link href={`/senior/outings/new?activity=${a.id}`} className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }}>
              {t.senior.newOuting}
              <Icon name="arrowRight" size={18} />
            </Link>
          </aside>
        ) : null}
      </div>

      <section className="activity-participants" aria-labelledby="participants-title">
        <div className="outings-section-head">
          <div className="stack-sm">
            <h2 id="participants-title">{t.activity.whoGoes}</h2>
            <p className="muted">{t.activityDetail.participantsLead}</p>
          </div>
          <span className="outings-count">{t.activityDetail.participantCount(going.length)}</span>
        </div>
        {going.length ? (
          <div className="activity-people-grid">
            {mine ? (
              <div className="card activity-person activity-person-self">
                <Person user={senior} showLastName={false} subtitle={past ? t.activityDetail.youWent : t.activityDetail.youGoing} />
              </div>
            ) : null}
            {others.map((u) => {
              const shared = u.interests.filter((i) => senior.interests.includes(i));
              return (
                <div key={u.id} className="card activity-person">
                  <Person
                    user={u}
                    showLastName={false}
                    subtitle={
                      shared.length
                        ? `${t.activity.sharesInterests}: ${shared.map((c) => t.categories[c].toLowerCase()).join(", ")}`
                        : undefined
                    }
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <Empty icon="users">{past ? t.activityDetail.noParticipantsPast : t.activity.nobodyYet}</Empty>
        )}
      </section>
    </div>
  );
}
