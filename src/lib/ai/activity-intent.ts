import { DAY_KEYS, WEEK_ORDER } from "../constants";
import { toDate, toLocalIso } from "../format";
import { normalizeSearchText, type ActivitySearch } from "../matching";
import type { Category, DayKey, Intent } from "../types";
import type { AssistantRequest } from "./schema";

const CATEGORIES: Record<Category, RegExp> = {
  gardening: /\b(garden\w*|plant\w*|flower\w*|roses?|jardin\w*|plante\w*|fleur\w*|potager\w*|rosier\w*|bulbe\w*)\b/,
  cooking: /\b(cook\w*|baking|bake\w*|recipe\w*|soup\w*|cake\w*|cuisin\w*|recette\w*|soupe\w*|gateau\w*|tarte\w*|patisser\w*)\b/,
  games: /\b(games?|cards?|scrabble|dominos?|chess|checkers|crosswords?|jeux?|cartes?|belote|echecs|mots croises)\b/,
  culture: /\b(museums?|exhibitions?|theat\w*|cinema|films?|culture\w*|musee\w*|expo\w*|visite\w*|peinture)\b/,
  walk: /\b(walk\w*|stroll\w*|hike|hiking|parks?|promen\w*|balad\w*|marcher|marche|parcs?|randon\w*)\b/,
  music:
    /\b(music\w*|musique\w*|sing\w*|choir\w*|concert\w*|recital\w*|chant\w*|chorale\w*|jazz|rock|blues|classique|classical|symphon\w*|opera|guitare?|piano|violin|violon)\b/,
  coffee: /\b(coffee|cafe|papot\w*|bavard\w*)\b|\b(chat|talk) over\b/,
};

const DAYS: Record<DayKey, RegExp> = {
  mon: /\b(monday|lundi)\b/,
  tue: /\b(tuesday|mardi)\b/,
  wed: /\b(wednesday|mercredi)\b/,
  thu: /\b(thursday|jeudi)\b/,
  fri: /\b(friday|vendredi)\b/,
  sat: /\b(saturday|samedi)\b/,
  sun: /\b(sunday|dimanche)\b/,
};

const MOMENTS = {
  am: /\b(morning|matin\w*)\b/,
  pm: /\b(afternoon|apres[ -]?midi|aprem)\b/,
  evening: /\b(evening|tonight|soir\w*)\b/,
};

const TERMS: Partial<Record<Category, RegExp>> = {
  music: /\b(jazz|rock|blues|classi|acousti|symphon|opera|guitar|piano|violin|violon|choir|chorale|singing|sing|chant|concert|recital)\w*/g,
  games: /\b(scrabble|belote|domino|crossword|mots croises|chess|echecs)\w*/g,
  culture: /\b(museum|musee|exhibition|exposition|cinema)\w*/g,
};

