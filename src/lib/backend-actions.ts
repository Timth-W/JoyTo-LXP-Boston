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
  sendVisitReport,
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
import { acceptedOffer, isLinked, missionById, payersFor, userById } from "./selectors";

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
  "send-visit-report": true,
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
  actorId?: string,
  now = state.now,
): unknown {
  const missionId = text(input.missionId);
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
      if (!actorId || actorId !== input.familyId) throw new Error("You cannot link this account.");
      return linkByCode(
        state,
        text(input.familyId),
        text(input.code),
        text(input.relation) as BackendMutationPayloads["link-by-code"]["relation"],
      );
    case "unlink-family":
      if (!actorId || actorId !== input.byUserId) throw new Error("You cannot unlink this account.");
      return unlinkFamily(state, text(input.linkId), text(input.byUserId));
    case "regenerate-invite-code":
      if (!actorId || actorId !== input.seniorId) throw new Error("You cannot change this invitation code.");
      return regenerateInviteCode(state, text(input.seniorId));
    case "register":
      return register(state, text(input.activityId), text(input.seniorId), text(input.via) === "assistant" ? "assistant" : "catalogue");
    case "unregister":
      return unregister(state, text(input.activityId), text(input.seniorId));
    case "create-mission": {
      const request = input as unknown as BackendMutationPayloads["create-mission"];
      if (!actorId || actorId !== request.bookedById || (actorId !== request.seniorId && !isLinked(state, request.seniorId, actorId))) {
        throw new Error("You cannot create this request.");
      }
      if (!payersFor(state, request.seniorId).some((payer) => payer.id === request.payerId)) {
        throw new Error("This payer is unavailable for the outing.");
      }
      return createMission(state, {
        seniorId: request.seniorId,
        bookedById: actorId,
        payerId: request.payerId,
        activityId: request.activityId,
        type: request.type,
        note: request.note,
        start: request.start,
        durationMin: request.durationMin,
        sector: request.sector,
        meetingPoint: request.meetingPoint,
        via: request.via,
        autoAcceptVerifiedCompanion: typeof input.autoAcceptVerifiedCompanion === "boolean" ? input.autoAcceptVerifiedCompanion : undefined,
      });
    }
    case "offer-help":
      if (userById(state, actorId)?.role !== "companion" || actorId !== input.companionId) throw new Error("You cannot make this offer.");
      return offerHelp(state, missionId, text(input.companionId));
    case "withdraw-offer":
      if (!actorId || actorId !== input.companionId) throw new Error("You cannot withdraw this offer.");
      return withdrawOffer(state, missionId, actorId);
    case "accept-offer":
    case "decline-offer": {
      const offerId = text(input.offerId);
      const offer = state.offers.find((item) => item.id === offerId);
      const m = offer && missionById(state, offer.missionId);
      if (!m || !actorId || (actorId !== m.seniorId && !isLinked(state, m.seniorId, actorId))) {
        throw new Error("You cannot decide on this offer.");
      }
      return action === "accept-offer" ? acceptOffer(state, offerId) : declineOffer(state, offerId);
    }
    case "cancel-mission": {
      const m = missionById(state, missionId);
      if (!m || !actorId || ![m.seniorId, m.payerId, m.bookedById].includes(actorId)) throw new Error("You cannot cancel this outing.");
      return cancelMission(state, missionId, text(input.reason), input.acceptLateCharge === true, now);
    }
    case "companion-cancel":
      if (!actorId || actorId !== input.companionId) throw new Error("You cannot cancel this outing.");
      return companionCancel(state, missionId, actorId, text(input.reason));
    case "complete-mission": {
      const m = missionById(state, missionId);
      if (!m || !actorId || ![m.seniorId, m.payerId, m.bookedById, acceptedOffer(state, missionId)?.companionId].includes(actorId)) {
        throw new Error("You cannot complete this outing.");
      }
      return completeMission(state, missionId);
    }
    case "send-visit-report":
      if (userById(state, actorId)?.role !== "companion" || !actorId) throw new Error("You cannot send this report.");
      return sendVisitReport(state, missionId, actorId, text(input.summary), input.shareReportWithSenior === true);
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
