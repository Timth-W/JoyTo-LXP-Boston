"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n";
import { toDate } from "@/lib/format";
import { attendees, isPast, isRegistered, seatsLeft } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import type { Activity, User } from "@/lib/types";
import { CATEGORY_ICON, Icon } from "./Icon";
import { Avatar } from "./ui";

/**
 * Activity card, inspired by the moodboard phone card ("I'm in").
 * With a senior viewer, it shows who is going and lets them sign up in one tap.
 */
export function ActivityCard({
  activity,
  viewer,
  footer,
  via = "catalogue",
  headingLevel = 3,
  featured = false,
}: {
  activity: Activity;
  viewer?: User;
  footer?: ReactNode;
  via?: "assistant" | "catalogue";
  headingLevel?: 2 | 3;
  featured?: boolean;
}) {
  const { state, mutate } = useStore();
  const { t, f } = useI18n();
  const going = attendees(state, activity.id);
  const left = seatsLeft(state, activity);
  const past = isPast(state, activity.start);
  const mine = viewer ? isRegistered(state, activity.id, viewer.id) : false;
  const others = going.filter((u) => u.id !== viewer?.id);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const metadata = (
    <div className="meta">
      <span>
        <Icon name="clock" size={18} /> {f.date(activity.start)}
      </span>
      <span>
        <Icon name="pin" size={18} /> {f.text(activity.place)}
      </span>
    </div>
  );

  return (
    <article className={`card activity-card${featured ? " activity-card-featured" : ""}`}>
      {featured ? (
        <div className="activity-category">
          <Icon name={CATEGORY_ICON[activity.category]} size={18} />
          {t.categories[activity.category]}
        </div>
      ) : null}
      <div className="activity-top">
        <div className="date-block" aria-hidden="true">
          <span className="date-day">{toDate(activity.start).getDate()}</span>
          <span className="date-month">{f.month(activity.start)}</span>
        </div>
        <div className="min-0 stack-sm" style={{ flex: 1 }}>
          <Heading>
            {viewer?.role === "senior" ? (
              <Link href={`/senior/activities/${activity.id}`} className="activity-title-link">
                {f.text(activity.title)}
              </Link>
            ) : (
              f.text(activity.title)
            )}
          </Heading>
          {!featured ? metadata : null}
        </div>
        {!featured ? (
          <span className="cat-icon" title={t.categories[activity.category]}>
            <Icon name={CATEGORY_ICON[activity.category]} label={t.categories[activity.category]} />
          </span>
        ) : null}
      </div>
      {featured ? metadata : null}

      {others.length ? (
        <div className="row" style={{ gap: 10 }}>
          <span className="avatar-stack">
            {others.slice(0, 4).map((u) => (
              <Avatar key={u.id} user={{ ...u, lastName: "" }} size={34} />
            ))}
          </span>
          <span className="small">{t.activity.with(f.names(others.map((u) => u.firstName)))}</span>
        </div>
      ) : null}

      {footer}

      <div className="card-actions">
        {viewer && viewer.role === "senior" ? (
          past ? (
            <span className="badge">{t.activity.past}</span>
          ) : mine ? (
            <>
              <span className="badge badge-ok">{t.activity.registered}</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void mutate("unregister", { activityId: activity.id, seniorId: viewer.id }).catch(() => undefined)}
              >
                {t.activity.unregister}
              </button>
            </>
          ) : left > 0 ? (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => void mutate("register", { activityId: activity.id, seniorId: viewer.id, via }).catch(() => undefined)}
            >
              <Icon name="check" size={18} /> {t.activity.imIn}
            </button>
          ) : (
            <span className="badge badge-danger">{t.activity.full}</span>
          )
        ) : null}
        {!past && !mine ? <span className="muted small">{t.activity.seatsLeft(left)}</span> : null}
      </div>
    </article>
  );
}
