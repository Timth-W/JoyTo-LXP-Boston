import { createHash, randomBytes } from "node:crypto";
import { isCompatible } from "./matching";
import {
  acceptedOffer,
  canViewOwnedMission,
  missionForCompanion,
  paymentFor,
  userById,
  visitReportFor,
  type MissionView,
} from "./selectors";
import type { Mission, State, User } from "./types";

export const SESSION_COOKIE = "joyto_session";
export const SESSION_SECONDS = 30 * 24 * 60 * 60;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionActor(state: State, token: string | undefined) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return undefined;
  const hash = hashToken(token);
  const session = state.sessions?.find((entry) => entry.tokenHash === hash && entry.expiresAt > Date.now());
  return userById(state, session?.userId);
}

export function removeSession(state: State, token: string | undefined) {
  if (!token) return;
  const hash = hashToken(token);
  state.sessions = state.sessions?.filter((entry) => entry.tokenHash !== hash);
}

export function createSession(state: State, userId: string, previousToken: string | undefined) {
  removeSession(state, previousToken);
  const now = Date.now();
  const token = randomBytes(32).toString("hex");
  state.sessions = (state.sessions ?? []).filter((entry) => entry.expiresAt > now);
  state.sessions.push({ tokenHash: hashToken(token), userId, expiresAt: now + SESSION_SECONDS * 1000 });
  return token;
}

function profileView(user: User, { own = false, linked = false, interests = false, companion = false } = {}): User {
  const seniorPreferences = linked && user.role === "senior";
  return {
    id: user.id,
    role: user.role,
    firstName: user.firstName,
    lastName: own || linked ? user.lastName : "",
    email: own ? user.email : "",
    passwordHash: "",
    bio: own || companion ? user.bio : "",
    sector: own || seniorPreferences ? user.sector : "centre",
    interests: own || seniorPreferences || interests || companion ? user.interests : [],
    availability: own || seniorPreferences ? user.availability : [],
    createdAt: own ? user.createdAt : "",
    inviteCode: own && user.role === "senior" ? user.inviteCode : undefined,
    demo: own ? user.demo : undefined,
    companion:
      (own || companion) && user.companion ? { verified: user.companion.verified, sectors: own ? user.companion.sectors : [] } : undefined,
  };
}

function missionOverview(mission: Mission) {
  return {
    id: mission.id,
    seniorId: mission.seniorId,
    activityId: mission.activityId,
    type: mission.type,
    start: mission.start,
    durationMin: mission.durationMin,
    sector: mission.sector,
    status: mission.status,
  };
}

function ownedMissionView(state: State, mission: Mission, viewer: User): Mission {
  return {
    ...missionOverview(mission),
    bookedById: mission.bookedById,
    payerId: mission.payerId,
    note: mission.note,
    meetingPoint: mission.meetingPoint,
    via: mission.via,
    createdAt: mission.createdAt,
    cancelReason: mission.cancelReason,
    lateCancel: mission.lateCancel,
    autoAcceptVerifiedCompanion: mission.autoAcceptVerifiedCompanion,
    visitReport: visitReportFor(state, mission, viewer),
    rating: mission.rating,
    review: mission.review,
  };
}

function companionMissionView(state: State, mission: Mission, viewer: User): MissionView {
  const details = missionForCompanion(state, mission, viewer.id);
  const assigned = acceptedOffer(state, mission.id)?.companionId === viewer.id;
  return {
    ...missionOverview(mission),
    bookedById: "",
    payerId: "",
    note: details.unlocked ? mission.note : "",
    via: "manual",
    createdAt: "",
    meetingPoint: details.meetingPoint ?? "",
    seniorLastName: details.seniorLastName ?? undefined,
    visitReport: details.visitReport,
    rating: details.unlocked ? mission.rating : undefined,
    review: details.unlocked ? mission.review : undefined,
    lateCancel: assigned ? mission.lateCancel : undefined,
    companionPaymentCaptured: assigned && mission.lateCancel ? paymentFor(state, mission.id)?.status === "captured" : undefined,
  };
}

