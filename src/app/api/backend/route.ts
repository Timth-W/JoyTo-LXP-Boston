import { NextResponse, type NextRequest } from "next/server";
import { appStateStore, stateSummary } from "../../../lib/backend";
import { applyBackendAction, isBackendMutationAction } from "../../../lib/backend-actions";
import { backendView, createSession, removeSession, SESSION_COOKIE, SESSION_SECONDS, sessionActor } from "../../../lib/backend-session";
import { toLocalIso } from "../../../lib/format";
import type { State } from "../../../lib/types";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export async function GET(request: NextRequest) {
  const state = await appStateStore.load();
  state.now = toLocalIso(new Date());
  const view = backendView(state, request.cookies.get(SESSION_COOKIE)?.value);
  return respond(view);
}

function respond(state: State, result?: unknown) {
  return NextResponse.json(
    { ok: true, summary: stateSummary(state), state, result },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "");
  if (!isBackendMutationAction(action)) return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const input = record(body.payload);
  try {
    const transaction = await appStateStore.transact((state) => {
      const now = new Date();
      state.now = toLocalIso(now);
      const actor = sessionActor(state, token);
      const result = applyBackendAction(state, action, input, actor?.id, now.toISOString());
      if (action === "logout") removeSession(state, token);

      const loggedIn = (action === "login" || action === "signup") && record(result).ok === true;
      const loggedInAsDemo = action === "login-as-demo" && state.users.some((user) => user.id === input.userId && user.demo);
      const nextToken = (loggedIn || loggedInAsDemo) && state.currentUserId ? createSession(state, state.currentUserId, token) : undefined;
      const safeResult = action === "login" && loggedIn ? { ok: true, user: { ...record(record(result).user), passwordHash: "" } } : result;
      return { result: safeResult, nextToken };
    });
    const { result, nextToken } = transaction.result;
    const response = respond(backendView(transaction.state, action === "logout" ? undefined : (nextToken ?? token)), result);
    if (nextToken || action === "logout") {
      response.cookies.set(SESSION_COOKIE, nextToken ?? "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: nextToken ? SESSION_SECONDS : 0,
      });
    }
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 },
    );
  }
}

export type BackendStateEnvelope = {
  ok: boolean;
  state?: State;
  summary?: ReturnType<typeof stateSummary>;
  result?: unknown;
  error?: string;
};
