import type { Lang } from '@/engine';

export interface RoomCohort {
  id: string;
  label: string;
  size: number;
  /** one-line description for the phone, e.g. "on the harbour line into Nerul" */
  blurb: string;
}

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
}

export interface Vote {
  choice: 'yes' | 'no';
  at: number;
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
