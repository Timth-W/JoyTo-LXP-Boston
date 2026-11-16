import { promises as fs } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { createSeed } from "./seed";
import type { State } from "./types";

export interface BackendStore {
  load: () => Promise<State>;
  save: (state: State) => Promise<State>;
  mutate: <T>(mutator: (draft: State) => T) => Promise<T>;
}

function normalizeState(raw: unknown): State {
  const state = raw as State;
  return state && state.version === createSeed().version ? state : createSeed();
}

export function parseStatePayload(payload: unknown): State {
  return normalizeState(typeof payload === "string" ? JSON.parse(payload) : payload);
}

export function mergeStateUsers(current: State, incoming: State): State {
  const users = new Map(current.users.map((user) => [user.id, user]));
  for (const user of incoming.users) users.set(user.id, user);
  return { ...incoming, users: [...users.values()] };
}

function createFileBackendStore(filePath = path.join(process.cwd(), ".data", "joyto-state.json")): BackendStore {
  const ensureDirectory = async () => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  };

  const load = async (): Promise<State> => {
    await ensureDirectory();

    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw) as State;
      return normalizeState(parsed);
    } catch {
      const fresh = createSeed();
      await save(fresh);
      return fresh;
    }
  };

  const save = async (state: State): Promise<State> => {
    await ensureDirectory();
    await fs.writeFile(filePath, JSON.stringify(state, null, 2), "utf-8");
    return state;
  };

  const mutate = async <T>(mutator: (draft: State) => T): Promise<T> => {
    const draft = await load();
    const result = mutator(draft);
    await save(draft);
    return result;
  };

  return { load, save, mutate };
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

      const fresh = createSeed();
      await save(fresh);
      return fresh;
    } finally {
      await connection.end();
    }
  };

  const save = async (state: State): Promise<State> => {
    const connection = await mysql.createConnection(config);
    let transactionStarted = false;

    try {
      await connection.beginTransaction();
      transactionStarted = true;
      const [rows] = await connection.query("SELECT payload FROM app_state WHERE id = 'joyto-state' LIMIT 1 FOR UPDATE");
      const records = Array.isArray(rows) ? rows : [];
      const current = records.length ? parseStatePayload((records[0] as { payload?: unknown }).payload) : null;
      const saved = current ? mergeStateUsers(current, state) : state;
      await connection.execute(
        "INSERT INTO app_state (id, payload, updated_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = NOW()",
        ["joyto-state", JSON.stringify(saved)],
      );
      await connection.commit();
      transactionStarted = false;
      return saved;
    } catch (error) {
      if (transactionStarted) await connection.rollback();
      throw error;
    } finally {
      await connection.end();
    }
  };

  const mutate = async <T>(mutator: (draft: State) => T): Promise<T> => {
    const draft = await load();
    const result = mutator(draft);
    await save(draft);
    return result;
  };

  return { load, save, mutate };
}

export function createBackendStore(filePath = path.join(process.cwd(), ".data", "joyto-state.json")): BackendStore {
  const mysqlEnabled = process.env.NODE_ENV !== "test" && (process.env.USE_LOCAL_DB !== "false" || Boolean(process.env.DB_HOST || process.env.DB_NAME || process.env.DB_USER || process.env.DB_PASSWORD || process.env.DB_PORT));
  return mysqlEnabled ? createMySqlBackendStore() : createFileBackendStore(filePath);
}

export const appStateStore = createBackendStore();

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
