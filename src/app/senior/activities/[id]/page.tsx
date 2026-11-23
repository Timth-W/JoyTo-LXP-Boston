"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ActivityRegistration } from "@/components/ActivityRegistration";
import { CategoryLabel } from "@/components/MobileUI";
import { CATEGORY_ICON, Icon } from "@/components/Icon";
import { BackLink, Empty, Person } from "@/components/ui";
import { useI18n } from "@/i18n";
import { activityById, attendees, isPast, isRegistered } from "@/lib/selectors";
import { useStore } from "@/lib/store";

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const { state, me } = useStore();
  const { t, f } = useI18n();
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
  const going = attendees(state, a.id);
  const others = going.filter((u) => u.id !== senior.id);
  const mine = isRegistered(state, a.id, senior.id);
  const past = isPast(state, a.start);

  return (
    <div className="activity-detail-page">
      <BackLink href="/senior/activities" />
      <header className="activity-detail-head">
        <div className="activity-illustration mobile-ui" data-category={a.category} aria-hidden="true">
          <Icon name={CATEGORY_ICON[a.category]} size={76} />
        </div>
        <CategoryLabel category={a.category} />
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
          <ActivityRegistration activity={a} viewer={senior} detail />
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
