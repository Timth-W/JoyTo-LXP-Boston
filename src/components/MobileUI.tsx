"use client";

import Link from "next/link";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { useI18n } from "@/i18n";
import { toDate } from "@/lib/format";
import type { Category } from "@/lib/types";
import { CATEGORY_ICON, Icon, type IconName } from "./Icon";

export function DateBadge({ date, warm = false }: { date: string; warm?: boolean }) {
  const { f } = useI18n();
  return (
    <span className={`date-block${warm ? " date-block-warm" : ""}`} aria-hidden="true">
      <span className="date-day">{toDate(date).getDate()}</span>
      <span className="date-month">{f.month(date)}</span>
    </span>
  );
}

export function CategoryLabel({ category }: { category: Category }) {
  const { t } = useI18n();
  return (
    <span className="activity-category">
      <Icon name={CATEGORY_ICON[category]} size={18} /> {t.categories[category]}
    </span>
  );
}

export function SegmentedControl<Value extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: Value;
  onChange: (next: Value) => void;
  options: readonly { value: Value; label: string; icon: IconName }[];
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
          <Icon name={option.icon} size={18} /> <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

export function ProfileMenuItem({ href, icon, children }: { href: string; icon: IconName; children: ReactNode }) {
  return (
    <Link href={href} className="profile-menu-item">
      <Icon name={icon} /> <span>{children}</span> <Icon name="chevronRight" size={18} />
    </Link>
  );
}

export function ConfirmAction({
  title,
  children,
  onCancel,
  onConfirm,
}: {
  title: string;
  children: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="action-dialog"
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 id={id}>{title}</h2>
      <div>{children}</div>
      <div className="action-dialog-buttons">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          {t.common.cancel}
        </button>
        <button type="button" className="btn" onClick={onConfirm}>
          <Icon name="check" size={18} /> {t.mobile.confirm}
        </button>
      </div>
    </dialog>
  );
}
