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

export interface RoomSnapshot {
  id: string;
  cohorts: RoomCohort[];
  participants: Participant[];
  votes: Record<string, Vote>;
  broadcast: RoomBroadcast | null;
  outcome: RoomOutcome | null;
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
