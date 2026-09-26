'use client';
/*
 * The Room, console side (SOURCE_OF_TRUTH §8.1). The live acceptance rate from real phones
 * overrides the nudge model's p for that cohort, and the evening re-runs with their choices.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { clockFor, comma, mulberry32, personPath, RAVI, simulate, tracePerson, type Lang, type Scenario, type SimResult } from '@/engine';
import { approve, log, store as consoleStore, type ConsoleState, toast } from './console';
import { createStore } from './createStore';
import { crowdMessage, devaDigits, gateOfPath, nudgeVars, zoneName } from './messages';
import { deriveRoomCohortProfile } from './roomProfiles';
import { blendWeight, classifyServerResponse, COMPLIANCE_WEIGHT, deriveChoice, type GroupResponse, type ResponseKind } from './roomResponses';
import { observedAcceptance, responseBreakdown, sumResponseCounts } from './roomVotes';
import { seededGroupSize } from './seededGroup';
import { supabaseBrowser } from './supabase';
import type { PlanSnapshot, RoomCohort, RoomMessage, RoomOutcome, RoomSnapshot, VisitOrigin } from './roomTypes';

export interface RoomState {
  id: string | null;
  url: string;
  visitUrl: string;
  open: boolean;
  snap: RoomSnapshot | null;
  offline: boolean;
  result: { roomYes: number; modelYes: number; crushBefore: number; crushAfter: number; votes: number; perCohort: { id: string; label: string; yes: number; no: number; p: number | null; modelP: number }[] } | null;
  running: boolean;
}

export const roomStore = createStore<RoomState>({ id: null, url: '', visitUrl: '', open: false, snap: null, offline: false, result: null, running: false });
const get = roomStore.getState;
const set = roomStore.setState;

const BLURB: Record<string, string> = {
  nerul_rail: 'on the harbour line into Nerul',
  seawoods_rail: 'on the harbour line into Seawoods',
  taxi_drop: 'coming by cab or auto to Palm Beach Road',
  late_book: 'who booked late and have no room nearby',
};

export function roomCohorts(scn: Scenario): RoomCohort[] {
  return scn.cohorts.filter((c) => c.alt).map((c) => ({ id: c.id, label: c.label, size: c.size, blurb: BLURB[c.id] || c.label.toLowerCase(), ...deriveRoomCohortProfile(scn, c) }));
}

/** one plain-language food-or-stay tip, computed once from whatever run is current when the room
 *  opens (SOURCE_OF_TRUTH §13: idea first, number second) — not re-computed on every plan update,
 *  since it's secondary card content, not the thing "Do it" is meant to change (see docs/DECISIONS.md). */
function originTip(scn: Scenario, res: SimResult, gateId: string, isHotel: boolean): string {
  if (isHotel) return 'Leave with your coach — they tend to fill up before the show starts.';
  const plazaId = scn.links.find((l) => l.gate === gateId)?.from;
  const food = scn.zones.find((z) => z.type === 'food' && z.near === plazaId) || scn.zones.find((z) => z.type === 'food');
  if (!food) return 'No food stalls mapped near your gate yet.';
  const wait = res.foodWaitPeak[food.id] ?? 0;
  return wait > 5 ? `${food.name} gets busy — expect about ${Math.round(wait)} min in line.` : `${food.name} nearby usually has a short line.`;
}

/** /visit's "coming from" list — every cohort (not just the Room's own alt-having ones, since a
 *  visitor's real station/area/hotel should always be pickable, whether or not it's ever nudged). */
