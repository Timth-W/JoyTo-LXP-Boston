"use client";

/** Client mirror of the shared server state; all persistent mutations go through the backend API. */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { STATE_VERSION } from "./constants";
import type { BackendMutationAction, BackendMutationPayloads, BackendMutationResult } from "./backend-contract";
import { currentUser, outingConfirmationAfter, type OutingConfirmation } from "./selectors";
import type { State, User } from "./types";

function emptyState(): State {
  return {
    version: STATE_VERSION,
    now: new Date().toISOString().slice(0, 16),
    currentUserId: null,
    users: [],
    links: [],
    activities: [],
    registrations: [],
    missions: [],
    offers: [],
    payments: [],
    giftCards: [],
    notifications: [],
    chats: {},
    seq: 100,
  };
}

interface StoreValue {
  state: State;
  /** False during the first render, before the saved data is read: screens wait for it. */
  hydrated: boolean;
  me: User | undefined;
  requestError: boolean;
  clearRequestError: () => void;
  outingConfirmation: OutingConfirmation | null;
  dismissOutingConfirmation: () => void;
  mutate: <A extends BackendMutationAction>(action: A, payload: BackendMutationPayloads[A]) => Promise<BackendMutationResult<A>>;
  reset: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

async function load(): Promise<State | null> {
  try {
    for (const key of ["joyto-state", "joyto-locale", "joyto-active-senior"]) localStorage.removeItem(key);
  } catch {
    // The database remains usable when browser storage is disabled.
  }

  try {
    const response = await fetch("/api/backend", { cache: "no-store" });
    if (!response.ok) throw new Error("Backend unavailable");
    const payload = (await response.json()) as { state?: State };
    const saved = payload.state;
    return saved && saved.version === STATE_VERSION ? saved : null;
  } catch {
    return null;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const [requestError, setRequestError] = useState(false);
  const [outingConfirmation, setOutingConfirmation] = useState<OutingConfirmation | null>(null);
  /** Always the latest state, so that two actions in a row never work on stale data. */
  const ref = useRef(state);

  const commit = useCallback((next: State) => {
    ref.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    void (async () => {
      const saved = await load();
      if (saved) commit(saved);
      else setRequestError(true);
      setHydrated(true);
    })();
  }, [commit]);

  const mutate = useCallback(
    async <A extends BackendMutationAction>(action: A, payload: BackendMutationPayloads[A]): Promise<BackendMutationResult<A>> => {
      try {
        const response = await fetch("/api/backend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, payload }),
        });
        const result = (await response.json().catch(() => null)) as { ok?: boolean; result?: unknown; state?: State } | null;
        if (!response.ok || !result?.ok || !result.state) throw new Error("Backend mutation failed");
        const confirmation = outingConfirmationAfter(ref.current, result.state, action, result.result, payload);
        commit(result.state);
        if (confirmation) setOutingConfirmation(confirmation);
        else if (action === "logout" || action === "reset-demo") setOutingConfirmation(null);
        setRequestError(false);
        return result.result as BackendMutationResult<A>;
      } catch (error) {
        setRequestError(true);
        throw error;
      }
    },
    [commit],
  );

  const clearRequestError = useCallback(() => setRequestError(false), []);
  const dismissOutingConfirmation = useCallback(() => setOutingConfirmation(null), []);
  const reset = useCallback(() => mutate("reset-demo", {}), [mutate]);

  return (
    <StoreContext.Provider
      value={{
        state,
        hydrated,
        me: currentUser(state),
        requestError,
        clearRequestError,
        outingConfirmation,
        dismissOutingConfirmation,
        mutate,
        reset,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>.");
  return ctx;
}
