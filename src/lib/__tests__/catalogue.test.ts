import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogueActivities } from "../selectors";
import { createSeed } from "../seed";

afterEach(() => vi.useRealTimers());

function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-16T12:00:00"));
  const state = createSeed();
  const base = state.activities[0];
  state.activities = [
    {
      ...base,
      id: "later",
      start: "2026-11-20T10:00",
      category: "culture" as const,
      title: { en: "Museum visit", fr: "Visite du musée" },
      place: { en: "Town hall", fr: "Hôtel de ville" },
    },
    { ...base, id: "past", start: "2026-11-15T10:00" },
    { ...base, id: "sooner", start: "2026-11-17T10:00", category: "cooking" as const, title: "Soup", place: "Gardens" },
  ];
  return state;
}

describe("activity catalogue", () => {
  it("uses the real date, returns soonest first and does not reorder stored activities", () => {
    const state = fixture();
    state.now = "2026-11-01T10:00";
    expect(catalogueActivities(state, "all", "", "en").map((a) => a.id)).toEqual(["sooner", "later"]);
    expect(state.activities.map((a) => a.id)).toEqual(["later", "past", "sooner"]);
  });

  it("combines category with a localized search across names and places, ignoring accents and case", () => {
    const state = fixture();
    expect(catalogueActivities(state, "culture", " MUSEE  HOTEL ", "fr").map((a) => a.id)).toEqual(["later"]);
    expect(catalogueActivities(state, "cooking", "museum", "en")).toEqual([]);
    expect(catalogueActivities(state, "all", "museum", "fr")).toEqual([]);
    expect(catalogueActivities(state, "all", "museum town", "en").map((a) => a.id)).toEqual(["later"]);
  });

  it("keeps full and already joined activities visible so their status can be shown", () => {
    const state = fixture();
    state.activities.find((a) => a.id === "sooner")!.capacity = 0;
    state.registrations.push({ id: "joined", activityId: "later", seniorId: "u-marie", via: "catalogue" });
    expect(catalogueActivities(state, "all", "   ", "en").map((a) => a.id)).toEqual(["sooner", "later"]);
  });
});
