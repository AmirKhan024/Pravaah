import 'server-only';
/*
 * The Room, Supabase backend (Phase 2). Every write goes through supabaseAdmin() (service-role
 * key, bypasses RLS) from server code only. Table shapes: supabase/schema.sql. Room state now
 * survives a refresh and works across Vercel's multiple serverless instances, unlike the old
 * single-process in-memory Map.
 */
import type { Lang } from '@/engine';
import { classifyServerResponse, deriveChoice, type ResponseKind } from './roomResponses';
import { seededGroupSize } from './seededGroup';
import { supabaseAdmin } from './supabase';
import type { GroupResponse, Participant, PhoneView, PlanSnapshot, RoomBroadcast, RoomCohort, RoomOutcome, RoomSnapshot, Vote, VisitOrigin } from './roomTypes';

const WORDS = ['GATE', 'FLOW', 'NERUL', 'RIVER', 'LANE', 'PATH', 'TIDE', 'BRASS'];
function newId() {
  const w = WORDS[Math.floor(Math.random() * WORDS.length)];
  return w + '-' + Math.floor(100 + Math.random() * 900);
}

function db() {
  const c = supabaseAdmin();
  if (!c) throw new Error('Supabase admin client unavailable — supabaseConfigured() should have been checked first');
  return c;
}

export async function createRoom(
  cohorts: RoomCohort[],
  scenarioId: string,
  t0Min = 0,
  origins: VisitOrigin[] = [],
  baseGateWaitPeak: Record<string, number> = {},
): Promise<{ id: string }> {
  const c = db();
  for (let attempt = 0; attempt < 8; attempt++) {
    const id = newId();
    const { error } = await c.from('rooms').insert({ id, scenario_id: scenarioId, cohorts, status: 'open', t0_min: t0Min, origins, base_gate_wait_peak: baseGateWaitPeak, plan: null });
    if (!error) return { id };
    // unique-violation on id -> collision, try another code; any other error -> surface it
    if (error.code !== '23505') throw new Error('createRoom failed: ' + error.message);
  }
  throw new Error('createRoom: could not find a free room code after 8 attempts');
}

export async function roomExists(id: string): Promise<boolean> {
  const { data, error } = await db().from('rooms').select('id').eq('id', id.toUpperCase()).maybeSingle();
  if (error) throw new Error('roomExists failed: ' + error.message);
  return !!data;
}

async function getRoomRow(id: string) {
  const { data, error } = await db().from('rooms').select('id, cohorts, broadcast, outcome, t0_min, origins, base_gate_wait_peak, plan').eq('id', id.toUpperCase()).maybeSingle();
  if (error) throw new Error('getRoomRow failed: ' + error.message);
  return data as {
    id: string;
    cohorts: RoomCohort[];
    broadcast: RoomBroadcast | null;
    outcome: RoomOutcome | null;
    t0_min: number | null;
    origins: VisitOrigin[] | null;
    base_gate_wait_peak: Record<string, number> | null;
    plan: PlanSnapshot | null;
  } | null;
}

async function assignCohort(roomId: string, cohorts: RoomCohort[]): Promise<string> {
  const { data, error } = await db().from('participants').select('cohort').eq('room_id', roomId);
  if (error) throw new Error('assignCohort failed: ' + error.message);
  const counts = new Map<string, number>();
  for (const row of data || []) counts.set(row.cohort, (counts.get(row.cohort) || 0) + 1);
  const total = cohorts.reduce((a, c) => a + c.size, 0) || 1;
  const n = (data?.length || 0) + 1;
  let best = cohorts[0].id,
    gap = -Infinity;
  for (const c of cohorts) {
    const have = counts.get(c.id) || 0;
    const want = (c.size / total) * n;
    if (want - have > gap) {
      gap = want - have;
      best = c.id;
    }
  }
  return best;
}

