/*
 * Single source of truth for "who could vote" and "how many did," so the live tally bar and the
 * room-result summary can never disagree (Phase 1 fix: they previously counted different sets —
 * the tally bar counted every vote in the room, the result note counted only nudged cohorts, and
 * simulateRoom() cast phantom votes for cohorts that never received a message, so the two numbers
 * could differ by however many simulated phones landed in a non-nudged cohort).
 *
 * A participant can only ever vote if their cohort actually received a message in the CURRENT
 * broadcast — that is true for real phones (the Yes/No buttons don't render otherwise) and must
 * also be enforced here for simulated phones and, defensively, on the server.
 */
import { COMPLIANCE_WEIGHT, type ResponseKind } from './roomResponses';
import type { RoomSnapshot } from './roomTypes';

export function votableParticipantIds(snap: Pick<RoomSnapshot, 'participants' | 'broadcast'>): Set<string> {
  const ids = new Set<string>();
  const msgs = snap.broadcast?.messages;
  if (!msgs) return ids;
  for (const p of snap.participants) if (msgs[p.cohort]) ids.add(p.id);
  return ids;
}

export interface VoteTally {
  yes: number;
  no: number;
  total: number;
  /** participants who could vote right now, whether or not they have yet */
  eligible: number;
}

/** counts only votes from participants whose cohort has a message — the number shown everywhere */
export function tallyVotes(snap: Pick<RoomSnapshot, 'participants' | 'votes' | 'broadcast'>): VoteTally {
  const votable = votableParticipantIds(snap);
  let yes = 0,
    no = 0;
  for (const [pid, v] of Object.entries(snap.votes)) {
    if (!votable.has(pid)) continue;
    if (v.choice === 'yes') yes++;
    else no++;
  }
  return { yes, no, total: yes + no, eligible: votable.size };
}

/** votes grouped by cohort, restricted the same way — feeds acceptOverride and the per-cohort table */
export function tallyByCohort(snap: Pick<RoomSnapshot, 'participants' | 'votes' | 'broadcast'>): Record<string, { yes: number; no: number }> {
  const votable = votableParticipantIds(snap);
  const out: Record<string, { yes: number; no: number }> = {};
  const byId = new Map(snap.participants.map((p) => [p.id, p]));
  for (const [pid, v] of Object.entries(snap.votes)) {
    if (!votable.has(pid)) continue;
    const p = byId.get(pid);
    if (!p) continue;
    const b = (out[p.cohort] ||= { yes: 0, no: 0 });
    if (v.choice === 'yes') b.yes++;
    else b.no++;
  }
  return out;
}

export interface ResponseCounts {
  joined: number;
  accepted: number;
  declined: number;
  alreadyMoved: number;
  tooLate: number;
  ignored: number;
  /** eligible, message received, no answer yet, and the window hasn't closed */
  pending: number;
}

const emptyCounts = (): ResponseCounts => ({ joined: 0, accepted: 0, declined: 0, alreadyMoved: 0, tooLate: 0, ignored: 0, pending: 0 });

function bump(counts: ResponseCounts, response: ResponseKind) {
  if (response === 'accept') counts.accepted++;
  else if (response === 'decline') counts.declined++;
  else if (response === 'already_moved') counts.alreadyMoved++;
  else if (response === 'too_late') counts.tooLate++;
  else counts.ignored++;
}

/**
 * Per-cohort response breakdown (§14/§16): explicit answers plus a computed "ignored" for anyone
 * who has a message, never answered, and the countdown has closed. Silence before the countdown
 * closes is "pending", not "ignored" — they may still answer.
 */
export function responseBreakdown(snap: Pick<RoomSnapshot, 'participants' | 'votes' | 'broadcast'>, now: number): Record<string, ResponseCounts> {
  const votable = votableParticipantIds(snap);
  const out: Record<string, ResponseCounts> = {};
  const closesAt = snap.broadcast?.closesAt ?? Infinity;
  for (const p of snap.participants) {
    if (!votable.has(p.id)) continue;
    const counts = (out[p.cohort] ||= emptyCounts());
    counts.joined++;
    const v = snap.votes[p.id];
    // a "seen" placeholder (seenAt recorded, no choice/response yet) is not a response — only an
    // actual response or choice (legacy fixtures) counts, never bare presence in the votes map
    const response: ResponseKind | undefined = v?.response ?? (v?.choice ? (v.choice === 'yes' ? 'accept' : 'decline') : undefined);
    if (response) bump(counts, response);
    else if (now > closesAt) counts.ignored++;
    else counts.pending++;
  }
  return out;
}

export function sumResponseCounts(byCohort: Record<string, ResponseCounts>): ResponseCounts {
  const total = emptyCounts();
  for (const c of Object.values(byCohort)) {
    total.joined += c.joined;
    total.accepted += c.accepted;
    total.declined += c.declined;
    total.alreadyMoved += c.alreadyMoved;
    total.tooLate += c.tooLate;
    total.ignored += c.ignored;
    total.pending += c.pending;
  }
  return total;
}

/**
 * Observed compliance for one cohort, weighted by COMPLIANCE_WEIGHT over *settled* responses only
 * (explicit answers plus computed ignores) — participants still waiting on the countdown never
 * dilute the estimate (§11/§17).
 */
export function observedAcceptance(byCohort: Record<string, ResponseCounts>, cohortId: string): { n: number; rate: number } {
  const c = byCohort[cohortId];
  if (!c) return { n: 0, rate: 0 };
  const n = c.accepted + c.declined + c.alreadyMoved + c.tooLate + c.ignored;
  if (!n) return { n: 0, rate: 0 };
  const compliant = c.accepted * COMPLIANCE_WEIGHT.accept + c.alreadyMoved * COMPLIANCE_WEIGHT.already_moved + c.declined * COMPLIANCE_WEIGHT.decline + c.tooLate * COMPLIANCE_WEIGHT.too_late + c.ignored * COMPLIANCE_WEIGHT.ignore;
  return { n, rate: compliant / n };
}

/** Median response delay (ms) over votes with both a seen and a responded timestamp (§10/§15). */
export function responseTiming(snap: Pick<RoomSnapshot, 'votes'>): { medianMs: number | null; n: number } {
  const delays = Object.values(snap.votes)
    .map((v) => v.responseDelayMs)
    .filter((d): d is number => typeof d === 'number' && d >= 0)
    .sort((a, b) => a - b);
  if (!delays.length) return { medianMs: null, n: 0 };
  const mid = Math.floor(delays.length / 2);
  const medianMs = delays.length % 2 ? delays[mid] : (delays[mid - 1] + delays[mid]) / 2;
  return { medianMs, n: delays.length };
}
