"use client";

import Link from "next/link";
import { useI18n } from "@/i18n";
import { activityById, OWNER_TONE, ownerStatus, type OutingItem } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import { CATEGORY_ICON, Icon } from "./Icon";
import { Badge } from "./ui";
import { DateBadge } from "./MobileUI";

/** Activities and accompanied outings in one chronological list. */
export function OutingList({
  items,
  outingBase,
  linkActivities = true,
  featured = false,
}: {
  items: OutingItem[];
  outingBase: string;
  linkActivities?: boolean;
  featured?: boolean;
}) {
  const { state } = useStore();
  const { t, f } = useI18n();
  return (
    <ul className={`list card${featured ? " outing-list-featured" : ""}`} style={featured ? undefined : { paddingBlock: 4 }}>
      {items.map((item) => {
        const date = item.date;
        if (item.kind === "activity") {
          const a = item.activity;
          const body = (
            <>
              <DateBadge date={date} />
              <span className="list-body">
                {featured ? <span className="outing-list-kind">{t.categories[a.category]}</span> : null}
                <span className="list-title" style={{ display: "block" }}>
                  {f.text(a.title)}
                </span>
                <span className="muted small" style={{ display: "block" }}>
                  {f.date(date)}
                  {featured ? (
                    <span className="outing-list-place">
                      <Icon name="pin" size={16} />
                      {f.text(a.place)}
                    </span>
                  ) : (
                    ` · ${f.text(a.place)}`
                  )}
                </span>
              </span>
              <span className={featured ? "outing-list-arrow" : "cat-icon"} aria-hidden="true">
                <Icon name={featured ? "chevronRight" : CATEGORY_ICON[a.category]} />
              </span>
            </>
          );
          return (
            <li key={`a-${a.id}`}>
              {linkActivities ? (
                <Link className="list-link" href={`/senior/activities/${a.id}`}>
                  {body}
                </Link>
              ) : (
                <div className="list-link">{body}</div>
              )}
            </li>
          );
        }
        const m = item.mission;
        const st = ownerStatus(state, m);
        const activity = activityById(state, m.activityId);
        return (
          <li key={`m-${m.id}`}>
            <Link className="list-link" href={`${outingBase}/${m.id}`}>
              <DateBadge date={date} warm />
              <span className="list-body">
                {featured ? <span className="outing-list-kind">{t.outing.companion}</span> : null}
                <span className="list-title" style={{ display: "block" }}>
                  {activity ? f.text(activity.title) : t.outingTypes[m.type]}
                </span>
                <span className="muted small" style={{ display: "block" }}>
                  {f.date(date)} · {f.duration(m.durationMin)}
                </span>
                <span style={{ display: "block", marginTop: 6 }}>
                  <Badge tone={OWNER_TONE[st]}>{t.status.owner[st]}</Badge>
                </span>
              </span>
              <Icon name="chevronRight" className="muted" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
