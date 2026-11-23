import type { AuthError, NewMission, ProfilePatch, SignUpInput } from "./actions";
import type { Relation } from "./types";

export interface BackendMutationPayloads {
  login: { email: string; passwordHash: string };
  signup: SignUpInput;
  "login-as-demo": { userId: string };
  logout: Record<string, never>;
  "reset-demo": Record<string, never>;
  "link-by-code": { familyId: string; code: string; relation: Relation };
  "unlink-family": { linkId: string; byUserId: string };
  "regenerate-invite-code": { seniorId: string };
  register: { activityId: string; seniorId: string; via: "assistant" | "catalogue" };
  unregister: { activityId: string; seniorId: string };
  "create-mission": NewMission;
  "offer-help": { missionId: string; companionId: string };
  "withdraw-offer": { missionId: string; companionId: string };
  "accept-offer": { offerId: string };
  "decline-offer": { offerId: string };
  "cancel-mission": { missionId: string; reason: string; acceptLateCharge: boolean };
  "companion-cancel": { missionId: string; companionId: string; reason: string };
  "complete-mission": { missionId: string };
  "send-visit-report": { missionId: string; summary: string; shareReportWithSenior: boolean };
  "rate-mission": { missionId: string; rating: number; review: string };
  "buy-gift-card": { buyerId: string; seniorId: string };
  "update-profile": { userId: string; patch: ProfilePatch };
  "mark-all-read": { userId: string };
  "mark-read": { id: string };
}

export type BackendMutationAction = keyof BackendMutationPayloads;

export type BackendMutationResult<Action extends BackendMutationAction> = Action extends "login"
  ? ReturnType<typeof import("./actions").login>
  : Action extends "signup"
    ? ReturnType<typeof import("./actions").signUp>
    : Action extends "create-mission"
      ? string
      : Action extends "link-by-code"
        ? AuthError | { seniorId: string }
        : void;
