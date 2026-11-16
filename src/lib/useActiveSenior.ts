"use client";

/** For relatives: which linked senior is selected in the current screen session. */
import { useCallback, useState } from "react";
import { seniorsOf } from "./selectors";
import { useStore } from "./store";

export function useActiveSenior() {
  const { state, me } = useStore();
  const seniors = me ? seniorsOf(state, me.id) : [];
  const [chosen, setChosen] = useState<string | null>(null);

  const choose = useCallback((id: string) => setChosen(id), []);

  const senior = seniors.find((u) => u.id === chosen) ?? seniors[0];
  return { seniors, senior, choose };
}
