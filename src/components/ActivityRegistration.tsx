"use client";

import { useState } from "react";
import { useI18n } from "@/i18n";
import { isPast, isRegistered, seatsLeft } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import type { Activity, User } from "@/lib/types";
import { Icon } from "./Icon";
import { ConfirmAction } from "./MobileUI";
import { useToast } from "./ui";

export function ActivityRegistration({
  activity,
  viewer,
  via = "catalogue",
  detail = false,
}: {
  activity: Activity;
  viewer?: User;
  via?: "assistant" | "catalogue";
  detail?: boolean;
}) {
  const { state, mutate } = useStore();
  const { t, f } = useI18n();
  const [toast, showToast] = useToast();
  const [action, setAction] = useState<"register" | "unregister" | null>(null);
  const [pending, setPending] = useState(false);
  const past = isPast(state, activity.start);
  const left = seatsLeft(state, activity);
  const mine = viewer && isRegistered(state, activity.id, viewer.id);

  async function submit() {
    if (!viewer || !action || pending) return;
    setPending(true);
    setAction(null);
    try {
      const payload = { activityId: activity.id, seniorId: viewer.id };
      if (action === "register") await mutate("register", { ...payload, via });
      else {
        await mutate("unregister", payload);
        showToast(t.mobile.leftActivity);
      }
    } catch {
      // The shared backend notice explains failed requests.
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={detail ? "activity-registration" : "card-actions activity-card-registration"} aria-busy={pending}>
      {viewer?.role === "senior" &&
        (past ? (
          <span className="badge">{t.activity.past}</span>
        ) : mine ? (
          <>
            <span className="badge badge-ok">
              <Icon name="check" size={17} /> {t.activity.registered}
            </span>
            <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setAction("unregister")}>
              {t.activity.unregister}
            </button>
          </>
        ) : left > 0 ? (
          <button
            type="button"
            className={detail ? "btn btn-block-mobile" : "btn btn-sm"}
            disabled={pending}
            onClick={() => setAction("register")}
          >
            <Icon name="check" /> {t.activity.imIn}
          </button>
        ) : (
          <span className="badge badge-danger">{t.activity.full}</span>
        ))}
      {!past && (detail || !mine) ? <span className="muted small">{t.activity.seatsLeft(left)}</span> : null}
      {action ? (
        <ConfirmAction
          title={action === "register" ? t.mobile.joinTitle : t.mobile.leaveTitle}
          onCancel={() => setAction(null)}
          onConfirm={() => void submit()}
        >
          <strong>{f.text(activity.title)}</strong>
          <p>
            {f.date(activity.start)} · {f.text(activity.place)}
          </p>
        </ConfirmAction>
      ) : null}
      {toast}
    </div>
  );
}
