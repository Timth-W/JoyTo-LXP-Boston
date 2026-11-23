import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeFormatters } from "@/i18n";
import { en } from "@/i18n/en";
import { fr } from "@/i18n/fr";
import { register } from "../actions";
import { joyMoodProposals, proposalsFor } from "../joy/proposals";
import { greeting, when } from "../joy/script";
import { createSeed } from "../seed";
import { userById } from "../selectors";
import type { State } from "../types";

const seed = (): State => structuredClone(createSeed());
const EN = { t: en, f: makeFormatters("en", en), locale: "en" as const };
const FR = { t: fr, f: makeFormatters("fr", fr), locale: "fr" as const };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-12T10:00:00"));
});

afterEach(() => vi.useRealTimers());

describe("Joy proposals", () => {
  it("reminds Marie of tomorrow and suggests activities and a companion", () => {
    const s = seed();
    const marie = userById(s, "u-marie")!;
    const ids = proposalsFor(s, marie).map((p) => p.id);
    expect(ids[0]).toBe("upcoming:a10");
    expect(ids).toContain("join:a1");
    expect(ids.some((id) => id.startsWith("book:"))).toBe(true);
  });

  it("drops an activity once the senior has signed up", () => {
    const s = seed();
    const marie = userById(s, "u-marie")!;
    register(s, "a1", marie.id, "assistant");
    expect(proposalsFor(s, marie).map((p) => p.id)).not.toContain("join:a1");
  });

  it("prioritizes a gentler outing after a low check-in while respecting registrations and capacity", () => {
    const s = seed();
    const marie = userById(s, "u-marie")!;
    s.activities = s.activities.filter((activity) => ["a1", "a2"].includes(activity.id));
    s.registrations = [];
    expect(joyMoodProposals(s, marie, "low").map((proposal) => proposal.id)).toEqual(["join:a1"]);
    register(s, "a1", marie.id, "catalogue");
    expect(joyMoodProposals(s, marie, "low").map((proposal) => proposal.id)).toEqual(["join:a2"]);
    s.activities.find((activity) => activity.id === "a2")!.capacity = 0;
    expect(joyMoodProposals(s, marie, "low")).toEqual([]);
  });

  it("talks to relatives about their loved one and to companions about missions", () => {
    const s = seed();
    const sophie = userById(s, "u-sophie")!;
    expect(proposalsFor(s, sophie).every((p) => !("seniorId" in p) || p.seniorId === "u-marie")).toBe(true);
    expect(proposalsFor(s, userById(s, "u-karim")!).map((p) => p.id)).toContain("mission:m1");
  });

  it("opens with one short question even when several proposals are available", () => {
    const s = seed();
    const marie = userById(s, "u-marie")!;
    const list = proposalsFor(s, marie);
    expect(list.length).toBeGreaterThan(1);
    expect(greeting(s, marie, list, EN)).toBe("Hello Marie! What would you like to do?");
    expect(greeting(s, marie, list, FR)).toBe("Bonjour Marie ! Qu’aimeriez-vous faire ?");
    expect(greeting(s, marie, [], EN)).toBe("Hello Marie! What would you like to do?");
  });

  it("formats dates and times in both languages", () => {
    const s = seed();
    expect(when("2026-11-14T14:30", s.now, EN).replace(/\s/g, " ")).toBe("on Saturday at 2:30 pm");
    expect(when("2026-11-28T14:00", s.now, FR)).toBe("le samedi 28 novembre à 14 h");
  });
});
