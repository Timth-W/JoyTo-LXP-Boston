"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import { activityById, missionById, type OutingConfirmation } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import { Icon } from "./Icon";

export function OutingCelebration() {
  const { outingConfirmation } = useStore();
  return outingConfirmation ? (
    <Celebration
      key={`${outingConfirmation.kind}:${"activityId" in outingConfirmation ? outingConfirmation.activityId : outingConfirmation.missionId}`}
      confirmation={outingConfirmation}
    />
  ) : null;
}

function Celebration({ confirmation }: { confirmation: OutingConfirmation }) {
  const { state, me, dismissOutingConfirmation } = useStore();
  const { t, f } = useI18n();
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const request = confirmation.kind === "request" ? missionById(state, confirmation.missionId) : undefined;
  const activity = activityById(state, confirmation.kind === "activity" ? confirmation.activityId : request?.activityId);
  const title = activity ? f.text(activity.title) : request ? t.outingTypes[request.type] : t.nav.outings;
  const date = confirmation.kind === "activity" ? activity?.start : request?.start;
  const href = me?.role === "family" && request ? `/family/outings/${request.id}` : "/senior/outings";

  useEffect(() => {
    const dialog = ref.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function openOutings() {
    dismissOutingConfirmation();
    router.push(href);
  }

  return (
    <dialog
      ref={ref}
      className="outing-celebration"
      aria-labelledby="celebration-title"
      aria-describedby="celebration-description"
      onCancel={dismissOutingConfirmation}
    >
      <button type="button" className="icon-btn celebration-close" onClick={dismissOutingConfirmation} aria-label={t.common.close}>
        <Icon name="close" />
      </button>
      <div className="celebration-art" aria-hidden="true">
        <svg className="celebration-branch" viewBox="0 0 260 160" fill="none">
          <path className="celebration-stem" d="M130 145C75 146 37 110 34 55M130 145c55 1 93-35 96-90" />
          <g className="celebration-leaf celebration-leaf-one">
            <path d="M48 103C18 107 6 87 10 66c27 0 40 15 38 37Z" />
          </g>
          <g className="celebration-leaf celebration-leaf-two">
            <path d="M41 80c-5-27 9-43 30-48 5 23-6 41-30 48Z" />
          </g>
          <g className="celebration-leaf celebration-leaf-three">
            <path d="M211 103c30 4 42-16 38-37-27 0-40 15-38 37Z" />
          </g>
          <g className="celebration-leaf celebration-leaf-four">
            <path d="M219 80c5-27-9-43-30-48-5 23 6 41 30 48Z" />
          </g>
          <g className="celebration-flower">
            <circle cx="227" cy="36" r="9" />
            <circle cx="239" cy="45" r="9" />
            <circle cx="235" cy="59" r="9" />
            <circle cx="219" cy="59" r="9" />
            <circle cx="215" cy="45" r="9" />
            <circle className="celebration-flower-heart" cx="227" cy="48" r="7" />
          </g>
        </svg>
        <span className="celebration-check">
          <svg viewBox="0 0 64 64" fill="none">
            <path d="m16 33 11 11 22-24" pathLength="1" />
          </svg>
        </span>
      </div>
      <p className="hand celebration-hand">{t.celebration.eyebrow}</p>
      <h2 id="celebration-title">{confirmation.kind === "activity" ? t.celebration.joinedTitle : t.celebration.requestTitle}</h2>
      <p id="celebration-description">
        {confirmation.kind === "activity" ? t.celebration.joinedDescription : t.celebration.requestDescription}
      </p>
      <div className="celebration-agenda">
        <p className="celebration-agenda-label">
          <Icon name="calendar" size={20} />
          {me?.role === "family" ? t.outing.details : t.nav.outings}
          <span>
            <Icon name="check" size={16} />
            {t.celebration.added}
          </span>
        </p>
        <div className="celebration-entry">
          <strong>{title}</strong>
          {date ? <span>{f.date(date)}</span> : null}
        </div>
      </div>
      <div className="celebration-actions">
        <button type="button" className="btn btn-block" onClick={openOutings} autoFocus>
          {me?.role === "family" ? t.celebration.viewRequest : t.celebration.viewOutings}
          <Icon name="arrowRight" size={20} />
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={dismissOutingConfirmation}>
          {t.celebration.continue}
        </button>
      </div>
    </dialog>
  );
}
