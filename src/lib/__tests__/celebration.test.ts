import { describe, expect, it } from "vitest";
import { outingConfirmationAfter } from "../selectors";
import { createSeed } from "../seed";

function fixture() {
  const state = createSeed();
  state.registrations = [];
  state.missions = [];
  return state;
}

const target = { activityId: "a1", seniorId: "u-marie" };

describe("outing confirmation feedback", () => {
  it("celebrates only a newly saved registration for the submitted activity and senior", () => {
    const before = fixture();
    const after = structuredClone(before);
    after.registrations.push({ id: "new", ...target, via: "catalogue" });
    expect(outingConfirmationAfter(before, after, "register", undefined, target)).toEqual({ kind: "activity", ...target });
    expect(outingConfirmationAfter(after, after, "register", undefined, target)).toBeNull();
  });

  it("does not celebrate a rejected registration or another person's concurrent registration", () => {
    const before = fixture();
    const after = structuredClone(before);
    after.registrations.push({ id: "other", ...target, seniorId: "someone-else", via: "catalogue" });
    expect(outingConfirmationAfter(before, before, "register", undefined, target)).toBeNull();
    expect(outingConfirmationAfter(before, after, "register", undefined, target)).toBeNull();
  });

  it("does not celebrate hydration, cancellation, profile saves or missing activities", () => {
    const before = fixture();
    const after = structuredClone(before);
    after.registrations.push({ id: "new", ...target, via: "catalogue" });
    for (const action of ["load", "unregister", "update-profile"]) {
      expect(outingConfirmationAfter(before, after, action, undefined, target)).toBeNull();
    }
    after.activities = [];
    expect(outingConfirmationAfter(before, after, "register", undefined, target)).toBeNull();
  });

  it("identifies a newly published companion request without treating it as an accepted booking", () => {
    const before = fixture();
    const after = structuredClone(before);
    const mission = { ...createSeed().missions[0], id: "new-request", seniorId: target.seniorId, status: "open" as const };
    after.missions.push(mission);
    expect(outingConfirmationAfter(before, after, "create-mission", mission.id, { seniorId: mission.seniorId })).toEqual({
      kind: "request",
      missionId: mission.id,
      seniorId: mission.seniorId,
    });
    expect(outingConfirmationAfter(after, after, "create-mission", mission.id, { seniorId: mission.seniorId })).toBeNull();
    expect(outingConfirmationAfter(before, after, "create-mission", "missing", { seniorId: mission.seniorId })).toBeNull();
    expect(outingConfirmationAfter(before, after, "create-mission", mission.id, { seniorId: "someone-else" })).toBeNull();
  });
});
