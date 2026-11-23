"use client";

import type { ReactNode } from "react";
import { I18nProvider } from "@/i18n";
import { StoreProvider } from "@/lib/store";
import { useI18n } from "@/i18n";
import { useStore } from "@/lib/store";
import { Icon } from "@/components/Icon";
import { OutingCelebration } from "@/components/OutingCelebration";
import { AccessibilityProvider } from "@/components/AccessibilityPreferences";

function BackendRequestNotice() {
  const { requestError, clearRequestError } = useStore();
  const { t } = useI18n();
  if (!requestError) return null;

  return (
    <div className="notice notice-warn container" role="alert" style={{ marginTop: 16 }}>
      <Icon name="alert" />
      <p>{t.auth.errors.backend}</p>
      <button type="button" className="icon-btn" aria-label={t.common.close} onClick={clearRequestError}>
        <Icon name="close" />
      </button>
    </div>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <AccessibilityProvider>
        <StoreProvider>
          <BackendRequestNotice />
          {children}
          <OutingCelebration />
        </StoreProvider>
      </AccessibilityProvider>
    </I18nProvider>
  );
}
