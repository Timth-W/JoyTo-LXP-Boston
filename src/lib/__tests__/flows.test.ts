import { describe, expect, it, vi } from "vitest";
import {
  acceptOffer,
  cancelMission,
  companionCancel,
  completeMission,
  createMission,
  linkByCode,
  login,
  offerHelp,
  register,
  sendVisitReport,
  signUp,
  toggleDemoTime,
  unlinkFamily,
} from "../actions";
import { generateInviteCode, normalizeInviteCode } from "../auth";
import { eligibleActivities, isCompatible, rankActivities, rankMissions } from "../matching";
import { createSeed } from "../seed";
import { backendView, createSession, removeSession } from "../backend-session";
import {
  companionEarningsMissions,
  familyOf,
  giftMinutesLeft,
  isPastAt,
  missionById,
  missionForCompanion,
  paymentFor,
  seniorsOf,
  userById,
} from "../selectors";
import type { State } from "../types";

const seed = (): State => structuredClone(createSeed());
const newMission = (
  s: State,
  options: { bookedById?: string; sector?: "gardens" | "centre"; autoAcceptVerifiedCompanion?: boolean } = {},
) =>
  createMission(s, {
    seniorId: "u-marie",
    bookedById: "u-marie",
    payerId: "u-marie",
    activityId: "a1",
    type: "activity",
    note: "",
    start: "2026-11-14T14:15",
    durationMin: 150,
    sector: "gardens",
    meetingPoint: "3 Rose Street",
    via: "manual",
    ...options,
  });

describe("accounts", () => {
  it("creates an account, refuses a duplicate email and logs in", () => {
    const s = seed();
    const r = signUp(s, {
      role: "senior",
      email: "New@Mail.com ",
      passwordHash: "h",
      firstName: "Ana",
      lastName: "B",
      sector: "centre",
      interests: [],
    });
    expect(r.ok).toBe(true);
    expect(s.currentUserId).toBe(r.ok ? r.userId : null);
    expect(userById(s, s.currentUserId ?? undefined)?.inviteCode).toMatch(/^JOY-\d{4}$/);
    expect(
      signUp(s, {
        role: "family",
        email: "new@mail.com",
        passwordHash: "h",
        firstName: "X",
        lastName: "Y",
        sector: "centre",
        interests: [],
      }),
    ).toEqual({ ok: false, error: "emailTaken" });
    expect(login(s, "new@mail.com", "wrong").ok).toBe(false);
    expect(login(s, "NEW@mail.com", "h").ok).toBe(true);
  });

  it("links a relative with the invite code and lets either side remove it", () => {
    const s = seed();
    const r = signUp(s, {
      role: "family",
      email: "lucas@mail.com",
      passwordHash: "h",
      firstName: "Lucas",
      lastName: "L",
      sector: "centre",
      interests: [],
      inviteCode: "joy 4821",
      relation: "grandchild",
    });
    expect(r.ok).toBe(true);
    const lucas = r.ok ? r.userId : "";
    expect(familyOf(s, "u-marie").map((u) => u.id)).toContain(lucas);
    expect(linkByCode(s, lucas, "JOY-4821", "grandchild")).toBe("alreadyLinked");
    expect(linkByCode(s, lucas, "JOY-0000", "grandchild")).toBe("code");
    const link = s.links.find((l) => l.familyId === lucas)!;
    unlinkFamily(s, link.id, "u-marie");
    expect(seniorsOf(s, lucas)).toHaveLength(0);
  });

  it("normalises invite codes", () => {
    expect(normalizeInviteCode(" joy-4821 ")).toBe("JOY-4821");
    expect(normalizeInviteCode("4821")).toBe("JOY-4821");
    expect(generateInviteCode(() => 0)).toBe("JOY-1000");
  });
});

