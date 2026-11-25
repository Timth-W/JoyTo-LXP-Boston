/**
 * GPT Realtime 2.1 session for Joy (server side).
 * The browser never sees the OpenAI key: the server creates a short-lived client secret with the
 * instructions, the voice and the tools, then the browser connects directly over WebRTC.
 * Docs: https://developers.openai.com/api/docs/guides/realtime-webrtc
 */
import { z } from "zod";
import { CATEGORY_VALUES, DAY_VALUES } from "../ai/schema";

export const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1";
export const REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || "marin";

const searchDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const activityPreferencesSchema = z.object({
  categories: z.array(z.enum(CATEGORY_VALUES)).max(7).optional(),
  excludedCategories: z.array(z.enum(CATEGORY_VALUES)).max(7).optional(),
  days: z.array(z.enum(DAY_VALUES)).max(7).optional(),
  excludedDays: z.array(z.enum(DAY_VALUES)).max(7).optional(),
  moment: z.enum(["am", "pm", "evening"]).optional(),
  excludedMoments: z
    .array(z.enum(["am", "pm", "evening"]))
    .max(3)
    .optional(),
  date: searchDate.optional(),
  throughDate: searchDate.optional(),
  excludedDates: z.array(searchDate).max(20).optional(),
  terms: z.array(z.string().trim().min(1).max(40)).max(4).optional(),
});
export const joyActivitySearchSchema = activityPreferencesSchema.extend({
  another: z.boolean().optional(),
  clear: z.boolean().optional(),
});

export const joySessionRequestSchema = z.object({
  locale: z.enum(["en", "fr"]),
  role: z.enum(["senior", "companion", "family"]),
  firstName: z.string().max(60),
  today: searchDate.optional(),
  activityPreferences: activityPreferencesSchema.optional(),
  greeting: z.string().max(1200),
  proposals: z.array(z.object({ id: z.string().max(60), line: z.string().max(300), label: z.string().max(160) })).max(8),
});
export type JoySessionRequest = z.infer<typeof joySessionRequestSchema>;

export const JOY_TOOLS = [
  {
    type: "function",
    name: "show_proposal",
    description: "Highlight one proposal card on the user's screen while you talk about it.",
    parameters: {
      type: "object",
      properties: { proposal_id: { type: "string", description: "Exact id from the latest search results or the active proposals list." } },
      required: ["proposal_id"],
    },
  },
  {
    type: "function",
    name: "open_confirmation",
    description:
      "Open the confirmation screen for a proposal the user said yes to. It does NOT book anything: the user must tap the green button.",
    parameters: {
      type: "object",
      properties: { proposal_id: { type: "string", description: "Exact id from the latest search results or the active proposals list." } },
      required: ["proposal_id"],
    },
  },
  {
    type: "function",
    name: "find_activities",
    description: "Search available activities using the senior's current request and any preferences still in effect from earlier turns.",
    parameters: {
      type: "object",
      properties: {
        categories: { type: "array", items: { type: "string", enum: CATEGORY_VALUES } },
        excludedCategories: { type: "array", items: { type: "string", enum: CATEGORY_VALUES } },
        days: { type: "array", items: { type: "string", enum: DAY_VALUES } },
        excludedDays: { type: "array", items: { type: "string", enum: DAY_VALUES } },
        moment: { type: "string", enum: ["am", "pm", "evening"], description: "Morning, afternoon, or evening respectively." },
        excludedMoments: { type: "array", items: { type: "string", enum: ["am", "pm", "evening"] } },
        date: { type: "string", description: "Exact YYYY-MM-DD for an explicit or relative date, or the start of an explicit range." },
        throughDate: { type: "string", description: "Inclusive YYYY-MM-DD end of an explicit date range." },
        excludedDates: { type: "array", items: { type: "string" }, description: "Specific YYYY-MM-DD dates the user ruled out." },
        terms: {
          type: "array",
          items: { type: "string" },
          description: "Specific activity title keywords required by the user, such as jazz. Omit generic category words.",
        },
        another: { type: "boolean", description: "True when the senior wants another result without changing their criteria." },
        clear: {
          type: "boolean",
          description: "True to clear old results when the user declines them and has not given enough detail for a new search.",
        },
      },
    },
  },
  {
    type: "function",
    name: "end_conversation",
    description: "Call when the user says goodbye or wants to stop.",
    parameters: { type: "object", properties: {} },
  },
] as const;

export function joyInstructions(req: JoySessionRequest): string {
  const language = req.locale === "fr" ? 'French, using the formal "vous"' : "English";
  const audience =
    req.role === "senior"
      ? "an older person who may feel isolated"
      : req.role === "family"
        ? "a relative who wants to help their loved one go out more"
        : "a student companion who accompanies older people";
  const list =
    req.proposals
      .filter((p) => !p.id.startsWith("upcoming:"))
      .map((p) => `- id "${p.id}": ${p.line} (card: ${p.label})`)
      .join("\n") || "- (no proposals right now)";
  const reminders = req.proposals
    .filter((p) => p.id.startsWith("upcoming:"))
    .map((p) => `- ${p.line}`)
    .join("\n");
  return `You are Joy, the voice of the JoyTo app. You are an AI and you never pretend to be a person.
You are talking with ${req.firstName}, ${audience}. Speak ${language}, warmly, slowly and simply. Never patronising, never medical.
Your goal is to lead to a real meeting with real people, not to keep the person on the phone.

Start with only this greeting, then wait for the person to answer:
"${req.greeting}"
While you mention a proposal, call show_proposal with its id.

Proposals (the only things you may offer; never invent an activity, a date, a price or a person):
${list}
${reminders ? `\nPlans already booked (mention only if asked about plans):\n${reminders}\n` : ""}
${req.today ? `Today's local date is ${req.today}.` : ""}
${req.activityPreferences ? `Activity criteria carried over from the written conversation: ${JSON.stringify(req.activityPreferences)}.` : ""}

Rules:
- Keep each answer to one or two short sentences, then let the person answer.
- When the person says yes to a specific proposal, call open_confirmation with its id. If the tool opens the sheet, tell them to tap the green button to confirm. If several proposals are active and the person has not picked one, ask which they prefer. Never say that something is booked or paid before the app tells you it was confirmed.
- If a senior asks for an activity or changes any criterion, call find_activities before suggesting one, even if an opening proposal sounds related. Carry forward the criteria they haven't changed and honour their exclusions.
- For senior activity requests, wait until the person gives a preference before searching. Ask one short clarifying question if needed. Offer only results from the latest search, or ask about a different day or activity if no result fits. If the person rejects the current options without giving a new preference, clear them with find_activities (clear=true) before asking again.
- If the app confirms an activity registration, leave that activity out of future suggestions.
- An accompanied outing costs 25 euros per hour, paid after the outing; only mention the price if asked or when opening a confirmation.
- Messages starting with [App] come from the app (for example a confirmation): acknowledge them in one short sentence.
- When the person says goodbye, say a short goodbye and call end_conversation.`;
}

/** Body sent to POST /v1/realtime/client_secrets. */
export function clientSecretBody(req: JoySessionRequest) {
  return {
    expires_after: { anchor: "created_at", seconds: 600 },
    session: {
      type: "realtime",
      model: REALTIME_MODEL,
      instructions: joyInstructions(req),
      audio: {
        input: {
          transcription: { model: "gpt-4o-mini-transcribe", language: req.locale },
          turn_detection: { type: "semantic_vad" },
        },
        output: { voice: REALTIME_VOICE },
      },
      tools: JOY_TOOLS,
      tool_choice: "auto",
    },
  };
}
