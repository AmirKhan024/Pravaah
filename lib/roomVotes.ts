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
