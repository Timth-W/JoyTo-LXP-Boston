"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n";
import { HOME_BY_ROLE } from "@/lib/constants";
import { useStore } from "@/lib/store";
import { Icon } from "./Icon";
import { LanguageSwitch } from "./LanguageSwitch";
import { LogoMark, Wordmark } from "./Logo";

const SESSION_KEY = "joyto-welcome-seen";

/** A quiet, once-per-tab welcome. Entering never starts Joy or requests audio. */
export function WelcomeEntrance({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { me, hydrated } = useStore();
  const [phase, setPhase] = useState<"welcome" | "leaving" | "open">("welcome");
  const entered = useRef(false);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) setPhase("open");
    } catch {
      // The welcome also works when browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    if (phase !== "leaving") return;
    const reduced =
      document.documentElement.hasAttribute("data-reduce-motion") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduced ? 0 : 450;
    const timer = window.setTimeout(() => setPhase("open"), delay);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === "open" && entered.current) content.current?.focus({ preventScroll: true });
  }, [phase]);

  function rememberWelcome() {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Entering does not depend on session storage.
    }
  }

  function enter() {
    entered.current = true;
    rememberWelcome();
    setPhase("leaving");
  }

  return (
    <>
      {phase !== "open" ? (
        <main className={`welcome${phase === "leaving" ? " welcome-leaving" : ""}`} aria-labelledby="welcome-title">
          <div className="welcome-language">
            <LanguageSwitch />
          </div>
          <div className="welcome-content">
            <div className="welcome-emblem" aria-hidden="true">
              <div className="welcome-orbit" />
              <svg className="welcome-sprig welcome-sprig-left" viewBox="0 0 100 180" fill="none">
                <path className="welcome-stem" d="M80 170C25 126 24 67 53 12" />
                <path
                  d="M45 112C10 114 3 89 7 67c26 3 41 21 38 45ZM35 73C15 57 19 32 35 17c16 19 18 39 0 56ZM52 133c-1-29 17-45 41-46 0 27-15 45-41 46ZM39 88c1-25 18-40 42-40-2 25-17 40-42 40Z"
                  fill="currentColor"
                />
              </svg>
              <svg className="welcome-sprig welcome-sprig-right" viewBox="0 0 100 180" fill="none">
                <path className="welcome-stem" d="M80 170C25 126 24 67 53 12" />
                <path
                  d="M45 112C10 114 3 89 7 67c26 3 41 21 38 45ZM35 73C15 57 19 32 35 17c16 19 18 39 0 56ZM52 133c-1-29 17-45 41-46 0 27-15 45-41 46ZM39 88c1-25 18-40 42-40-2 25-17 40-42 40Z"
                  fill="currentColor"
                />
              </svg>
              <span className="welcome-sun" />
              <span className="welcome-seed" />
              <div className="welcome-mark">
                <LogoMark size={120} />
              </div>
            </div>
            <div className="welcome-copy">
              <Wordmark size={54} />
              <p className="hand desktop-ui">{t.common.tagline}</p>
              <h1 id="welcome-title">
                <span className="desktop-ui">{t.landing.welcomeTitle}</span>
                <span className="mobile-ui">{t.mobile.welcomeTitle}</span>
              </h1>
              <p className="welcome-description">
                <span className="desktop-ui">{t.landing.welcomeText}</span>
                <span className="mobile-ui">{t.mobile.welcomeLead}</span>
              </p>
            </div>
            <button type="button" className="btn welcome-enter desktop-ui" onClick={enter} disabled={phase === "leaving"}>
              {t.landing.welcomeEnter} <Icon name="arrowRight" size={22} />
            </button>
            <div className="mobile-ui mobile-welcome-actions">
              <Link
                href={me ? HOME_BY_ROLE[me.role] : "/signup"}
                className="btn btn-block"
                aria-disabled={!hydrated}
                onNavigate={(event) => {
                  if (hydrated) rememberWelcome();
                  else event.preventDefault();
                }}
              >
                {me ? t.landing.continueAs(me.firstName) : t.mobile.start} <Icon name="arrowRight" />
              </Link>
              {!me && (
                <Link href="/login" className="link-btn" onClick={rememberWelcome}>
                  {t.landing.login}
                </Link>
              )}
              <button type="button" className="link-btn" onClick={enter} disabled={phase === "leaving"}>
                {t.landing.discover}
              </button>
            </div>
          </div>
        </main>
      ) : null}
      <div
        ref={content}
        tabIndex={-1}
        className={phase !== "open" ? "welcome-content-pending" : entered.current ? "welcome-reveal" : undefined}
      >
        {children}
      </div>
    </>
  );
}
