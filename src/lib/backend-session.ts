import { createHash, randomBytes } from "node:crypto";
import { userById, visitReportFor } from "./selectors";
import type { State } from "./types";

export const SESSION_COOKIE = "joyto_session";
export const SESSION_SECONDS = 30 * 24 * 60 * 60;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionActor(state: State, token: string | undefined) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return undefined;
  const hash = hashToken(token);
  const session = state.sessions?.find((entry) => entry.tokenHash === hash && entry.expiresAt > Date.now());
  return userById(state, session?.userId);
}

export function removeSession(state: State, token: string | undefined) {
  if (!token) return;
  const hash = hashToken(token);
  state.sessions = state.sessions?.filter((entry) => entry.tokenHash !== hash);
}

export function createSession(state: State, userId: string, previousToken: string | undefined) {
  removeSession(state, previousToken);
  const now = Date.now();
  const token = randomBytes(32).toString("hex");
  state.sessions = (state.sessions ?? []).filter((entry) => entry.expiresAt > now);
  state.sessions.push({ tokenHash: hashToken(token), userId, expiresAt: now + SESSION_SECONDS * 1000 });
  return token;
}

export function backendView(state: State, token: string | undefined): State {
  const viewer = sessionActor(state, token);
  return {
    ...state,
    sessions: undefined,
    currentUserId: viewer?.id ?? null,
    users: state.users.map((user) => ({ ...user, passwordHash: "", inviteCode: user.id === viewer?.id ? user.inviteCode : undefined })),
    missions: state.missions.map((mission) => ({ ...mission, visitReport: visitReportFor(state, mission, viewer) })),
    notifications: state.notifications.filter(
      (notification) => notification.type !== "visitReportReady" || notification.userId === viewer?.id,
    ),
  };
}
