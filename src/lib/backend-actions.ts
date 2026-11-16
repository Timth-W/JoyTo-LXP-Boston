import {
  acceptOffer,
  buyGiftCard,
  cancelMission,
  completeMission,
  companionCancel,
  createMission,
  declineOffer,
  linkByCode,
  login,
  loginAsDemo,
  logout,
  markAllRead,
  markRead,
  offerHelp,
  rateMission,
  register,
  regenerateInviteCode,
  signUp,
  unregister,
  unlinkFamily,
  updateProfile,
  withdrawOffer,
} from "./actions";
import { createSeed } from "./seed";
import type { BackendMutationAction, BackendMutationPayloads } from "./backend-contract";
import type { State } from "./types";

const ACTIONS: Record<BackendMutationAction, true> = {
  login: true,
  signup: true,
  "login-as-demo": true,
  logout: true,
  "reset-demo": true,
  "link-by-code": true,
  "unlink-family": true,
  "regenerate-invite-code": true,
  register: true,
  unregister: true,
  "create-mission": true,
  "offer-help": true,
  "withdraw-offer": true,
  "accept-offer": true,
  "decline-offer": true,
  "cancel-mission": true,
  "companion-cancel": true,
  "complete-mission": true,
  "rate-mission": true,
  "buy-gift-card": true,
  "update-profile": true,
  "mark-all-read": true,
  "mark-read": true,
};

export function isBackendMutationAction(action: string): action is BackendMutationAction {
  return Object.hasOwn(ACTIONS, action);
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function applyBackendAction(
  state: State,
  action: BackendMutationAction,
  input: Record<string, unknown>,
): unknown {
  switch (action) {
    case "login":
      return login(state, text(input.email), text(input.passwordHash));
    case "signup":
      return signUp(state, input as unknown as BackendMutationPayloads["signup"]);
    case "login-as-demo":
      return loginAsDemo(state, text(input.userId));
    case "logout":
      return logout(state);
    case "reset-demo": {
      const currentUserId = state.currentUserId;
      const now = state.now;
      Object.assign(state, createSeed(), { currentUserId, now });
      return;
    }
    case "link-by-code":
      return linkByCode(
        state,
        text(input.familyId),
        text(input.code),
        text(input.relation) as BackendMutationPayloads["link-by-code"]["relation"],
      );
    case "unlink-family":
      return unlinkFamily(state, text(input.linkId), text(input.byUserId));
    case "regenerate-invite-code":
      return regenerateInviteCode(state, text(input.seniorId));
    case "register":
      return register(
        state,
        text(input.activityId),
        text(input.seniorId),
        text(input.via) === "assistant" ? "assistant" : "catalogue",
      );
    case "unregister":
      return unregister(state, text(input.activityId), text(input.seniorId));
    case "create-mission":
      return createMission(state, input as unknown as BackendMutationPayloads["create-mission"]);
    case "offer-help":
      return offerHelp(state, text(input.missionId), text(input.companionId));
    case "withdraw-offer":
      return withdrawOffer(state, text(input.missionId), text(input.companionId));
    case "accept-offer":
      return acceptOffer(state, text(input.offerId));
    case "decline-offer":
      return declineOffer(state, text(input.offerId));
    case "cancel-mission":
      return cancelMission(state, text(input.missionId), text(input.reason));
    case "companion-cancel":
      return companionCancel(state, text(input.missionId), text(input.companionId), text(input.reason));
    case "complete-mission":
      return completeMission(state, text(input.missionId));
    case "rate-mission":
      return rateMission(state, text(input.missionId), Number(input.rating), text(input.review));
    case "buy-gift-card":
      return buyGiftCard(state, text(input.buyerId), text(input.seniorId));
    case "update-profile":
      return updateProfile(state, text(input.userId), (input.patch ?? {}) as BackendMutationPayloads["update-profile"]["patch"]);
    case "mark-all-read":
      return markAllRead(state, text(input.userId));
    case "mark-read":
      return markRead(state, text(input.id));
  }
}