describe("matching", () => {
  it("moves an outing to past once its scheduled start is reached", () => {
    const now = new Date("2026-11-16T12:00:00");

    expect(isPastAt("2026-11-13T17:00", now)).toBe(true);
    expect(isPastAt("2026-11-16T12:00", now)).toBe(false);
    expect(isPastAt("2026-11-17T10:00", now)).toBe(false);
  });

  it("does not offer activities that have already started in real time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-16T12:00:00"));
    try {
      const s = seed();
      const marie = userById(s, "u-marie")!;
      const eligibleIds = eligibleActivities(s, marie).map((activity) => activity.id);

      expect(eligibleIds).not.toContain("a2");
      expect(eligibleIds).not.toContain("a1");
      expect(eligibleIds).not.toContain("a3");
      expect(eligibleIds).not.toContain("a10");
      expect(eligibleIds).toContain("a4");
    } finally {
      vi.useRealTimers();
    }
  });

  it("only suggests future activities with seats, Marie gets gardening first", () => {
    const s = seed();
    const marie = userById(s, "u-marie")!;
    const ranked = rankActivities(s, marie);
    expect(ranked.every((r) => r.item.start > s.now)).toBe(true);
    expect(ranked[0].item.category).toBe("gardening");
    register(s, ranked[0].item.id, marie.id, "assistant");
    expect(rankActivities(s, marie).map((r) => r.item.id)).not.toContain(ranked[0].item.id);
  });

  it("offers outings only to companions in the area and free at that time", () => {
    const s = seed();
    const m = s.missions.find((x) => x.id === "m1")!;
    expect(isCompatible(s, m, userById(s, "u-karim")!)).toBe(true); // centre, free on Sunday morning
    expect(isCompatible(s, m, userById(s, "u-tom")!)).toBe(false); // not free on Sunday morning
    expect(rankMissions(s, userById(s, "u-lea")!).map((r) => r.item.id)).toContain("m1");
  });
});

