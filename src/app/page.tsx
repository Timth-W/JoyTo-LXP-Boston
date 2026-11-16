"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { LandingPreview } from "@/components/LandingPreview";
import { Logo, LogoMark } from "@/components/Logo";
import { Loading } from "@/components/ui";
import { WelcomeEntrance } from "@/components/WelcomeEntrance";
import { useI18n } from "@/i18n";
import { HOME_BY_ROLE } from "@/lib/constants";
import { activityById } from "@/lib/selectors";
import { useStore } from "@/lib/store";

function Leaf({ size, style }: { size: number; style: React.CSSProperties }) {
  return (
    <svg className="hero-leaf" width={size} height={size} viewBox="0 0 64 64" style={style} aria-hidden="true">
      <path d="M8 56C10 30 26 12 56 8c-2 28-20 46-48 48z" fill="currentColor" />
      <path d="M10 54 44 20M24 40l-2-12M32 32l10 2M18 46l12 2" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

export default function Landing() {
  return (
    <WelcomeEntrance>
      <LandingContent />
    </WelcomeEntrance>
  );
}

function LandingContent() {
  const { state, me, hydrated } = useStore();
  const { t, f } = useI18n();

  const sample = activityById(state, "a1");

  if (!hydrated) return <Loading />;

  return (
    <div className="landing-page">
      <a href="#main" className="skip-link">
        {t.common.skip}
      </a>
      <header className="landing-header">
        <div className="container">
          <Logo size={36} />
          <nav className="landing-actions" aria-label={t.nav.mainNav}>
            <a href="#how" className="landing-nav-link">
              {t.landing.stepsTitle}
            </a>
            <LanguageSwitch />
            <Link href="/login" className="btn btn-ghost btn-sm">
              {t.landing.login}
            </Link>
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        <section className="container hero">
          <div className="hero-copy">
            <p className="landing-eyebrow">
              <Icon name="leaf" size={18} />
              {t.landing.eyebrow}
            </p>
            <h1>
              {t.landing.title}
              <span>{t.landing.titleAccent}</span>
            </h1>
            <p className="lead">{t.landing.lead}</p>
            <div className="hero-actions">
              {me ? (
                <Link href={HOME_BY_ROLE[me.role]} className="btn btn-block-mobile">
                  {t.landing.continueAs(me.firstName)} <Icon name="arrowRight" size={20} />
                </Link>
              ) : (
                <Link href="/signup" className="btn btn-block-mobile">
                  {t.landing.signup}
                  <Icon name="arrowRight" size={20} />
                </Link>
              )}
              <a href="#how" className="btn btn-secondary">
                {t.landing.discover}
                <Icon name="chevronDown" size={18} />
              </a>
            </div>
            <p className="hero-reassurance">
              <Icon name="check" size={18} />
              {t.landing.reassurance}
            </p>
          </div>

          <LandingPreview>
            <Leaf size={70} style={{ top: -10, left: "4%", transform: "rotate(-20deg)" }} />
            <Leaf size={46} style={{ bottom: 40, right: "2%", color: "var(--sun)", transform: "rotate(40deg)" }} />
            <div className="phone">
              <div className="phone-screen">
                <div className="row-between">
                  <LogoMark size={30} />
                  <span className="chip">{t.nav.activities}</span>
                </div>
                {sample ? (
                  <div className="card preview-activity" style={{ padding: 16, gap: 10 }}>
                    <div className="activity-top">
                      <div className="date-block" style={{ width: 54 }}>
                        <span className="date-day">{new Date(sample.start).getDate()}</span>
                        <span className="date-month">{f.month(sample.start)}</span>
                      </div>
                      <div className="min-0">
                        <h3 style={{ fontSize: "1.02rem" }}>{f.text(sample.title)}</h3>
                        <p className="muted small">{f.date(sample.start)}</p>
                      </div>
                    </div>
                    <span className="btn btn-sm btn-block preview-confirmation">
                      <Icon name="check" size={18} /> {t.activity.imIn}
                    </span>
                  </div>
                ) : null}
                <div className="card card-sage preview-joy" style={{ padding: 14, gap: 6 }}>
                  <div className="row-between">
                    <div className="row" style={{ gap: 8 }}>
                      <Icon name="mic" size={20} />
                      <strong className="small">{t.joy.name}</strong>
                    </div>
                    <span className="preview-wave">
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </span>
                  </div>
                  <p className="small">{t.joy.lead}</p>
                </div>
              </div>
            </div>
            <p className="preview-caption">
              <span />
              {t.landing.previewCaption}
            </p>
          </LandingPreview>
        </section>

        <div className="container">
          <ul className="landing-benefits">
            {(["pin", "users", "heart"] as const).map((icon, i) => (
              <li key={icon}>
                <span className="benefit-icon">
                  <Icon name={icon} size={23} />
                </span>
                <span>{t.landing.benefits[i]}</span>
              </li>
            ))}
          </ul>
        </div>

        <section id="how" className="container landing-how" aria-labelledby="how-title">
          <div className="landing-section-head">
            <div>
              <p className="hand">{t.landing.stepsEyebrow}</p>
              <h2 id="how-title">{t.landing.stepsTitle}</h2>
            </div>
            <p>{t.landing.stepsLead}</p>
          </div>
          <ol className="feature-list">
            {t.landing.steps.map((step, i) => (
              <li key={step.title} className="card feature">
                <div className="feature-top">
                  <span className="feature-symbol">
                    <Icon name={(["mic", "users", "heart"] as const)[i]} size={28} />
                  </span>
                  <span className="feature-step">{t.landing.step(i + 1)}</span>
                </div>
                <h3>{step.title}</h3>
                <p className="muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="container landing-invitation" aria-labelledby="invitation-title">
          <div className="landing-invitation-inner">
            <div className="invitation-copy">
              <p className="landing-eyebrow">{t.landing.forTitle}</p>
              <h2 id="invitation-title">{t.landing.invitationTitle}</h2>
              <p>{t.landing.invitationText}</p>
              <ul className="landing-roles">
                {(["senior", "family", "companion"] as const).map((role) => (
                  <li key={role}>
                    <Icon name="check" size={17} />
                    {t.roles[role]}
                  </li>
                ))}
              </ul>
            </div>
            <Link href={me ? HOME_BY_ROLE[me.role] : "/signup"} className="btn">
              {me ? t.landing.continueAs(me.firstName) : t.landing.signup}
              <Icon name="arrowRight" size={20} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="container landing-footer">
        <div className="row-between">
          <Logo size={28} />
          <p className="hand">{t.common.tagline}</p>
          <Link href="/login">{t.landing.login}</Link>
        </div>
      </footer>
    </div>
  );
}
