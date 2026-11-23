import { promises as fs } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { STATE_VERSION } from "./constants";
import { createDecemberDemoActivities, createSeed } from "./seed";
import type { State } from "./types";

export interface BackendStore {
  load: () => Promise<State>;
  transact: <T>(mutator: (draft: State) => T) => Promise<{ result: T; state: State }>;
  mutate: <T>(mutator: (draft: State) => T) => Promise<T>;
}

function normalizeState(raw: unknown): State {
  if (!raw || typeof raw !== "object") throw new Error("MySQL app_state payload is invalid.");
  const state = raw as State;
  if (
    (state.version !== STATE_VERSION && state.version !== 4 && state.version !== 3) ||
    !Array.isArray(state.users) ||
    !Array.isArray(state.activities) ||
    !Array.isArray(state.registrations) ||
    !Array.isArray(state.missions)
  ) {
    throw new Error("MySQL app_state payload has an unsupported version or shape.");
  }
  if (state.version === STATE_VERSION) return state;
  // Add the new catalogue entries to existing databases, preserving all stored records.
  const existingIds = new Set(state.activities.map((activity) => activity.id));
  const additions = createDecemberDemoActivities().filter((activity) => !existingIds.has(activity.id));
  return { ...state, version: STATE_VERSION, activities: [...state.activities, ...additions] };
}

export function parseStatePayload(payload: unknown): State {
  return normalizeState(typeof payload === "string" ? JSON.parse(payload) : payload);
}

function createTestFileBackendStore(filePath: string): BackendStore {
  let queue = Promise.resolve();
  const ensureDirectory = async () => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  };

  const load = async (): Promise<State> => {
    await ensureDirectory();

    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw) as State;
      return normalizeState(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const fresh = createSeed();
      await persist(fresh);
      return fresh;
    }
  };

  const persist = async (state: State): Promise<void> => {
    await ensureDirectory();
    await fs.writeFile(filePath, JSON.stringify(state, null, 2), "utf-8");
  };

  const transact = async <T>(mutator: (draft: State) => T): Promise<{ result: T; state: State }> => {
    let release!: () => void;
    const previous = queue;
    queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    try {
      const draft = await load();
      const result = mutator(draft);
      await persist(draft);
      return { result, state: draft };
    } finally {
      release();
    }
  };

  const mutate = async <T>(mutator: (draft: State) => T): Promise<T> => (await transact(mutator)).result;

  return { load, transact, mutate };
}

function createMySqlBackendStore(): BackendStore {
  const config = {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "joyto",
  };

  const load = async (): Promise<State> => {
    const connection = await mysql.createConnection(config);

    try {
      const [rows] = await connection.query("SELECT payload FROM app_state WHERE id = 'joyto-state' LIMIT 1");
      const records = Array.isArray(rows) ? rows : [];
      if (records.length > 0) {
        const payload = (records[0] as { payload?: unknown }).payload;
        return parseStatePayload(payload);
      }

      return (await transact(() => undefined)).state;
    } finally {
      await connection.end();
    }
  };

  const transact = async <T>(mutator: (draft: State) => T): Promise<{ result: T; state: State }> => {
    const connection = await mysql.createConnection(config);
    let transactionStarted = false;

    try {
      await connection.beginTransaction();
      transactionStarted = true;
      const initial = JSON.stringify(createSeed());
      await connection.execute(
        "INSERT IGNORE INTO app_state (id, payload, updated_at) VALUES ('joyto-state', ?, NOW())",
        [initial],
      );
      const [rows] = await connection.query("SELECT payload FROM app_state WHERE id = 'joyto-state' LIMIT 1 FOR UPDATE");
      const records = Array.isArray(rows) ? rows : [];
      const draft = parseStatePayload((records[0] as { payload?: unknown } | undefined)?.payload);
      const result = mutator(draft);
      await connection.execute(
        "UPDATE app_state SET payload = ?, updated_at = NOW() WHERE id = 'joyto-state'",
        [JSON.stringify(draft)],
      );
      await connection.commit();
      transactionStarted = false;
      return { result, state: draft };
    } catch (error) {
      if (transactionStarted) await connection.rollback();
      throw error;
    } finally {
      await connection.end();
    }
  };

  const mutate = async <T>(mutator: (draft: State) => T): Promise<T> => (await transact(mutator)).result;

  return { load, transact, mutate };
}

export function createBackendStore(testFilePath?: string): BackendStore {
  if (testFilePath) {
    if (process.env.NODE_ENV !== "test") throw new Error("File-backed storage is only available to automated tests.");
    return createTestFileBackendStore(testFilePath);
  }
  return createMySqlBackendStore();
}

export const appStateStore = createMySqlBackendStore();

export function stateSummary(state: State) {
  return {
    version: state.version,
    now: state.now,
    currentUserId: state.currentUserId,
    users: state.users.length,
    missions: state.missions.length,
    activities: state.activities.length,
    notifications: state.notifications.length,
  };
}
