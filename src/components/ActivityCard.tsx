"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { useI18n } from "@/i18n";
import { attendees, isRegistered, seatsLeft } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import type { Activity, User } from "@/lib/types";
import { CATEGORY_ICON, Icon } from "./Icon";
import { Avatar } from "./ui";
import { DateBadge, CategoryLabel } from "./MobileUI";
import { ActivityRegistration } from "./ActivityRegistration";

/**
 * Activity card, inspired by the moodboard phone card ("I'm in").
 * With a senior viewer, it shows who is going and links to the activity.
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
  const { state } = useStore();
  const { t, f } = useI18n();
  const going = attendees(state, activity.id);
  const left = seatsLeft(state, activity);
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
      {featured ? <CategoryLabel category={activity.category} /> : null}
      <div className="activity-top">
        <DateBadge date={activity.start} />
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
      <div>
        <span className="badge">{f.activityPrice(activity.priceCents)}</span>
      </div>

      {others.length ? (
        <div className="row" style={{ gap: 10 }}>
          <span className="avatar-stack">
            {others.slice(0, 4).map((u) => (
              <Avatar key={u.id} user={{ ...u, lastName: "" }} size={34} />
            ))}
          </span>
          <span className="small desktop-ui">{t.activity.with(f.names(others.map((u) => u.firstName)))}</span>
          <span className="small mobile-ui">{t.activityDetail.participantCount(going.length)}</span>
        </div>
      ) : null}

      {featured ? (
        <div className="activity-mobile-status">
          {mine ? (
            <span className="badge badge-ok">
              <Icon name="check" size={17} /> {t.activity.registered}
            </span>
          ) : (
            <span className="muted small">{left > 0 ? t.activity.seatsLeft(left) : t.activity.full}</span>
          )}
        </div>
      ) : null}
      {footer}

      <ActivityRegistration activity={activity} viewer={viewer} via={via} />
    </article>
  );
}
