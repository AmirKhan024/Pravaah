import 'server-only';
/*
 * The original in-memory backend for The Room, kept as the offline/fallback path (Phase 2 §5):
 * used automatically when Supabase isn't configured or NEXT_PUBLIC_DEMO_OFFLINE=1. State lives on
 * `globalThis` for one Node process — doesn't survive a restart, and won't work across multiple
 * Vercel serverless instances, which is exactly why Phase 2 moves the primary path to Supabase.
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

export async function createRoom(cohorts: RoomCohort[], _scenarioId: string): Promise<{ id: string }> {
  void _scenarioId; // kept for signature parity with the Supabase backend; the in-memory Room never tracked it
  let id = newId();
  while (rooms.has(id)) id = newId();
  rooms.set(id, { id, createdAt: Date.now(), cohorts, participants: new Map(), votes: new Map(), broadcast: null, outcome: null });
  if (rooms.size > 30) rooms.delete(rooms.keys().next().value!);
  return { id };
}

export async function roomExists(id: string): Promise<boolean> {
  return rooms.has(id.toUpperCase());
}

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

export async function join(id: string, pid: string, lang: Lang, simulated = false): Promise<Participant | null> {
  const r = rooms.get(id.toUpperCase());
  if (!r) return null;
  const existing = r.participants.get(pid);
  if (existing) {
    existing.lang = lang;
    return existing;
  }
  const p: Participant = { id: pid, cohort: assignCohort(r), lang, joinedAt: Date.now(), simulated };
  r.participants.set(pid, p);
  return p;
}

export async function vote(id: string, pid: string, choice: 'yes' | 'no'): Promise<boolean> {
  const r = rooms.get(id.toUpperCase());
  const p = r?.participants.get(pid);
  if (!r || !p || !r.broadcast || !r.broadcast.messages[p.cohort]) return false;
  r.votes.set(pid, { choice, at: Date.now() });
  return true;
}

export async function setBroadcast(id: string, b: Omit<RoomBroadcast, 'sentAt'>): Promise<void> {
  const r = rooms.get(id.toUpperCase());
  if (!r) return;
  r.broadcast = { ...b, sentAt: Date.now() };
  r.votes.clear();
  r.outcome = null;
}

export async function setOutcome(id: string, o: RoomOutcome): Promise<void> {
  const r = rooms.get(id.toUpperCase());
  if (r) r.outcome = o;
}

export async function reset(id: string): Promise<void> {
  const r = rooms.get(id.toUpperCase());
  if (!r) return;
  r.broadcast = null;
  r.outcome = null;
  r.votes.clear();
}

export async function snapshot(id: string): Promise<RoomSnapshot | null> {
  const r = rooms.get(id.toUpperCase());
  if (!r) return null;
  return { id: r.id, cohorts: r.cohorts, participants: [...r.participants.values()], votes: Object.fromEntries(r.votes), broadcast: r.broadcast, outcome: r.outcome, now: Date.now() };
}

export async function phoneView(id: string, pid: string): Promise<PhoneView> {
  const r = rooms.get(id.toUpperCase());
  if (!r) return { ok: false, now: Date.now() };
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