const NEGATED = /\b(?:no|not|without|don't|do not|pas|sans|sauf|except)\b[^,.!?]*$/;
const CLAUSE = /[,;.!?]+|\b(?:mais|but|plutot|instead|finalement|actually|par contre|je prefere|i prefer|et je|and i)\b/;
const PLACE = /\b(?:au |a la |a l'|dans (?:le|la|les|un|une) |at (?:the|a) |in (?:the|a) )/;
export const ANOTHER_ACTIVITY = /^(another( one| option| activity)?|next|une autre( activite| proposition)?|la suivante|suivant)$/;

function mentions<T extends string>(items: readonly T[], patterns: Record<T, RegExp>, clauses: string[]) {
  const included = new Set<T>();
  const excluded = new Set<T>();
  for (const clause of clauses) {
    for (const item of items) {
      const match = patterns[item].exec(clause);
      if (!match) continue;
      const negative = NEGATED.test(clause.slice(0, match.index));
      (negative ? excluded : included).add(item);
      (negative ? included : excluded).delete(item);
    }
  }
  return { included: [...included], excluded: [...excluded] };
}

function dateAfter(today: string, offset: number): string {
  const date = toDate(today);
  date.setDate(date.getDate() + offset);
  return toLocalIso(date).slice(0, 10);
}

const MONTHS = [
  "january|janvier",
  "february|fevrier",
  "march|mars",
  "april|avril",
  "may|mai",
  "june|juin",
  "july|juillet",
  "august|aout",
  "september|septembre",
  "october|octobre",
  "november|novembre",
  "december|decembre",
];
const MONTH = `(${MONTHS.join("|")})`;
const DAY_NUMBER = "(\\d{1,2})(?:st|nd|rd|th|er)?";
const DAY_MONTH = new RegExp(`\\b${DAY_NUMBER} ${MONTH}(?: (\\d{4}))?\\b`);
const MONTH_DAY = new RegExp(`\\b${MONTH} ${DAY_NUMBER}(?: (\\d{4}))?\\b`);

function calendarDate(text: string, today: string) {
  const dayMonth = DAY_MONTH.exec(text);
  const monthDay = dayMonth ? null : MONTH_DAY.exec(text);
  const namedDate = dayMonth ?? monthDay;
  if (!namedDate) return null;
  const day = Number(namedDate[dayMonth ? 1 : 2]);
  const monthName = namedDate[dayMonth ? 2 : 1];
  const month = MONTHS.findIndex((names) => names.split("|").includes(monthName));
  const year = Number(namedDate[3] ?? today.slice(0, 4));
  const date = new Date(year, month, day);
  if (date.getMonth() !== month) return null;
  let iso = toLocalIso(date).slice(0, 10);
  if (!namedDate[3] && iso < today.slice(0, 10)) {
    date.setFullYear(year + 1);
    iso = toLocalIso(date).slice(0, 10);
  }
  return { iso, index: namedDate.index };
}

function datesIn(clauses: string[], today: string) {
  let date: string | undefined;
  let throughDate: string | undefined;
  const excludedDates: string[] = [];
  const weekday = toDate(today).getDay();
  for (const clause of clauses) {
    const namedDate = calendarDate(clause, today);
    const relative =
      /\b(apres[ -]demain|day after tomorrow|tomorrow|demain|today|aujourd'hui|tonight|ce soir|this weekend|ce week[ -]?end)\b/.exec(
        clause,
      );
    if (!namedDate && !relative) continue;
    const phrase = relative?.[0] ?? "";
    const weekend = /week/.test(phrase);
    const offset = weekend ? (weekday === 0 ? -1 : 6 - weekday) : /after|apres/.test(phrase) ? 2 : /tomorrow|demain/.test(phrase) ? 1 : 0;
    const first = namedDate?.iso ?? dateAfter(today, offset);
    const last = !namedDate && weekend ? dateAfter(today, offset + 1) : undefined;
    if (NEGATED.test(clause.slice(0, namedDate?.index ?? relative?.index))) {
      excludedDates.push(first);
      if (last) excludedDates.push(last);
    } else {
      date = first;
      throughDate = last;
    }
  }
  return { date, throughDate, excludedDates };
}

interface ActivityTurn {
  search: ActivitySearch;
  intent: Intent;
  understood: boolean;
}

/** Fold explicit preferences from earlier user turns into the current request. */
export function activityTurn({ message, history, today }: Pick<AssistantRequest, "message" | "history" | "today">): ActivityTurn {
  let search: ActivitySearch = {};
  let wantsCompanion = false;
  let wantsGroup = false;
  let understood = false;
  const messages = [...history.filter((entry) => entry.from === "user").map(({ text }) => text), message];
  for (const raw of messages) {
    const text = normalizeSearchText(raw).replace(/[’‘]/g, "'");
    const clauses = text.split(CLAUSE);
    const topics = clauses.map((clause) => {
      const main = clause.split(PLACE, 1)[0];
      return Object.values(CATEGORIES).some((pattern) => pattern.test(main)) ? main : clause;
    });
    const categories = mentions(Object.keys(CATEGORIES) as Category[], CATEGORIES, topics);
    const days = mentions(WEEK_ORDER, DAYS, clauses);
    const { date, throughDate, excludedDates } = datesIn(clauses, today);
    const moments = mentions(["am", "pm", "evening"] as const, MOMENTS, clauses);
    const moment = moments.included[0];
    const anyDay = /\b(any day|whatever day|n'importe quel jour|peu importe le jour)\b/.test(text);
    const anyTime = /\b(any time|anytime|n'importe quelle heure|peu importe l'heure)\b/.test(text);
    const anyCategory = /\b(any activity|peu importe l'activite)\b/.test(text);
    const differentActivity = /\b(anything else|something else|autre chose)\b/.test(text);
    const weekend = !date && !excludedDates.length && /\bweek[ -]?end\b/.test(text);
    const companion =
      /\b(accompan\w*|someone to (go|come)|go with me|come with me|pick me up|don't dare|accompagn\w*|quelqu'un pour|venir me chercher|avec moi|n'ose pas|pas (toute? )?seule?)\b/.test(
        text,
      );
    const group = /\b(meet people|group\w*|with others|together|rencontr\w*|gens|groupe\w*|ensemble|du monde)\b/.test(text);

    const selectedCategories = categories.included.length
      ? categories.included
      : anyCategory || differentActivity
        ? []
        : (search.categories ?? []);
    const excludedCategories = [...new Set([...(search.excludedCategories ?? []), ...categories.excluded])].filter(
      (category) => !categories.included.includes(category),
    );
    const activeCategories = selectedCategories.filter((category) => !excludedCategories.includes(category));
    const termPatterns = TERMS[activeCategories[0]];
    const terms =
      activeCategories.length === 1 && termPatterns
        ? topics.filter((clause) => !NEGATED.test(clause)).flatMap((clause) => [...clause.matchAll(termPatterns)].map((match) => match[1]))
        : [];
    const hasDateChange = anyDay || Boolean(date) || Boolean(days.included.length) || weekend;
    const removedDays = anyDay
      ? []
      : [...new Set([...(search.excludedDays ?? []), ...days.excluded])].filter((day) => !days.included.includes(day));
    const removedDates = anyDay
      ? []
      : [...new Set([...(search.excludedDates ?? []), ...excludedDates])].filter((removed) => removed !== date && removed !== throughDate);
    const selectedDays: DayKey[] =
      anyDay || date ? [] : weekend ? ["sat", "sun"] : days.included.length ? days.included : (search.days ?? []);
    const retainedDate = search.date && !removedDates.includes(search.date) ? search.date : undefined;
    const excludedMoments = anyTime
      ? []
      : [...new Set([...(search.excludedMoments ?? []), ...moments.excluded])].filter((item) => !moments.included.includes(item));
    const retainedMoment = search.moment && !excludedMoments.includes(search.moment) ? search.moment : undefined;
    search = {
      categories: activeCategories,
      excludedCategories: anyCategory || differentActivity ? categories.excluded : excludedCategories,
      days: selectedDays.filter((day) => !removedDays.includes(day)),
      excludedDays: removedDays,
      excludedDates: removedDates,
      moment: anyTime ? undefined : (moment ?? retainedMoment),
      excludedMoments,
      date: hasDateChange ? date : retainedDate,
      throughDate: hasDateChange ? throughDate : retainedDate ? search.throughDate : undefined,
      terms: terms.length ? [...new Set(terms)] : categories.included.length || anyCategory || !activeCategories.length ? [] : search.terms,
    };
    wantsCompanion ||= companion;
    wantsGroup ||= group;
    understood = Boolean(
      categories.included.length ||
        categories.excluded.length ||
        days.included.length ||
        days.excluded.length ||
        date ||
        excludedDates.length ||
        moment ||
        moments.excluded.length ||
        anyDay ||
        anyTime ||
        anyCategory ||
        weekend ||
        terms.length ||
        companion ||
        group ||
        (ANOTHER_ACTIVITY.test(
          text
            .trim()
            .replace(/[.!?]+$/, "")
            .trim(),
        ) &&
          (activeCategories.length || search.days?.length || search.date || search.moment)),
    );
  }
  const intent: Intent = {
    categories: search.categories ?? [],
    days: search.days ?? [],
    moment: search.moment === "evening" ? "pm" : (search.moment ?? null),
    wantsCompanion,
    wantsGroup,
  };
  return { search, intent, understood };
}
