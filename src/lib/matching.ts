/**
 * Recommendation rules.
 * 1. Hard filters, always applied by code (never by the AI): future date, seats left,
 *    companion's areas and availability.
 * 2. Ranking and explanation: by the AI (route /api/assistant) or, as a fallback, by the score below.
 * Reasons are returned as translatable descriptors, rendered in the viewer's language.
 */
import { slotOf, dayKey } from "./format";
import { activityById, attendees, isActivityPast, isPast, isRegistered, seatsLeft, userById } from "./selectors";
import type { Activity, Category, DayKey, Intent, Mission, SectorId, Slot, State, User } from "./types";

export type Reason =
  | { kind: "likes"; category: Category }
  | { kind: "available"; slot: Slot }
  | { kind: "mates"; names: string[] }
  | { kind: "nearby" }
  | { kind: "activityMatch"; activityId: string }
  | { kind: "shared"; categories: Category[] }
  | { kind: "inArea"; sector: SectorId };

export interface Ranked<T> {
  item: T;
  score: number;
  reasons: Reason[];
}

/** Activities a senior can actually join (hard filters). */
export function eligibleActivities(s: State, senior: User): Activity[] {
  return s.activities.filter((a) => !isActivityPast(a.start) && seatsLeft(s, a) > 0 && !isRegistered(s, a.id, senior.id));
}

export interface ActivitySearch {
  categories?: Category[];
  excludedCategories?: Category[];
  days?: DayKey[];
  excludedDays?: DayKey[];
  moment?: "am" | "pm" | "evening";
  excludedMoments?: NonNullable<ActivitySearch["moment"]>[];
  date?: string;
  throughDate?: string;
  excludedDates?: string[];
  terms?: string[];
}

export const normalizeSearchText = (text: string) => text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

const TERM_VARIANTS = [
  ["choir", "chorale", "singing", "sing", "chant"],
  ["concert", "recital"],
  ["guitar", "guitare"],
  ["violin", "violon"],
  ["crossword", "mots croises"],
  ["chess", "echecs"],
  ["museum", "musee"],
  ["exhibition", "exposition"],
  ["classi", "classical", "classique"],
  ["acousti", "acoustic", "acoustique"],
];

function matchesSearchTerm(catalogueText: string, term: string): boolean {
  const normalized = normalizeSearchText(term);
  const variants = TERM_VARIANTS.find((group) => group.includes(normalized)) ?? [normalized];
  return variants.some((variant) => catalogueText.includes(variant));
}

export function matchesActivitySearch(
  activity: { category: Category; start: string; title: string; description?: string },
  search: ActivitySearch,
): boolean {
  const date = activity.start.slice(0, 10);
  const catalogueText = normalizeSearchText(`${activity.title} ${activity.description ?? ""}`);
  const day = dayKey(activity.start);
  const hour = Number(activity.start.slice(11, 13));
  const moment = hour < 12 ? "am" : hour < 18 ? "pm" : "evening";
  return (
    (!search.categories?.length || search.categories.includes(activity.category)) &&
    !search.excludedCategories?.includes(activity.category) &&
    (!search.days?.length || search.days.includes(day)) &&
    !search.excludedDays?.includes(day) &&
    (!search.moment || search.moment === moment) &&
    !search.excludedMoments?.includes(moment) &&
    (!search.date || (date >= search.date && date <= (search.throughDate ?? search.date))) &&
    !search.excludedDates?.includes(date) &&
    (!search.terms?.length || search.terms.every((term) => matchesSearchTerm(catalogueText, term)))
  );
}

export function rankActivities(s: State, senior: User, intent?: Intent, limit = 3): Ranked<Activity>[] {
  let list = eligibleActivities(s, senior);
  if (intent?.days.length) list = list.filter((a) => intent.days.includes(dayKey(a.start)));
  if (intent?.moment) {
    const moment = intent.moment;
    list = list.filter((a) => slotOf(a.start).endsWith(moment));
  }
  if (intent?.categories.length && list.some((a) => intent.categories.includes(a.category))) {
    list = list.filter((a) => intent.categories.includes(a.category));
  }
  return rankEligibleActivities(s, senior, list, limit);
}

export function rankActivitySearch(s: State, senior: User, search: ActivitySearch, limit: number, excludedIds: readonly string[] = []) {
  const list = eligibleActivities(s, senior).filter((activity) => {
    const title = typeof activity.title === "string" ? activity.title : `${activity.title.en} ${activity.title.fr}`;
    const description =
      typeof activity.description === "string" ? activity.description : `${activity.description.en} ${activity.description.fr}`;
    return !excludedIds.includes(activity.id) && matchesActivitySearch({ ...activity, title, description }, search);
  });
  return rankEligibleActivities(s, senior, list, limit);
}

function rankEligibleActivities(s: State, senior: User, list: Activity[], limit: number): Ranked<Activity>[] {
  return list
    .map((a) => {
      let score = 0;
      const reasons: Reason[] = [];
      if (senior.interests.includes(a.category)) {
        score += 3;
        reasons.push({ kind: "likes", category: a.category });
      }
      if (senior.availability.includes(slotOf(a.start))) {
        score += 2;
        reasons.push({ kind: "available", slot: slotOf(a.start) });
      }
      const mates = attendees(s, a.id).filter((p) => p.id !== senior.id && p.interests.some((i) => senior.interests.includes(i)));
      if (mates.length) {
        score += mates.length;
        reasons.push({ kind: "mates", names: mates.map((m) => m.firstName) });
      }
      if (a.sector === senior.sector) {
        score += 1;
        reasons.push({ kind: "nearby" });
      }
      return { item: a, score, reasons };
    })
    .sort((x, y) => y.score - x.score || x.item.start.localeCompare(y.item.start))
    .slice(0, limit);
}

/** Hard filters before an outing is offered to a companion. */
export function isCompatible(s: State, m: Mission, companion: User): boolean {
  const c = companion.companion;
  if (!c) return false;
  return m.status === "open" && !isPast(s, m.start) && c.sectors.includes(m.sector) && companion.availability.includes(slotOf(m.start));
}

export function rankMissions(s: State, companion: User): Ranked<Mission>[] {
  return s.missions
    .filter((m) => isCompatible(s, m, companion))
    .map((m) => {
      const senior = userById(s, m.seniorId);
      const shared = (senior?.interests ?? []).filter((i) => companion.interests.includes(i));
      const reasons: Reason[] = [];
      let score = 2;
      const activity = activityById(s, m.activityId);
      if (activity && companion.interests.includes(activity.category)) {
        score += 4;
        reasons.push({ kind: "activityMatch", activityId: activity.id });
      }
      if (shared.length) {
        score += shared.length * 3;
        reasons.push({ kind: "shared", categories: shared });
      }
      reasons.push({ kind: "available", slot: slotOf(m.start) });
      reasons.push({ kind: "inArea", sector: m.sector });
      return { item: m, score, reasons };
    })
    .sort((x, y) => y.score - x.score || x.item.start.localeCompare(y.item.start));
}
