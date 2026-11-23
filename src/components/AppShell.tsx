"use client";

/**
 * Frame of every signed-in screen: header (logo, desktop navigation, notifications, account menu)
 * and, on phones, a bottom tab bar. It also protects each space: a visitor who is not signed in
 * is sent to the login page, and a profile is always sent back to its own space.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n";
import type { Dict } from "@/i18n/en";
import { HOME_BY_ROLE } from "@/lib/constants";
import { unreadCount } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import type { Role } from "@/lib/types";
import { Icon, type IconName } from "./Icon";
import { LanguageSwitch } from "./LanguageSwitch";
import { Logo } from "./Logo";
import { NotificationInbox } from "./NotificationInbox";
import { Avatar, Loading } from "./ui";

interface NavItem {
  href: string;
  label: keyof Dict["nav"];
  icon: IconName;
  /** Other paths that belong to this tab. */
  also?: string[];
  exact?: boolean;
}

const NAV: Record<Role, NavItem[]> = {
  senior: [
    { href: "/senior", label: "home", icon: "home", exact: true },
    { href: "/senior/joy", label: "joy", icon: "sparkle" },
    { href: "/senior/activities", label: "activities", icon: "calendar" },
    { href: "/senior/outings", label: "outings", icon: "heart" },
    { href: "/senior/profile", label: "profile", icon: "user" },
  ],
  companion: [
    { href: "/companion", label: "missions", icon: "home", exact: true, also: ["/companion/missions"] },
    { href: "/companion/joy", label: "joy", icon: "sparkle" },
    { href: "/companion/earnings", label: "earnings", icon: "wallet" },
    { href: "/companion/profile", label: "profile", icon: "user" },
  ],
  family: [
    { href: "/family", label: "home", icon: "home", exact: true, also: ["/family/outings", "/family/book"] },
    { href: "/family/payments", label: "payments", icon: "wallet" },
    { href: "/family/profile", label: "profile", icon: "user" },
  ],
};

const PROFILE_BY_ROLE: Record<Role, string> = {
  senior: "/senior/profile",
  companion: "/companion/profile",
  family: "/family/profile",
};

function isActive(path: string, item: NavItem) {
  const match = (base: string, exact?: boolean) => (exact ? path === base : path === base || path.startsWith(`${base}/`));
  return match(item.href, item.exact) || (item.also ?? []).some((p) => match(p));
}