export async function join(id: string, pid: string, lang: Lang, simulated = false): Promise<Participant | null> {
  const room = await getRoomRow(id);
  if (!room) return null;
  const { data: existing } = await db().from('participants').select('id, room_id, cohort, lang, joined_at, simulated, group_size').eq('id', pid).maybeSingle();
  if (existing) {
    if (existing.lang !== lang) await db().from('participants').update({ lang }).eq('id', pid);
    return { id: existing.id, cohort: existing.cohort, lang, joinedAt: +new Date(existing.joined_at), simulated: existing.simulated, groupSize: existing.group_size };
  }
  const cohort = await assignCohort(room.id, room.cohorts);
  const joinedAt = Date.now();
  const groupSize = seededGroupSize(pid);
  const { error } = await db().from('participants').insert({ id: pid, room_id: room.id, cohort, lang, simulated, joined_at: new Date(joinedAt).toISOString(), group_size: groupSize });
  if (error) {
    // a concurrent insert of the same pid (rare, harmless) — just read it back
    if (error.code === '23505') {
      const { data } = await db().from('participants').select('id, cohort, lang, joined_at, simulated, group_size').eq('id', pid).maybeSingle();
      if (data) return { id: data.id, cohort: data.cohort, lang: data.lang, joinedAt: +new Date(data.joined_at), simulated: data.simulated, groupSize: data.group_size };
    }
    throw new Error('join failed: ' + error.message);
  }
  return { id: pid, cohort, lang, joinedAt, simulated, groupSize };
}

export async function markSeen(id: string, pid: string): Promise<void> {
  const room = await getRoomRow(id);
  if (!room || !room.broadcast) return;
  const { data: p } = await db().from('participants').select('cohort').eq('id', pid).eq('room_id', room.id).maybeSingle();
  if (!p || !room.broadcast.messages[p.cohort]) return;
  const { data: existing } = await db().from('votes').select('participant_id, seen_at').eq('participant_id', pid).maybeSingle();
  if (existing?.seen_at) return; // already recorded for this broadcast
  const seenAt = new Date().toISOString();
  if (existing) await db().from('votes').update({ seen_at: seenAt }).eq('participant_id', pid);
  else await db().from('votes').insert({ participant_id: pid, room_id: room.id, plan_id: room.broadcast.planId, seen_at: seenAt });
}

export async function vote(id: string, pid: string, response: ResponseKind, groupResponse?: GroupResponse | null): Promise<boolean> {
  const room = await getRoomRow(id);
  if (!room || !room.broadcast) return false;
  const { data: p } = await db().from('participants').select('cohort').eq('id', pid).eq('room_id', room.id).maybeSingle();
  if (!p || !room.broadcast.messages[p.cohort]) return false;
  const now = Date.now();
  const classified = classifyServerResponse(response, now, room.broadcast.closesAt);
  const { data: existing } = await db().from('votes').select('seen_at').eq('participant_id', pid).maybeSingle();
  const seenAt = existing?.seen_at ? +new Date(existing.seen_at) : null;
  const { error } = await db().from('votes').upsert(
    {
      participant_id: pid,
      room_id: room.id,
      plan_id: room.broadcast.planId,
      choice: deriveChoice(classified),
      response: classified,
      group_response: groupResponse ?? null,
      seen_at: existing?.seen_at ?? null,
      responded_at: new Date(now).toISOString(),
      response_delay_ms: seenAt ? now - seenAt : null,
      created_at: new Date(now).toISOString(),
    },
    { onConflict: 'participant_id' },
  );
  if (error) throw new Error('vote failed: ' + error.message);
  return true;
}

export async function setBroadcast(id: string, b: Omit<RoomBroadcast, 'sentAt'>): Promise<void> {
  const broadcast: RoomBroadcast = { ...b, sentAt: Date.now() };
  const roomId = id.toUpperCase();
  await db().from('votes').delete().eq('room_id', roomId);
  const { error } = await db().from('rooms').update({ broadcast, outcome: null }).eq('id', roomId);
  if (error) throw new Error('setBroadcast failed: ' + error.message);
}

export async function setOutcome(id: string, o: RoomOutcome): Promise<void> {
  const { error } = await db().from('rooms').update({ outcome: o }).eq('id', id.toUpperCase());
  if (error) throw new Error('setOutcome failed: ' + error.message);
}

export async function setPlan(id: string, plan: PlanSnapshot): Promise<void> {
  const { error } = await db().from('rooms').update({ plan }).eq('id', id.toUpperCase());
  if (error) throw new Error('setPlan failed: ' + error.message);
}

