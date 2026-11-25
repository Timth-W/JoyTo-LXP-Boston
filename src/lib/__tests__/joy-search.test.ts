import { afterEach, describe, expect, it, vi } from "vitest";
import { demoAssistant } from "../ai/demo";
import { buildUserContent } from "../ai/prompt";
import type { AssistantRequest, Candidate } from "../ai/schema";
import { joyActivitySearchSchema } from "../joy/realtime";
import { rankActivitySearch } from "../matching";
import { createSeed } from "../seed";

const candidates: Candidate[] = [
  { id: "rose", title: "Taille des rosiers", category: "gardening", start: "2026-11-28T14:00" },
  { id: "choir", title: "Chorale des voisins", category: "music", start: "2026-11-28T10:00" },
  { id: "jazz", title: "Concert de jazz", category: "music", start: "2026-11-28T19:00" },
  {
    id: "concert",
    title: "Concert acoustique",
    category: "music",
    start: "2026-12-09T16:00",
    description: "Un duo de guitare et de violon.",
  },
  { id: "walk", title: "Balade dans le parc", category: "walk", start: "2026-11-28T15:00" },
].map((activity) => ({ ...activity, place: "Private test address", seatsLeft: 1, attendees: [] }) as Candidate);

function request(message: string, previous: string[] = [], locale: AssistantRequest["locale"] = "fr"): AssistantRequest {
  return {
    locale,
    today: "2026-11-25T12:00",
    message,
    history: previous.map((text) => ({ from: "user", text })),
    profile: { firstName: "Marie", interests: ["gardening"], availability: ["sat-pm"], sector: "gardens" },
    candidates,
  };
}

const ids = (req: AssistantRequest) => demoAssistant(req).suggestions.map(({ activityId }) => activityId);

afterEach(() => vi.useRealTimers());

describe("Joy's activity search", () => {
  it("uses the conversation before the profile and keeps the subject when the user adds a constraint", () => {
    expect(ids(request("Je veux écouter de la musique"))).toEqual(["jazz", "choir", "concert"]);
    expect(ids(request("Et samedi matin ?", ["De la musique"]))).toEqual(["choir"]);
    expect(ids(request("Et samedi après-midi ?", ["De la musique"]))).toEqual([]);
    expect(ids(request("Plutôt une balade", ["De la musique", "Samedi après-midi"]))).toEqual(["walk"]);
    expect(ids(request("Une autre activité ?", ["De la musique", "Samedi matin"]))).toEqual(["choir"]);
  });

  it("handles exclusions, specific interests, and a date or time that changes the request", () => {
    expect(ids(request("Pas de jardinage, je préfère un concert le 9 décembre"))).toEqual(["concert"]);
    expect(ids(request("I want to sing on Saturday", [], "en"))).toEqual(["choir"]);
    expect(ids(request("Du jazz samedi soir"))).toEqual(["jazz"]);
    expect(ids(request("Pas le matin", ["De la musique samedi matin"]))).toEqual(["jazz"]);
    expect(ids(request("Pas samedi finalement", ["De la musique samedi"]))).toEqual(["concert"]);
    expect(ids(request("Demain ?", ["De la musique"]))).toEqual([]);
    expect(ids(request("De la musique, mais pas le 9 décembre"))).not.toContain("concert");
    expect(ids(request("Un concert de guitare"))).toEqual(["concert"]);
    expect(ids(request("Un concert au café"))).toEqual(["jazz", "concert"]);
    expect(ids(request("Du blues"))).toEqual([]);
  });

  it("asks when the request is vague and does not send older messages or catalogue addresses to the model", () => {
    const req = request("Je ne sais pas", ["Private history text"]);
    expect(demoAssistant(req)).toMatchObject({ reply: "Quel genre d’activité vous ferait plaisir ?", suggestions: [] });
    const content = buildUserContent(req, { categories: ["music"] });
    expect(content).toContain('"categories":["music"]');
    expect(content).not.toContain("Private history text");
    expect(content).not.toContain("Private test address");
  });

  it("applies the voice tool's criteria before ranking and leaves unrelated activities out", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-25T12:00"));
    const state = createSeed();
    const senior = state.users.find(({ id }) => id === "u-marie")!;
    const search = joyActivitySearchSchema.parse({ categories: ["music"], date: "2026-12-09", moment: "pm", terms: ["guitar"] });
    expect(rankActivitySearch(state, senior, search, 2).map(({ item }) => item.id)).toEqual(["a13"]);
    expect(rankActivitySearch(state, senior, { ...search, moment: "am" }, 2)).toEqual([]);
    expect(rankActivitySearch(state, senior, search, 2, ["a13"])).toEqual([]);
  });
});