export function AppShell({ role, children }: { role?: Role; children: ReactNode }) {
  const { state, hydrated, me, mutate } = useStore();
  const { t } = useI18n();
  const router = useRouter();
  const path = usePathname();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const previousPath = useRef(path);
  const historyPath = useRef<string | null>(null);
  /** True while signing out, so the guard below does not send the user to the login page. */
  const leaving = useRef(false);

  const allowed = Boolean(me && (!role || me.role === role));

  useEffect(() => {
    if (!hydrated || leaving.current) return;
    if (!me) router.replace(`/login?next=${encodeURIComponent(path)}`);
    else if (role && me.role !== role) router.replace(HOME_BY_ROLE[me.role]);
  }, [hydrated, me, role, router, path]);

  useLayoutEffect(() => {
    const rememberHistoryPath = () => {
      historyPath.current = window.location.pathname;
    };
    window.addEventListener("popstate", rememberHistoryPath);
    return () => window.removeEventListener("popstate", rememberHistoryPath);
  }, []);

  useLayoutEffect(() => {
    if (previousPath.current === path) return;
    setNotificationsOpen(false);
    const fromHistory = historyPath.current === path;
    previousPath.current = path;
    historyPath.current = null;
    // Next.js may keep the previous scroll offset when the top of the next screen is already visible.
    if (!fromHistory && window.matchMedia("(max-width: 959px)").matches) window.scrollTo(0, 0);
  }, [path]);

  /* Close the account menu after navigating. */
  useEffect(() => {
    if (menuRef.current) menuRef.current.open = false;
  }, [path]);

  /* Close the account menu with Escape or a click outside. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuRef.current?.open) menuRef.current.open = false;
    };
    const onClick = (e: MouseEvent) => {
      if (menuRef.current?.open && !menuRef.current.contains(e.target as Node)) menuRef.current.open = false;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);

  useEffect(() => {
    if (!notificationsOpen) return;
    const onOutside = (event: Event) => {
      if (event.target instanceof Node && !notificationsRef.current?.contains(event.target)) setNotificationsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setNotificationsOpen(false);
      bellRef.current?.focus();
    };
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("focusin", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("focusin", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [notificationsOpen]);

  if (!hydrated || !me || !allowed) return <Loading />;

  const items = NAV[me.role];
  const unread = unreadCount(state, me.id);

  function openNotifications() {
    if (menuRef.current) menuRef.current.open = false;
    setNotificationsOpen(true);
    bellRef.current?.focus();
  }

  function closeNotifications() {
    setNotificationsOpen(false);
    bellRef.current?.focus();
  }

  async function signOut(target: string) {
    leaving.current = true;
    try {
      await mutate("logout", {});
      router.push(target);
    } catch {
      leaving.current = false;
    }
  }

  return (
    <div className="app-frame">
      <a href="#main" className="skip-link">
        {t.common.skip}
      </a>
      <header className="app-header">
        <div className="container app-header-inner">
          <Link href={HOME_BY_ROLE[me.role]} className="brand" aria-label="JoyTo">
            <Logo size={38} />
          </Link>
          <nav className="top-nav" aria-label={t.nav.mainNav}>
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={item.label === "joy" ? "nav-joy" : undefined}
                aria-current={isActive(path, item) ? "page" : undefined}
              >
                <Icon name={item.icon} size={20} />
                {t.nav[item.label]}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <div className="notification-control" ref={notificationsRef}>
              <button
                ref={bellRef}
                type="button"
                className="icon-btn"
                aria-label={`${t.nav.notifications}${unread ? ` (${t.notifications.unread(unread)})` : ""}`}
                aria-expanded={notificationsOpen}
                aria-controls={notificationsOpen ? "notification-panel" : undefined}
                onClick={notificationsOpen ? closeNotifications : openNotifications}
              >
                <Icon name="bell" />
                {unread ? (
                  <span className="dot-count" aria-hidden="true">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </button>
              {notificationsOpen ? (
                <NotificationInbox
                  id="notification-panel"
                  onClose={closeNotifications}
                  onNavigate={(href) => {
                    if (href === path) closeNotifications();
                    else setNotificationsOpen(false);
                  }}
                />
              ) : null}
            </div>
            <details className="menu" ref={menuRef}>
              <summary aria-label={t.nav.menu}>
                <Avatar user={me} size={40} />
                <Icon name="chevronDown" size={18} />
              </summary>
              <div className="menu-panel">
                <div className="menu-head">
                  <div className="person-name">
                    {me.firstName} {me.lastName}
                  </div>
                  <div className="muted small" style={{ overflowWrap: "anywhere" }}>
                    {t.roles[me.role]} · {me.email}
                  </div>
                </div>
                <Link className="menu-item" href={PROFILE_BY_ROLE[me.role]}>
                  <Icon name="user" /> {t.nav.profile}
                </Link>
                <button type="button" className="menu-item" onClick={openNotifications}>
                  <Icon name="bell" /> {t.nav.notifications}
                </button>
                <div className="menu-section">
                  <div className="menu-label">{t.nav.language}</div>
                  <LanguageSwitch />
                </div>
                <div className="menu-section" style={{ paddingInline: 0 }}>
                  <button type="button" className="menu-item" onClick={() => signOut("/")}>
                    <Icon name="logout" /> {t.nav.logout}
                  </button>
                </div>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main id="main" className="container app-main">
        {children}
      </main>

      <nav className="tabbar" aria-label={t.nav.mainNav}>
        <ul>
          {items.map((item) => {
            const active = isActive(path, item);
            return (
              <li key={item.href}>
                <Link href={item.href} className={item.label === "joy" ? "tab-joy" : undefined} aria-current={active ? "page" : undefined}>
                  <span className="tab-icon">
                    <Icon name={item.icon} size={22} />
                  </span>
                  <span className="tab-label">{t.nav[item.label]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
