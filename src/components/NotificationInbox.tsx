"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useI18n } from "@/i18n";
import { notificationText } from "@/lib/notifications";
import { notificationsFor, unreadCount } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import { Icon } from "./Icon";

export function NotificationInbox({ id, onClose, onNavigate }: { id?: string; onClose?: () => void; onNavigate?: (href: string) => void }) {
  const { state, me, mutate } = useStore();
  const { t, f } = useI18n();
  const headingId = useId();
  const [marking, setMarking] = useState(false);
  if (!me) return null;
  const userId = me.id;
  const list = notificationsFor(state, userId);
  const unread = unreadCount(state, userId);
  const Heading = onClose ? "h2" : "h1";

  async function markAllRead() {
    if (!unread || marking) return;
    setMarking(true);
    try {
      await mutate("mark-all-read", { userId });
    } catch {
      // The shared backend notice explains the failed request.
    } finally {
      setMarking(false);
    }
  }

  return (
    <section id={id} className={onClose ? "notification-inbox notification-panel" : "notification-inbox"} aria-labelledby={headingId}>
      <header className="notification-head">
        <div className="notification-title">
          <Heading id={headingId}>{t.notifications.title}</Heading>
          {onClose ? (
            <button type="button" className="icon-btn" aria-label={t.common.close} onClick={onClose}>
              <Icon name="close" size={20} />
            </button>
          ) : null}
        </div>
        {list.length ? (
          <div className="notification-tools">
            <p className="muted small" role="status">
              {t.notifications.unread(unread)}
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-disabled={!unread || marking}
              onClick={() => void markAllRead()}
            >
              <Icon name="check" size={18} /> {t.notifications.markAll}
            </button>
          </div>
        ) : null}
      </header>
      {list.length ? (
        <ul className="notification-list">
          {list.map((notice) => (
            <li key={notice.id}>
              <Link
                href={notice.href}
                className={`notif-item${notice.read ? "" : " unread"}`}
                onClick={() => {
                  if (!notice.read) void mutate("mark-read", { id: notice.id }).catch(() => undefined);
                }}
                onNavigate={() => onNavigate?.(notice.href)}
              >
                <span className={`notif-dot${notice.read ? " read" : ""}`} aria-hidden="true" />
                <span className="min-0">
                  <span className="notification-message">{notificationText(state, notice, t, f)}</span>
                  <time className="muted small" dateTime={notice.createdAt}>
                    {f.date(notice.createdAt)}
                  </time>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="notification-empty muted">
          <Icon name="bell" size={20} /> {t.notifications.empty}
        </p>
      )}
    </section>
  );
}
