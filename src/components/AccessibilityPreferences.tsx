"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n";

const KEY = "joyto-accessibility";
const Preferences = createContext({
  larger: false,
  reduced: false,
  setLarger: (_value: boolean) => {},
  setReduced: (_value: boolean) => {},
});

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [larger, setLarger] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
      setLarger(saved?.larger === true);
      setReduced(saved?.reduced === true);
    } catch {
      // Preferences also work for the current session when storage is unavailable.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    document.documentElement.toggleAttribute("data-larger-text", larger);
    document.documentElement.toggleAttribute("data-reduce-motion", reduced);
    try {
      localStorage.setItem(KEY, JSON.stringify({ larger, reduced }));
    } catch {
      // Browser storage is optional.
    }
  }, [larger, reduced, loaded]);

  return <Preferences.Provider value={{ larger, reduced, setLarger, setReduced }}>{children}</Preferences.Provider>;
}

export function AccessibilityPreferences() {
  const { t } = useI18n();
  const { larger, reduced, setLarger, setReduced } = useContext(Preferences);
  return (
    <div className="card preferences-panel">
      <fieldset className="field">
        <legend>{t.mobile.textSize}</legend>
        <div className="toggle-chips">
          <label className="toggle-chip">
            <input type="radio" name="text-size" checked={!larger} onChange={() => setLarger(false)} /> {t.mobile.standard}
          </label>
          <label className="toggle-chip">
            <input type="radio" name="text-size" checked={larger} onChange={() => setLarger(true)} /> {t.mobile.larger}
          </label>
        </div>
      </fieldset>
      <label className="preference-option">
        <input type="checkbox" checked={reduced} onChange={(event) => setReduced(event.currentTarget.checked)} /> {t.mobile.reduceMotion}
      </label>
    </div>
  );
}