export function backendView(state: State, token: string | undefined): State {
  const viewer = sessionActor(state, token);
  const view: State = {
    version: state.version,
    now: state.now,
    currentUserId: viewer?.id ?? null,
    activities: state.activities,
    users: [],
    links: [],
    registrations: [],
    missions: [],
    offers: [],
    payments: [],
    giftCards: [],
    notifications: [],
    chats: {},
    seq: 0,
  };
  if (!viewer) return view;

  const companion = viewer.role === "companion";
  const ownOffers = companion ? state.offers.filter((offer) => offer.companionId === viewer.id) : [];
  const offeredMissionIds = new Set(ownOffers.map((offer) => offer.missionId));
  const visibleMissions = state.missions.filter((mission) =>
    companion ? offeredMissionIds.has(mission.id) || isCompatible(state, mission, viewer) : canViewOwnedMission(state, mission, viewer.id),
  );
  const missionIds = new Set(visibleMissions.map((mission) => mission.id));
  const missions: MissionView[] = visibleMissions.map((mission) =>
    companion ? companionMissionView(state, mission, viewer) : ownedMissionView(state, mission, viewer),
  );
  view.missions = missions;
  view.offers = companion
    ? ownOffers
    : state.offers.filter((offer) => missionIds.has(offer.missionId) && (offer.status === "pending" || offer.status === "accepted"));
  view.links = state.links.filter((link) => link.seniorId === viewer.id || link.familyId === viewer.id);
  const linkedIds = new Set(view.links.map((link) => (viewer.id === link.seniorId ? link.familyId : link.seniorId)));
  const reportMissionIds = new Set(missions.filter((mission) => mission.visitReport).map((mission) => mission.id));
  const unlockedMissionIds = new Set(missions.filter((mission) => mission.seniorLastName !== undefined).map((mission) => mission.id));
  view.notifications = state.notifications
    .filter(
      (notice) =>
        notice.userId === viewer.id && (notice.type !== "visitReportReady" || reportMissionIds.has(notice.params.missionId ?? "")),
    )
    .map((notice) =>
      companion && !unlockedMissionIds.has(notice.params.missionId ?? "")
        ? { ...notice, params: { ...notice.params, reason: undefined } }
        : notice,
    );
  const contacts = new Set(view.notifications.flatMap((notice) => [notice.params.actorId, notice.params.seniorId]));
  const seniorProfiles = new Set(visibleMissions.map((mission) => mission.seniorId));
  const companionProfiles = new Set(companion ? [] : view.offers.map((offer) => offer.companionId));
  if (!companion) {
    for (const mission of visibleMissions) {
      contacts.add(mission.bookedById);
      contacts.add(mission.payerId);
    }
    // Catalogue rosters only need participants' first names and interests, plus the number of registrations.
    view.registrations = state.registrations.map((registration) => {
      seniorProfiles.add(registration.seniorId);
      return registration.seniorId === viewer.id || linkedIds.has(registration.seniorId)
        ? registration
        : { ...registration, via: "catalogue" };
    });
    view.payments = state.payments.filter((payment) => payment.payerId === viewer.id || missionIds.has(payment.missionId));
    view.giftCards = state.giftCards.flatMap((card) => {
      if (card.buyerId === viewer.id) return [card];
      if (card.seniorId !== viewer.id && !linkedIds.has(card.seniorId)) return [];
      return [{ ...card, buyerId: "", priceCents: 0, minutesTotal: 0, createdAt: "" }];
    });
  }
  if (Object.hasOwn(state.chats, viewer.id)) view.chats = { [viewer.id]: state.chats[viewer.id] };
  view.users = state.users.flatMap((user) => {
    const own = user.id === viewer.id;
    const linked = linkedIds.has(user.id);
    const interests = seniorProfiles.has(user.id);
    const offered = companionProfiles.has(user.id);
    return own || linked || interests || offered || contacts.has(user.id)
      ? [profileView(user, { own, linked, interests, companion: offered })]
      : [];
  });
  return view;
}
