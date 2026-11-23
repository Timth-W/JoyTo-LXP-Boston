import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../../app/api/backend/route";
import { signUp } from "../actions";
import { applyBackendAction, isBackendMutationAction } from "../backend-actions";
import { appStateStore, createBackendStore, parseStatePayload } from "../backend";
import { createSession, SESSION_COOKIE } from "../backend-session";
import { toLocalIso } from "../format";
import { createDecemberDemoActivities, createSeed } from "../seed";
import { missionById, missionForCompanion } from "../selectors";
import type { State } from "../types";

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

    await store.transact((draft) =>
      applyBackendAction(draft, "register", { activityId: "a4", seniorId: userId, via: "catalogue" }, userId),
    );
    const persisted = await store.load();

    expect(persisted.users.some((user) => user.id === userId)).toBe(true);
    expect(persisted.registrations.some((registration) => registration.activityId === "a4" && registration.seniorId === userId)).toBe(true);
    expect(isBackendMutationAction("write-state")).toBe(false);
  });

  it("reads JSON payloads returned as either strings or objects", () => {
    const seed = createSeed();

    expect(parseStatePayload(seed)).toEqual(seed);
    expect(parseStatePayload(JSON.stringify(seed))).toEqual(seed);
    expect(parseStatePayload({ ...seed, version: 3 })).toEqual(seed);
    expect(() => parseStatePayload({ version: -1 })).toThrow(/unsupported version or shape/i);
  });

  it("adds missing catalogue entries to a version 4 database and preserves existing records", () => {
    const seed = createSeed();
    const [existing, ...missing] = createDecemberDemoActivities();
    const addedIds = new Set([existing.id, ...missing.map((activity) => activity.id)]);
    const oldActivities = seed.activities.filter((activity) => !addedIds.has(activity.id));
    const updated = { ...existing, capacity: 6 };
    const legacy = { ...seed, version: 4, activities: [...oldActivities, updated] };

    const migrated = parseStatePayload(JSON.stringify(legacy));
    expect(migrated).toEqual({ ...legacy, version: seed.version, activities: [...legacy.activities, ...missing] });
    expect(parseStatePayload(migrated)).toEqual(migrated);
  });

  it("keeps separate browser identities and strips private report fields from the HTTP response", async () => {
    const state = createSeed();
    const mission = state.missions.find((item) => item.seniorId === "u-marie")!;
    mission.visitReport = { summary: "Private outing notes", shareReportWithSenior: false, sharedAt: state.now };
    const load = vi.spyOn(appStateStore, "load").mockResolvedValue(state);
    const transact = vi.spyOn(appStateStore, "transact").mockImplementation(async (mutator) => ({ result: mutator(state), state }));
    const url = "http://localhost/api/backend";
    const login = (userId: string) =>
      POST(new NextRequest(url, { method: "POST", body: JSON.stringify({ action: "login-as-demo", payload: { userId } }) }));
    try {
      const family = await login("u-sophie");
      const senior = await login("u-marie");
      const familyCookie = family.headers.get("set-cookie")!;
      const seniorCookie = senior.headers.get("set-cookie")!;
      expect(familyCookie).toMatch(/HttpOnly/i);
      const familyRes = await GET(new NextRequest(url, { headers: { cookie: familyCookie.split(";")[0] } }));
      const seniorRes = await GET(new NextRequest(url, { headers: { cookie: seniorCookie.split(";")[0] } }));
      expect(await familyRes.json()).toMatchObject({
        state: {
          currentUserId: "u-sophie",
          missions: expect.arrayContaining([expect.objectContaining({ id: mission.id, visitReport: mission.visitReport })]),
        },
      });
      const seniorState = (await seniorRes.json()).state;
      expect(seniorState.currentUserId).toBe("u-marie");
      expect(seniorState.missions.find((item: { id: string }) => item.id === mission.id)).not.toHaveProperty("visitReport");
      expect(seniorState).not.toHaveProperty("sessions");
      const anonymous = await GET(new NextRequest(url));
      expect(anonymous.headers.get("cache-control")).toBe("private, no-store");
      expect((await anonymous.json()).state).toMatchObject({
        currentUserId: null,
        users: [],
        missions: [],
        registrations: [],
        links: [],
        offers: [],
        payments: [],
        giftCards: [],
        notifications: [],
        chats: {},
        activities: state.activities,
      });
    } finally {
      load.mockRestore();
      transact.mockRestore();
    }
  });

  it("unlocks mission details only for the companion whose offer was accepted", async () => {
    const state = createSeed();
    const senior = state.users.find((user) => user.id === "u-paul")!;
    const mission = state.missions.find((item) => item.id === "m1")!;
    const nextSunday = new Date();
    nextSunday.setDate(nextSunday.getDate() + 7 - nextSunday.getDay());
    nextSunday.setHours(9, 45, 0, 0);
    mission.start = toLocalIso(nextSunday);
    mission.note = `Please meet me at ${mission.meetingPoint}`;
    state.missions.push({ ...mission, id: "second-request", meetingPoint: "Another private address", note: "Another private note" });
    const cookie = (id: string) => `${SESSION_COOKIE}=${createSession(state, id, undefined)}`;
    const karim = cookie("u-karim");
    const lea = cookie("u-lea");
    const paul = cookie(senior.id);
    const sophie = cookie("u-sophie");
    const load = vi.spyOn(appStateStore, "load").mockResolvedValue(state);
    const transact = vi.spyOn(appStateStore, "transact").mockImplementation(async (mutator) => ({ result: mutator(state), state }));
    const url = "http://localhost/api/backend";
    const get = async (cookie: string): Promise<State> => (await (await GET(new NextRequest(url, { headers: { cookie } }))).json()).state;
    const post = (cookie: string, action: string, payload: object) =>
      POST(new NextRequest(url, { method: "POST", headers: { cookie }, body: JSON.stringify({ action, payload }) }));

    try {
      const beforeOffer = await get(karim);
      expect(missionById(beforeOffer, mission.id)).toMatchObject({
        meetingPoint: "",
        note: "",
        start: mission.start,
        status: "open",
      });
      expect(beforeOffer.users.find((user) => user.id === senior.id)).toMatchObject({
        firstName: senior.firstName,
        lastName: "",
        interests: senior.interests,
        email: "",
      });
      expect(beforeOffer.users.find((user) => user.id === senior.id)).not.toHaveProperty("inviteCode");
      expect(JSON.stringify(beforeOffer)).not.toContain(mission.meetingPoint);
      expect(JSON.stringify(beforeOffer)).not.toContain(senior.lastName);
      const unrelated = await get(sophie);
      expect(missionById(unrelated, mission.id)).toBeUndefined();
      expect(unrelated.links.every((link) => link.familyId === "u-sophie")).toBe(true);
      expect(unrelated.notifications.every((n) => n.userId === "u-sophie")).toBe(true);
      expect((await get(`${SESSION_COOKIE}=${"0".repeat(64)}`)).missions).toEqual([]);

      const karimOffer = await post(karim, "offer-help", { missionId: mission.id, companionId: "u-karim" });
      expect(karimOffer.status).toBe(200);
      const pending = (await karimOffer.json()).state as State;
      expect(pending.offers).toEqual([expect.objectContaining({ companionId: "u-karim", status: "pending" })]);
      expect(missionById(pending, mission.id)).not.toHaveProperty("seniorLastName");
      expect(JSON.stringify(pending)).not.toContain(mission.meetingPoint);
      expect((await post(lea, "offer-help", { missionId: mission.id, companionId: "u-lea" })).status).toBe(200);

      const offerId = pending.offers[0].id;
      expect((await post(sophie, "accept-offer", { offerId })).ok).toBe(false);
      expect((await post(paul, "accept-offer", { offerId })).status).toBe(200);
      const assigned = await get(karim);
      const assignedMission = missionById(assigned, mission.id)!;
      expect(assignedMission).toMatchObject({ meetingPoint: mission.meetingPoint, seniorLastName: senior.lastName, note: mission.note });
      expect(missionForCompanion(assigned, assignedMission, "u-karim").seniorLastName).toBe(senior.lastName);
      expect(missionById(assigned, "second-request")).not.toHaveProperty("seniorLastName");
      expect(assigned.users.find((user) => user.id === senior.id)?.lastName).toBe("");
      expect(assigned.payments).toEqual([]);
      const declined = await get(lea);
      const declinedMission = missionById(declined, mission.id)!;
      expect(declinedMission.meetingPoint).toBe("");
      expect(declinedMission).not.toHaveProperty("seniorLastName");
      expect(declined.offers).toContainEqual(expect.objectContaining({ missionId: mission.id, companionId: "u-lea", status: "declined" }));
      expect(JSON.stringify(declined)).not.toContain(mission.meetingPoint);

      const linked = await post(sophie, "link-by-code", { familyId: "u-sophie", code: senior.inviteCode, relation: "friend" });
      expect(await linked.json()).toMatchObject({
        result: { seniorId: senior.id },
        state: { missions: expect.arrayContaining([expect.objectContaining({ id: mission.id, meetingPoint: mission.meetingPoint })]) },
      });
    } finally {
      load.mockRestore();
      transact.mockRestore();
    }
  });

  it("restricts profile edits to the account owner and to editable fields", () => {
    const state = createSeed();
    expect(() => applyBackendAction(state, "update-profile", { userId: "u-marie", patch: { firstName: "Changed" } })).toThrow();
    expect(() => applyBackendAction(state, "update-profile", { userId: "u-marie", patch: { firstName: "Changed" } }, "u-karim")).toThrow();
    expect(() =>
      applyBackendAction(state, "update-profile", { userId: "u-karim", patch: { role: "family", passwordHash: "changed" } }, "u-karim"),
    ).toThrow();
    applyBackendAction(state, "update-profile", { userId: "u-karim", patch: { firstName: "Updated" } }, "u-karim");
    expect(state.users.find((user) => user.id === "u-karim")).toMatchObject({ firstName: "Updated", role: "companion" });
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
