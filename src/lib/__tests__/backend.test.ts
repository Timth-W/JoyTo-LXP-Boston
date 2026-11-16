import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { signUp } from "../actions";
import { applyBackendAction, isBackendMutationAction } from "../backend-actions";
import { createBackendStore, parseStatePayload } from "../backend";
import { createSeed } from "../seed";

const files: string[] = [];

afterEach(() => {
  for (const file of files.splice(0)) {
    try {
      rmSync(file, { force: true });
    } catch {
      // ignore cleanup errors for test temp files
    }
  }
});

describe("server-side state store", () => {
  it("dispatches account and activity mutations through persisted backend transactions", async () => {
    const dir = mkdtempSync(join(tmpdir(), "joyto-backend-flow-"));
    const file = join(dir, "state.json");
    files.push(file);

    const store = createBackendStore(file);
    const signup = await store.transact((draft) =>
      applyBackendAction(draft, "signup", {
        role: "senior",
        email: "server-flow@test.local",
        passwordHash: "test-hash",
        firstName: "Server",
        lastName: "Flow",
        sector: "centre",
        interests: [],
      }),
    );
    expect(signup.result).toMatchObject({ ok: true });
    if (!signup.result || typeof signup.result !== "object" || !("userId" in signup.result)) throw new Error("Signup failed");
    const userId = String(signup.result.userId);

    await store.transact((draft) => applyBackendAction(draft, "register", { activityId: "a4", seniorId: userId, via: "catalogue" }));
    const persisted = await store.load();

    expect(persisted.users.some((user) => user.id === userId)).toBe(true);
    expect(persisted.registrations.some((registration) => registration.activityId === "a4" && registration.seniorId === userId)).toBe(true);
    expect(isBackendMutationAction("write-state")).toBe(false);
  });

  it("reads JSON payloads returned as either strings or objects", () => {
    const seed = createSeed();

    expect(parseStatePayload(seed)).toEqual(seed);
    expect(parseStatePayload(JSON.stringify(seed))).toEqual(seed);
    expect(() => parseStatePayload({ version: -1 })).toThrow(/unsupported version or shape/i);
  });

  it("persists the app state and keeps the signup flow valid on the backend layer", async () => {
    const dir = mkdtempSync(join(tmpdir(), "joyto-backend-"));
    const file = join(dir, "state.json");
    files.push(file);

    const store = createBackendStore(file);
    const result = await store.mutate((draft) => {
      const res = signUp(draft, {
        role: "senior",
        email: "backend@test.com",
        passwordHash: "demo-hash",
        firstName: "Backend",
        lastName: "User",
        sector: "centre",
        interests: ["culture"],
      });
      return res;
    });

    expect(result.ok).toBe(true);

    const persisted = await store.load();
    expect(persisted.users.some((user) => user.email === "backend@test.com")).toBe(true);
    expect(persisted.currentUserId).toBe(result.ok ? result.userId : null);
  });

  it("serializes concurrent backend mutations without losing either account", async () => {
    const dir = mkdtempSync(join(tmpdir(), "joyto-backend-concurrent-"));
    const file = join(dir, "state.json");
    files.push(file);

    const store = createBackendStore(file);
    const createAccount = (email: string) =>
      store.transact((draft) =>
        signUp(draft, {
          role: "senior",
          email,
          passwordHash: "test-hash",
          firstName: "Concurrent",
          lastName: "User",
          sector: "centre",
          interests: [],
        }),
      );

    const results = await Promise.all([createAccount("one@test.local"), createAccount("two@test.local")]);
    const persisted = await store.load();

    expect(results.every(({ result }) => result.ok)).toBe(true);
    expect(new Set(results.map(({ result }) => (result.ok ? result.userId : ""))).size).toBe(2);
    expect(persisted.users.map((user) => user.email)).toEqual(expect.arrayContaining(["one@test.local", "two@test.local"]));
  });
});