export function visitOrigins(scn: Scenario, res: SimResult): VisitOrigin[] {
  return scn.cohorts.map((c) => {
    const profile = deriveRoomCohortProfile(scn, c);
    const mainGateId = gateOfPath(scn, c.path) || '';
    const altGateId = c.alt ? gateOfPath(scn, c.alt) || null : null;
    const originZoneId = scn.links.find((l) => l.id === c.path[0])?.from;
    const isHotel = scn.zones.find((z) => z.id === originZoneId)?.type === 'hotel';
    return {
      id: c.id,
      label: c.label,
      originLabel: profile.originLabel,
      transportMode: profile.transportMode,
      meanTick: c.mean,
      mainGateId,
      mainGateName: zoneName(scn, mainGateId),
      altGateId,
      altGateName: altGateId ? zoneName(scn, altGateId) : null,
      isHotel,
      tip: originTip(scn, res, mainGateId, isHotel),
    };
  });
}

let poll: ReturnType<typeof setInterval> | undefined;
let channel: RealtimeChannel | null = null;

async function refresh() {
  const id = get().id;
  if (!id || get().offline) return;
  try {
    const r = await fetch(`/api/room/${id}`, { cache: 'no-store' });
    if (r.ok) set({ snap: await r.json() });
  } catch {
    /* keep last snapshot */
  }
}

/**
 * Live updates via Supabase Realtime (Postgres Changes on rooms/participants/votes for this room),
 * so a phone joining or voting reaches the console within tens of milliseconds, not up to a second
 * of polling delay. `refresh()` re-fetches the whole snapshot on any change rather than trying to
 * apply the raw change payload — simpler, and cheap enough at this scale (a few hundred rows).
 * The 1s poll stays on as a safety net in case a Realtime connection silently drops; it just runs
 * less often once Realtime is confirmed connected.
 */
function subscribeRealtime(roomId: string) {
  const sb = supabaseBrowser();
  channel?.unsubscribe();
  channel = null;
  clearInterval(poll);
  poll = setInterval(refresh, sb ? 4000 : 1000);
  if (!sb) return;
  channel = sb
    .channel(`room:${roomId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter: `room_id=eq.${roomId}` }, refresh)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') poll = (clearInterval(poll), setInterval(refresh, 4000));
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') poll = (clearInterval(poll), setInterval(refresh, 1000));
    });
}

export async function openRoom() {
  if (get().id) {
    set({ open: true });
    return;
  }
  const s = consoleStore.getState();
  const scn = s.scn;
  const cohorts = roomCohorts(scn);
  const baseRes = s.approved?.result || s.base;
  const origins = visitOrigins(scn, baseRes);
  const baseGateWaitPeak = s.base.gateWaitPeak;
  try {
    const r = await fetch('/api/room', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cohorts, scenarioId: scn.id || 'unknown', t0Min: scn.t0Min, origins, baseGateWaitPeak }),
    }).then((x) => x.json());
    if (!r.id) throw new Error(r.error || 'createRoom failed');
    let origin = window.location.origin;
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)) {
      const net = await fetch('/api/net').then((x) => x.json()).catch(() => ({ ips: [] }));
      if (net.ips?.[0]) origin = `${window.location.protocol}//${net.ips[0]}:${window.location.port || '3000'}`;
    }
    set({ id: r.id, url: `${origin}/join/${r.id}`, visitUrl: `${origin}/visit/${r.id}`, open: true, offline: false });
    subscribeRealtime(r.id);
    refresh();
  } catch {
    // no server: the room still works as a simulation on this machine
    set({
      id: 'LOCAL',
      url: '',
      visitUrl: '',
      open: true,
      offline: true,
      snap: { id: 'LOCAL', cohorts, participants: [], votes: {}, broadcast: null, outcome: null, t0Min: scn.t0Min, origins, baseGateWaitPeak, plan: null, now: Date.now() },
    });
    toast('No network. The room runs as a simulation on this machine.');
  }
}

export const closeRoom = () => set({ open: false });

