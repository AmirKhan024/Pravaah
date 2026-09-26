import type { Lang } from '@/engine';

export interface RoomCohort {
  id: string;
  label: string;
  size: number;
  /** one-line description for the phone, e.g. "on the harbour line into Nerul" */
  blurb: string;
  /** realistic attendee profile, derived once from the real Scenario/Cohort when the room opens */
  originLabel?: string;
  transportMode?: string;
  /** HH:MM on the scenario's own clock, e.g. "19:05" */
  arrivalLabel?: string;
  /** the gate/zone name this cohort currently heads for */
  initialRoute?: string;
}

/** How a participant actually reacted to a broadcast — not just yes/no (see roomResponses.ts). */
export type ResponseKind = 'accept' | 'decline' | 'ignore' | 'too_late' | 'already_moved';
/** Whether the participant's travel group is expected to follow along. */
export type GroupResponse = 'all' | 'individual' | 'none';

export interface RoomMessage {
  head: string;
  body: string;
  yes: string;
  no: string;
}

export interface RoomBroadcast {
  planId: string;
  sentAt: number;
  closesAt: number;
  /** per cohort, per language. Cohorts not in the plan get no message. */
  messages: Record<string, Record<Lang, RoomMessage>>;
}

export interface RoomOutcome {
  /** per cohort → per choice → per language text. Numbers injected from the engine. */
  texts: Record<string, Record<'yes' | 'no' | 'none', Record<Lang, string>>>;
  headline: Record<Lang, string>;
}

export interface Participant {
  id: string;
  cohort: string;
  lang: Lang;
  joinedAt: number;
  simulated?: boolean;
  /** 1-4, seeded from the participant id at join time — a simple stand-in for travelling in a group */
  groupSize?: number;
}

export interface Vote {
  /** kept for backward compatibility; derived from `response` (see roomResponses.deriveChoice) */
  choice?: 'yes' | 'no';
  at: number;
  response?: ResponseKind;
  groupResponse?: GroupResponse | null;
  /** server timestamp: first confirmed delivery of the current broadcast to this phone */
  seenAt?: number | null;
  /** server timestamp: when the response was recorded */
  respondedAt?: number | null;
  responseDelayMs?: number | null;
}

/**
 * /visit (a single visitor's own card, no login) — additive alongside the Room's existing
 * cohort-broadcast machinery, not a replacement for it. `VisitOrigin` covers EVERY cohort (not
 * just ones the Room can nudge), since a visitor's "coming from" list should be every real
 * station/area/hotel in the loaded scenario, not only the ones eligible for a redirect message.
 */
export interface VisitOrigin {
  id: string; // cohort id
  label: string; // e.g. "Nerul rail"
  originLabel: string; // e.g. "Nerul station"
  transportMode: string; // e.g. "Local train"
  meanTick: number; // cohort.mean — this cohort's usual arrival tick, for the leave-by estimate
  mainGateId: string;
  mainGateName: string;
  altGateId: string | null;
  altGateName: string | null;
  isHotel: boolean;
  /** one food-or-stay tip, computed once when the room opened from whatever run was current then */
  tip: string;
}
/** what changed the last time the head approved or updated a plan — pushed to the room so every
 *  open /visit card can update and buzz, the same way a broadcast updates every /join phone. */
export interface PlanSnapshot {
  approvedAt: number; // wall-clock ms — "is this newer than what I last saw"
  redirects: Record<string, true>; // cohortId -> true when the approved plan routes them via altGateId
  gateWaitPeak: Record<string, number>; // gateId -> minutes, from the approved result
}

export interface RoomSnapshot {
  id: string;
  cohorts: RoomCohort[];
  participants: Participant[];
  votes: Record<string, Vote>;
  broadcast: RoomBroadcast | null;
  outcome: RoomOutcome | null;
  /** t0Min of the scenario this room was opened for — the one piece of clock context a visitor's
   *  device needs to turn a cohort's `meanTick`/a gate-wait minute count into an HH:MM string,
   *  without shipping the whole Scenario to a visitor's phone. */
  t0Min: number;
  origins: VisitOrigin[];
  /** gate wait, minutes, from the do-nothing run at room-open time — the /visit card's fallback
   *  before any plan exists, so a pre-approval leave-by time reflects the real (often bad) queue
   *  instead of quietly assuming zero wait (a real bug caught live — see docs/DECISIONS.md). */
  baseGateWaitPeak: Record<string, number>;
  plan: PlanSnapshot | null;
  now: number;
}

export interface PhoneView {
  ok: boolean;
  me?: Participant;
  cohort?: RoomCohort;
  broadcast?: { message: RoomMessage | null; closesAt: number; sentAt: number } | null;
  vote?: Vote | null;
  outcome?: { text: string; headline: string } | null;
  tally?: { yes: number; no: number; people: number };
  now: number;
}