describe("accompanied outing lifecycle", () => {
  it("holds the payment, hides private data, then captures it", () => {
    const s = seed();
    const id = newMission(s);
    expect(giftMinutesLeft(s, "u-marie")).toBe(150);
    expect(paymentFor(s, id)).toMatchObject({ status: "authorized", giftMinutes: 150, cardCents: 0 });
    expect(s.notifications.some((n) => n.userId === "u-sophie" && n.type === "seniorBooked")).toBe(true);

    offerHelp(s, id, "u-karim");
    const m = s.missions.find((x) => x.id === id)!;
    expect(missionForCompanion(s, m, "u-karim").meetingPoint).toBeNull();
    acceptOffer(s, s.offers.find((o) => o.missionId === id)!.id);
    expect(missionForCompanion(s, m, "u-karim").meetingPoint).toBe("3 Rose Street");

    toggleDemoTime(s);
    completeMission(s, id);
    expect(paymentFor(s, id)?.status).toBe("captured");
  });

  it("refunds and restores the gift credit at exactly 24 hours", () => {
    const s = seed();
    const id = newMission(s);
    s.now = "2026-11-13T14:15";
    cancelMission(s, id, "ill");
    expect(paymentFor(s, id)?.status).toBe("refunded");
    expect(giftMinutesLeft(s, "u-marie")).toBe(300);
  });

  it("charges a late client cancellation only once and includes it in the assigned companion's earnings", () => {
    const s = seed();
    const id = newMission(s);
    offerHelp(s, id, "u-karim");
    acceptOffer(s, s.offers.find((o) => o.missionId === id)!.id);
    s.now = "2026-11-13T14:15:01";
    expect(() => cancelMission(s, id, "", false)).toThrow();
    expect(missionById(s, id)?.status).toBe("confirmed");
    cancelMission(s, id, "ill", true);
    const notificationCount = s.notifications.length;
    cancelMission(s, id, "ill", true);
    expect(missionById(s, id)).toMatchObject({ status: "cancelled", lateCancel: true });
    expect(paymentFor(s, id)?.status).toBe("captured");
    expect(giftMinutesLeft(s, "u-marie")).toBe(150);
    expect(companionEarningsMissions(s, "u-karim").some((m) => m.id === id)).toBe(true);
    expect(s.notifications).toHaveLength(notificationCount);
  });

  it("closes the outing and refunds the full payment once when the confirmed companion cancels", () => {
    const s = seed();
    s.giftCards.find((card) => card.seniorId === "u-marie")!.minutesLeft = 60;
    const id = newMission(s);
    offerHelp(s, id, "u-karim");
    acceptOffer(s, s.offers.find((o) => o.missionId === id)!.id);
    s.now = "2026-11-14T13:15";
    companionCancel(s, id, "u-karim", "exam");
    companionCancel(s, id, "u-karim", "exam");
    expect(missionById(s, id)?.status).toBe("cancelled");
    expect(paymentFor(s, id)).toMatchObject({ status: "refunded", giftMinutes: 60, cardCents: 3750 });
    expect(giftMinutesLeft(s, "u-marie")).toBe(60);
    expect(s.offers.find((o) => o.missionId === id)?.status).toBe("withdrawn");
    expect(rankMissions(s, userById(s, "u-karim")!).some(({ item }) => item.id === id)).toBe(false);
    expect(
      s.notifications
        .filter((n) => n.type === "companionCancelled" && n.params.missionId === id)
        .map((n) => n.userId)
        .sort(),
    ).toEqual(["u-marie", "u-sophie"]);
  });

  it("confirms at most one eligible verified companion on an automatic family request", () => {
    const s = seed();
    userById(s, "u-lea")!.availability.push("sat-pm");
    const id = newMission(s, { bookedById: "u-sophie", sector: "centre" });
    expect(missionById(s, id)?.autoAcceptVerifiedCompanion).toBe(true);
    offerHelp(s, id, "u-tom");
    expect(missionById(s, id)?.status).toBe("open");
    offerHelp(s, id, "u-karim");
    offerHelp(s, id, "u-lea");
    expect(missionById(s, id)?.status).toBe("confirmed");
    expect(s.offers.filter((o) => o.missionId === id && o.status === "accepted").map((o) => o.companionId)).toEqual(["u-karim"]);
    const manual = newMission(s, { bookedById: "u-sophie", autoAcceptVerifiedCompanion: false });
    offerHelp(s, manual, "u-karim");
    expect(missionById(s, manual)?.status).toBe("open");
  });

  it.each([false, true])("shares an outing report only with authorized sessions (senior opt-in = %s)", (shareWithSenior) => {
    const s = seed();
    const id = newMission(s);
    offerHelp(s, id, "u-karim");
    acceptOffer(s, s.offers.find((o) => o.missionId === id)!.id);
    expect(() => sendVisitReport(s, id, "u-karim", "In progress", shareWithSenior)).toThrow();
    toggleDemoTime(s);
    completeMission(s, id);
    expect(() => sendVisitReport(s, id, "u-lea", "Not assigned", shareWithSenior)).toThrow();
    sendVisitReport(s, id, "u-karim", "A pleasant walk", shareWithSenior);
    sendVisitReport(s, id, "u-karim", "Retry", !shareWithSenior);
    const seniorToken = createSession(s, "u-marie", undefined);
    const familyToken = createSession(s, "u-sophie", undefined);
    const strangerToken = createSession(s, "u-lea", undefined);
    s.currentUserId = "u-sophie"; // The old shared field cannot authorize another browser.
    expect(missionById(backendView(s, undefined), id)?.visitReport).toBeUndefined();
    expect(missionById(backendView(s, strangerToken), id)?.visitReport).toBeUndefined();
    expect(missionById(backendView(s, familyToken), id)?.visitReport?.summary).toBe("A pleasant walk");
    expect(missionById(backendView(s, seniorToken), id)?.visitReport?.summary).toBe(shareWithSenior ? "A pleasant walk" : undefined);
    removeSession(s, familyToken);
    expect(missionById(backendView(s, familyToken), id)?.visitReport).toBeUndefined();
  });
});
