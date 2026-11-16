import { NextResponse, type NextRequest } from "next/server";
import { appStateStore, stateSummary } from "../../../lib/backend";
import { applyBackendAction, isBackendMutationAction } from "../../../lib/backend-actions";
import { toLocalIso } from "../../../lib/format";
import type { State } from "../../../lib/types";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export async function GET() {
  const state = await appStateStore.load();
  state.now = toLocalIso(new Date());
  return NextResponse.json({ ok: true, summary: stateSummary(state), state });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "");
  if (!isBackendMutationAction(action)) return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });

  try {
    const transaction = await appStateStore.transact((state) => {
      state.now = toLocalIso(new Date());
      return applyBackendAction(state, action, record(body.payload));
    });
    return NextResponse.json({ ok: true, result: transaction.result, state: transaction.state, summary: stateSummary(transaction.state) });
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