export async function reset(id: string): Promise<void> {
  const roomId = id.toUpperCase();
  await db().from('votes').delete().eq('room_id', roomId);
  const { error } = await db().from('rooms').update({ broadcast: null, outcome: null }).eq('id', roomId);
  if (error) throw new Error('reset failed: ' + error.message);
}

interface VoteRow {
  participant_id: string;
  choice: 'yes' | 'no' | null;
  response: ResponseKind | null;
  group_response: GroupResponse | null;
  seen_at: string | null;
  responded_at: string | null;
  response_delay_ms: number | null;
  created_at: string;
}

async function loadVotes(roomId: string): Promise<Record<string, Vote>> {
  const { data, error } = await db().from('votes').select('participant_id, choice, response, group_response, seen_at, responded_at, response_delay_ms, created_at').eq('room_id', roomId);
  if (error) throw new Error('loadVotes failed: ' + error.message);
  const out: Record<string, Vote> = {};
  for (const row of (data || []) as VoteRow[])
    out[row.participant_id] = {
      choice: row.choice ?? undefined,
      at: +new Date(row.created_at),
      response: row.response ?? undefined,
      groupResponse: row.group_response,
      seenAt: row.seen_at ? +new Date(row.seen_at) : null,
      respondedAt: row.responded_at ? +new Date(row.responded_at) : null,
      responseDelayMs: row.response_delay_ms,
    };
  return out;
}

export async function snapshot(id: string): Promise<RoomSnapshot | null> {
  const room = await getRoomRow(id);
  if (!room) return null;
  const [{ data: parts, error: pErr }, votes] = await Promise.all([db().from('participants').select('id, cohort, lang, joined_at, simulated, group_size').eq('room_id', room.id), loadVotes(room.id)]);
  if (pErr) throw new Error('snapshot participants failed: ' + pErr.message);
  const participants: Participant[] = (parts || []).map((p) => ({ id: p.id, cohort: p.cohort, lang: p.lang as Lang, joinedAt: +new Date(p.joined_at), simulated: p.simulated, groupSize: p.group_size }));
  return {
    id: room.id,
    cohorts: room.cohorts,
    participants,
    votes,
    broadcast: room.broadcast,
    outcome: room.outcome,
    t0Min: room.t0_min ?? 0,
    origins: room.origins ?? [],
    baseGateWaitPeak: room.base_gate_wait_peak ?? {},
    plan: room.plan,
    now: Date.now(),
  };
}

export async function phoneView(id: string, pid: string): Promise<PhoneView> {
  const room = await getRoomRow(id);
  if (!room) return { ok: false, now: Date.now() };
  const { data: me } = await db().from('participants').select('id, cohort, lang, joined_at, simulated, group_size').eq('id', pid).eq('room_id', room.id).maybeSingle();
  if (!me) return { ok: false, now: Date.now() };
  const cohort = room.cohorts.find((c) => c.id === me.cohort);
  const msgs = room.broadcast?.messages[me.cohort];
  const votes = await loadVotes(room.id);
  const raw = votes[pid] || null;
  // a "seen" placeholder (no response yet) is not a vote — don't expose or count it as one
  const v = raw && raw.response ? raw : null;
  let yes = 0,
    no = 0;
  for (const x of Object.values(votes)) {
    if (x.choice === 'yes') yes++;
    else if (x.choice === 'no') no++;
  }
  const { count: people } = await db().from('participants').select('id', { count: 'exact', head: true }).eq('room_id', room.id);
  let outcome: PhoneView['outcome'] = null;
  if (room.outcome) {
    const key = !msgs ? 'none' : v ? v.choice! : 'no';
    const t = room.outcome.texts[me.cohort]?.[key];
    outcome = { text: t ? t[me.lang as Lang] : '', headline: room.outcome.headline[me.lang as Lang] };
  }
  return {
    ok: true,
    me: { id: me.id, cohort: me.cohort, lang: me.lang as Lang, joinedAt: +new Date(me.joined_at), simulated: me.simulated, groupSize: me.group_size },
    cohort,
    broadcast: room.broadcast ? { message: msgs ? msgs[me.lang as Lang] : null, closesAt: room.broadcast.closesAt, sentAt: room.broadcast.sentAt } : null,
    vote: v,
    outcome,
    tally: { yes, no, people: people || 0 },
    now: Date.now(),
  };
}