async function post(action: string, body: Record<string, unknown>) {
  const id = get().id;
  if (!id || get().offline) return null;
  const r = await fetch(`/api/room/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...body }) });
  const j = await r.json();
  if (j && j.participants) set({ snap: j });
  return j;
}

/** messages for every cohort the plan nudges, in every language, numbers injected from the run */
function planMessages(): Record<string, Record<Lang, RoomMessage>> {
  const s = consoleStore.getState();
  const ivs = s.approved?.ivs || [];
  const res: SimResult = s.approved?.result || s.base;
  const out: Record<string, Record<Lang, RoomMessage>> = {};
  for (const iv of ivs) {
    if (iv.type !== 'nudge') continue;
    const v = nudgeVars(s.scn, iv.cohort, res, iv.rupees, iv.delta);
    out[iv.cohort] = { mr: crowdMessage('mr', iv.ask, v), hi: crowdMessage('hi', iv.ask, v), en: crowdMessage('en', iv.ask, v) };
  }
  return out;
}

export async function sendToRoom(seconds = 25) {
  const messages = planMessages();
  if (!Object.keys(messages).length) {
    toast('This plan sends no message to the crowd.');
    return;
  }
  set({ result: null });
  const closesAt = Date.now() + seconds * 1000;
  if (get().offline) {
    set((st) => ({ snap: st.snap ? { ...st.snap, broadcast: { planId: 'plan', sentAt: Date.now(), closesAt, messages }, votes: {}, outcome: null } : null }));
  } else await post('broadcast', { broadcast: { planId: consoleStore.getState().approved?.name || 'plan', closesAt, messages } });
  log('orders_sent', `Sent the crowd message to the room (${Object.keys(messages).length} groups).`, { cohorts: Object.keys(messages) });
}

/**
 * Illustrative, seeded (not `Math.random()`) distribution over response kinds, built off the
 * model's own acceptance probability `p` for that cohort — a fixed, documented split, not a
 * second acceptance model. accept/already_moved scale with p; decline/ignore/too_late scale with
 * (1-p). This is what simulated phones draw from; a real phone's answer is never drawn, only sent.
 */
function drawResponse(rnd: () => number, p: number): ResponseKind {
  const u = rnd();
  const accept = p * 0.75;
  const alreadyMoved = accept + p * 0.25;
  const decline = alreadyMoved + (1 - p) * 0.55;
  const ignore = decline + (1 - p) * 0.3;
  if (u < accept) return 'accept';
  if (u < alreadyMoved) return 'already_moved';
  if (u < decline) return 'decline';
  if (u < ignore) return 'ignore';
  return 'too_late';
}

/** Compliant responses mostly bring the whole group; non-compliant ones mostly don't — illustrative. */
function drawGroupResponse(rnd: () => number, response: ResponseKind): GroupResponse {
  const u = rnd();
  if (COMPLIANCE_WEIGHT[response] > 0) return u < 0.7 ? 'all' : u < 0.9 ? 'individual' : 'none';
  return u < 0.6 ? 'none' : u < 0.85 ? 'individual' : 'all';
}

/** fallback: fake phones that respond with a distribution built off the model's own probability (seeded, repeatable) */
export async function simulateRoom(n = 24) {
  const s = consoleStore.getState();
  const res = s.approved?.result || s.base;
  const rnd = mulberry32(4242 + (get().snap?.participants.length || 0));
  const cohorts = get().snap?.cohorts || roomCohorts(s.scn);
  if (get().offline) {
    const participants = [...(get().snap?.participants || [])];
    const votes = { ...(get().snap?.votes || {}) };
    const total = cohorts.reduce((a, c) => a + c.size, 0);
    const closesAt = get().snap?.broadcast?.closesAt ?? Infinity;
    for (let i = 0; i < n; i++) {
      let pick = cohorts[0],
        acc = 0;
      const u = rnd() * total;
      for (const c of cohorts) {
        acc += c.size;
        if (u <= acc) {
          pick = c;
          break;
        }
      }
      const id = 'sim-' + participants.length;
      participants.push({ id, cohort: pick.id, lang: (['mr', 'hi', 'en'] as Lang[])[i % 3], joinedAt: Date.now(), simulated: true, groupSize: seededGroupSize(id) });
      // a simulated phone can only respond where a real phone could: its cohort must actually have
      // received a message in this broadcast. Voting for an un-nudged cohort was the bug that
      // made the live tally (all votes) disagree with the result footnote (nudged-only votes).
      const msg = get().snap?.broadcast?.messages[pick.id];
      if (msg) {
        const p = res.nudgeInfo.find((x) => x.cohort === pick.id)?.p ?? 0.3;
        const now = Date.now();
        const drawn = classifyServerResponse(drawResponse(rnd, p), now, closesAt);
        const groupResponse = drawGroupResponse(rnd, drawn);
        const delayMs = 1000 + Math.floor(rnd() * 15000);
        votes[id] = { choice: deriveChoice(drawn), response: drawn, groupResponse, at: now, seenAt: now, respondedAt: now + delayMs, responseDelayMs: delayMs };
      }
    }
    set((st) => ({ snap: st.snap ? { ...st.snap, participants, votes } : null }));
    return;
  }
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const pid = 'sim-' + Math.floor(rnd() * 1e9).toString(36);
    ids.push(pid);
    await post('join', { pid, lang: (['mr', 'hi', 'en'] as Lang[])[i % 3], simulated: true });
  }
  // post('join') returns a phoneView, not a room snapshot, so get().snap can still be missing the
  // participants just joined above (it only updates from a snapshot-shaped response, or whenever
  // the background poll/Realtime happens to fire) — refresh explicitly so every simulated phone's
  // cohort is known before deciding who can respond.
  await refresh();
  const snap = get().snap;
  if (snap?.broadcast) {
    const broadcast = snap.broadcast;
    // fire every phone's seen+respond concurrently (each with its own short, seeded jitter before
    // responding) rather than one after another — sequential real network round-trips for 24+
    // phones would make the button noticeably slow, and it's still genuine server timestamps, just
    // not artificially spread over the multi-second range the offline branch above uses.
    await Promise.all(
      ids.map(async (pid) => {
        const p = snap.participants.find((x) => x.id === pid);
        // same rule as the offline branch above: only respond where the cohort actually has a message.
        if (!p || !broadcast.messages[p.cohort]) return;
        const pr = res.nudgeInfo.find((x) => x.cohort === p.cohort)?.p ?? 0.3;
        const drawn = drawResponse(rnd, pr);
        const groupResponse = drawGroupResponse(rnd, drawn);
        const jitterMs = 200 + Math.floor(rnd() * 2800);
        await post('seen', { pid });
        await new Promise((r) => setTimeout(r, jitterMs));
        await post('vote', { pid, response: drawn, groupResponse });
      }),
    );
  }
  refresh();
}

/**
 * acceptOverride[cohort] = a small-sample-aware blend of the observed compliance rate and the
 * model's own p (§17/§18 of the room-upgrade brief): below MIN_RESPONSES_FOR_OVERRIDE the room has
 * zero weight (identical to the model), ramping to full weight at STRONG_SAMPLE_THRESHOLD. This
 * replaces the old flat "yes / (yes+no), ignore below 2 votes" cutoff with something that can't
 * let a handful of phones swing a plan meant for thousands, while still moving smoothly once
 * there's a real sample.
 */
export async function runWithRoom() {
  const snap = get().snap;
  const s = consoleStore.getState();
  if (!snap || !s.approved) return;
  set({ running: true });
  const now = Date.now();
  // responseBreakdown/observedAcceptance (roomVotes.ts) share one definition of "votable" and one
  // compliance weighting, so this per-cohort breakdown always agrees with the live panel in
  // RoomPanel.tsx and with the room-wide total below.
  const byCohort = responseBreakdown(snap, now);
  const override: Record<string, number> = {};
  const nudged = s.approved.ivs.filter((iv) => iv.type === 'nudge').map((iv) => (iv as { cohort: string }).cohort);
  const modelRes = simulate(s.scn, s.approved.ivs, { waits: s.waits, lite: true });
  const perCohort = nudged.map((id) => {
    const b = byCohort[id];
    const modelP = modelRes.nudgeInfo.find((x) => x.cohort === id)?.p ?? 0;
    const { n, rate } = observedAcceptance(byCohort, id);
    const w = blendWeight(n);
    const p = n > 0 ? modelP * (1 - w) + rate * w : null;
    if (p != null) override[id] = p;
    const yes = (b?.accepted ?? 0) + (b?.alreadyMoved ?? 0);
    const no = (b?.declined ?? 0) + (b?.ignored ?? 0) + (b?.tooLate ?? 0);
    return { id, label: s.scn.cohorts.find((c) => c.id === id)?.label || id, yes, no, p, modelP };
  });
  const totals = sumResponseCounts(byCohort);
  const votes = totals.accepted + totals.declined + totals.alreadyMoved + totals.tooLate + totals.ignored;
  const yesAll = totals.accepted + totals.alreadyMoved;
  const sizes = perCohort.map((c) => s.scn.cohorts.find((x) => x.id === c.id)?.size || 0);
  const modelYes = perCohort.reduce((a, c, i) => a + c.modelP * sizes[i], 0) / Math.max(1, sizes.reduce((a, b) => a + b, 0));
  const roomYes = votes ? yesAll / votes : 0;
  const crushBefore = s.approved.result.crushMin;
  const note = `The room said yes ${Math.round(roomYes * 100)}%. The model predicted ${Math.round(modelYes * 100)}%.`;
  approve(Object.keys(override).length ? override : undefined, note);
  const after = consoleStore.getState().approved!.result;
  set({ running: false, result: { roomYes, modelYes, crushBefore, crushAfter: after.crushMin, votes, perCohort } });
  await publishOutcome(roomYes, modelYes);
}

/** "what happened to people like you": each phone's own evening, traced through the re-run */
async function publishOutcome(roomYes: number, modelYes: number) {
  const s = consoleStore.getState();
  const res = s.approved!.result;
  const clock = (t: number) => clockFor(s.scn, t);
  const texts: RoomOutcome['texts'] = {};
  const cohorts = get().snap?.cohorts || [];
  const nudged = new Set(s.approved!.ivs.filter((iv) => iv.type === 'nudge').map((iv) => (iv as { cohort: string }).cohort));
  for (const rc of cohorts) {
    const c = s.scn.cohorts.find((x) => x.id === rc.id)!;
    const release = c.id === RAVI.cohort ? RAVI.release : Math.round(Math.min(s.scn.horizon - 60, c.mean));
    const ghost = tracePerson(s.scn, s.base, c.path, release);
    const stay = tracePerson(s.scn, res, c.path, release);
    const move = c.alt ? tracePerson(s.scn, res, c.alt, release) : stay;
    const gate = (p: string[]) => s.scn.zones.find((z) => z.id === s.scn.links.find((l) => l.id === p[p.length - 2])?.gate)?.name || '';
    const mk = (tr: typeof stay, how: 'yes' | 'no' | 'none'): Record<Lang, string> => {
      const sooner = Math.max(0, ghost.inside - tr.inside);
      const g = gate(tr.path);
      const gn = g.replace(/[^0-9]/g, '');
      const en =
        (how === 'yes' ? `You walked to ${g}. ` : how === 'no' ? `You stayed on your usual route to ${g}. ` : `Your route was fine tonight. `) +
        `You got in at ${clock(tr.inside)}${sooner > 0 ? `, ${sooner} minutes sooner than if nobody had acted` : ''}. The tightest crowd you stood in: ${tr.worst.toFixed(1)} people per m²${ghost.worst > tr.worst + 0.2 ? ` instead of ${ghost.worst.toFixed(1)}` : ''}.`;
      const hi =
        (how === 'yes' ? `आप गेट ${gn} गए। ` : how === 'no' ? `आप अपने रोज़ के रास्ते से गेट ${gn} गए। ` : `आज आपका रास्ता ठीक था। `) +
        `आप ${clock(tr.inside)} पर अंदर पहुँचे${sooner > 0 ? `, कुछ न करने की तुलना में ${sooner} मिनट पहले` : ''}। सबसे घनी भीड़: ${tr.worst.toFixed(1)} लोग प्रति वर्ग मीटर${ghost.worst > tr.worst + 0.2 ? `, ${ghost.worst.toFixed(1)} की जगह` : ''}।`;
      const mr = devaDigits(
        (how === 'yes' ? `तुम्ही गेट ${gn} कडे गेलात. ` : how === 'no' ? `तुम्ही नेहमीच्या मार्गाने गेट ${gn} कडे गेलात. ` : `आज तुमचा मार्ग ठीक होता. `) +
          `तुम्ही ${clock(tr.inside)} ला आत पोहोचलात${sooner > 0 ? `, काहीच न केलं असतं त्यापेक्षा ${sooner} मिनिटं आधी` : ''}. सर्वात दाट गर्दी: ${tr.worst.toFixed(1)} लोक प्रति चौ. मी.${ghost.worst > tr.worst + 0.2 ? `, ${ghost.worst.toFixed(1)} ऐवजी` : ''}.`,
      );
      return { en, hi, mr };
    };
    texts[rc.id] = nudged.has(rc.id) ? { yes: mk(move, 'yes'), no: mk(stay, 'no'), none: mk(stay, 'none') } : { yes: mk(stay, 'none'), no: mk(stay, 'none'), none: mk(stay, 'none') };
  }
  const ry = Math.round(roomYes * 100),
    my = Math.round(modelYes * 100);
  const outcome: RoomOutcome = {
    texts,
    headline: {
      en: `The room said yes ${ry}%. The model predicted ${my}%. ${comma(s.base.crushMin)} → ${comma(res.crushMin)} dangerous minutes.`,
      hi: `कमरे ने ${ry}% हाँ कहा। मॉडल ने ${my}% सोचा था। खतरनाक मिनट: ${comma(s.base.crushMin)} → ${comma(res.crushMin)}।`,
      mr: devaDigits(`खोलीने ${ry}% हो म्हटलं. मॉडेलचा अंदाज ${my}% होता. धोकादायक मिनिटं: ${s.base.crushMin} → ${res.crushMin}.`),
    },
  };
  if (get().offline) set((st) => ({ snap: st.snap ? { ...st.snap, outcome } : null }));
  else await post('outcome', { outcome });
}

export async function resetRoomVotes() {
  set({ result: null });
  if (get().offline) set((st) => ({ snap: st.snap ? { ...st.snap, broadcast: null, votes: {}, outcome: null } : null }));
  else await post('reset', {});
}

/**
 * /visit's "Do it" moment (SOURCE_OF_TRUTH-adjacent build brief): whenever the head approves or
 * updates a plan — the exact same `approve()`/`approveReplacement()` Live Ops's "Do it" button
 * already calls — and a Room is open, push a small plan snapshot onto the room row so every open
 * /visit card can update and buzz. Lives here (not in lib/console.ts) specifically to avoid a
 * circular import: this file already depends on lib/console.ts, so console.ts calling back into
 * this file would cycle; subscribing to the store it already imports does not.
 */
function planSnapshot(scn: Scenario, approved: NonNullable<ConsoleState['approved']>): PlanSnapshot {
  const redirects: Record<string, true> = {};
  for (const iv of approved.ivs) {
    if (iv.type === 'nudge' && iv.ask === 'reroute') redirects[iv.cohort] = true;
  }
  return { approvedAt: Date.now(), redirects, gateWaitPeak: approved.result.gateWaitPeak };
}

let lastApproved: ConsoleState['approved'] = null;
if (typeof window !== 'undefined') {
  consoleStore.subscribe(() => {
    const s = consoleStore.getState();
    if (s.approved === lastApproved) return;
    lastApproved = s.approved;
    const id = get().id;
    if (!s.approved || !id) return;
    const plan = planSnapshot(s.scn, s.approved);
    if (get().offline) set((st) => ({ snap: st.snap ? { ...st.snap, plan } : null }));
    else post('plan', { plan });
  });
}
