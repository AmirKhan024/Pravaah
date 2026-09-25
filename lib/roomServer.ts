import 'server-only';
/*
 * The Room — in-memory state on the demo machine (one Node process). Phones and the console poll.
 * Anonymous participant ids only; nothing personal is stored.
 */
import type { Lang } from '@/engine';
import type { Participant, PhoneView, RoomBroadcast, RoomCohort, RoomOutcome, RoomSnapshot, Vote } from './roomTypes';

interface Room {
  id: string;
  createdAt: number;
  cohorts: RoomCohort[];
  participants: Map<string, Participant>;
  votes: Map<string, Vote>;
  broadcast: RoomBroadcast | null;
  outcome: RoomOutcome | null;
}

const g = globalThis as unknown as { __pravaahRooms?: Map<string, Room> };
const rooms: Map<string, Room> = g.__pravaahRooms || (g.__pravaahRooms = new Map());

const WORDS = ['GATE', 'FLOW', 'NERUL', 'RIVER', 'LANE', 'PATH', 'TIDE', 'BRASS'];
function newId() {
  const w = WORDS[Math.floor(Math.random() * WORDS.length)];
  return w + '-' + Math.floor(100 + Math.random() * 900);
}

export function createRoom(cohorts: RoomCohort[]): Room {
  let id = newId();
  while (rooms.has(id)) id = newId();
  const r: Room = { id, createdAt: Date.now(), cohorts, participants: new Map(), votes: new Map(), broadcast: null, outcome: null };
  rooms.set(id, r);
  // keep memory bounded
  if (rooms.size > 30) rooms.delete(rooms.keys().next().value!);
  return r;
}

export const getRoom = (id: string) => rooms.get(id.toUpperCase());

/** weighted round-robin: the cohort whose share of the room is furthest below its share of the crowd */
function assignCohort(r: Room): string {
  const total = r.cohorts.reduce((a, c) => a + c.size, 0) || 1;
  const n = r.participants.size + 1;
  let best = r.cohorts[0].id,
    gap = -Infinity;
  for (const c of r.cohorts) {
    const have = [...r.participants.values()].filter((p) => p.cohort === c.id).length;
    const want = (c.size / total) * n;
    if (want - have > gap) {
      gap = want - have;
      best = c.id;
    }
  }
  return best;
}

export function join(r: Room, pid: string, lang: Lang, simulated = false): Participant {
  const existing = r.participants.get(pid);
  if (existing) {
    existing.lang = lang;
    return existing;
  }
  const p: Participant = { id: pid, cohort: assignCohort(r), lang, joinedAt: Date.now(), simulated };
  r.participants.set(pid, p);
  return p;
}

export function vote(r: Room, pid: string, choice: 'yes' | 'no') {
  const p = r.participants.get(pid);
  // a participant can only vote if their own cohort actually received a message this broadcast —
  // enforced here too (not just client-side), so a stray or malicious API call can't produce a
  // vote that inflates the tally beyond what tallyVotes()/votableParticipantIds() would count.
  if (!p || !r.broadcast || !r.broadcast.messages[p.cohort]) return false;
  r.votes.set(pid, { choice, at: Date.now() });
  return true;
}

export function setBroadcast(r: Room, b: Omit<RoomBroadcast, 'sentAt'>) {
  r.broadcast = { ...b, sentAt: Date.now() };
  r.votes.clear();
  r.outcome = null;
}

export function setOutcome(r: Room, o: RoomOutcome) {
  r.outcome = o;
}

export function reset(r: Room) {
  r.broadcast = null;
  r.outcome = null;
  r.votes.clear();
}

export function snapshot(r: Room): RoomSnapshot {
  return {
    id: r.id,
    cohorts: r.cohorts,
    participants: [...r.participants.values()],
    votes: Object.fromEntries(r.votes),
    broadcast: r.broadcast,
    outcome: r.outcome,
    now: Date.now(),
  };
}

export function phoneView(r: Room, pid: string): PhoneView {
  const me = r.participants.get(pid);
  if (!me) return { ok: false, now: Date.now() };
  const cohort = r.cohorts.find((c) => c.id === me.cohort);
  const msgs = r.broadcast?.messages[me.cohort];
  const v = r.votes.get(pid) || null;
  let yes = 0,
    no = 0;
  r.votes.forEach((x) => (x.choice === 'yes' ? yes++ : no++));
  let outcome: PhoneView['outcome'] = null;
  if (r.outcome) {
    const key = !msgs ? 'none' : v ? v.choice : 'no';
    const t = r.outcome.texts[me.cohort]?.[key];
    outcome = { text: t ? t[me.lang] : '', headline: r.outcome.headline[me.lang] };
  }
  return {
    ok: true,
    me,
    cohort,
    broadcast: r.broadcast ? { message: msgs ? msgs[me.lang] : null, closesAt: r.broadcast.closesAt, sentAt: r.broadcast.sentAt } : null,
    vote: v,
    outcome,
    tally: { yes, no, people: r.participants.size },
    now: Date.now(),
  };
}
