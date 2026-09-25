'use client';
/*
 * The Room, console side (SOURCE_OF_TRUTH §8.1). The live acceptance rate from real phones
 * overrides the nudge model's p for that cohort, and the evening re-runs with their choices.
 */
import { clockFor, comma, mulberry32, personPath, RAVI, simulate, tracePerson, type Lang, type Scenario, type SimResult } from '@/engine';
import { approve, log, store as consoleStore, toast } from './console';
import { createStore } from './createStore';
import { crowdMessage, devaDigits, nudgeVars } from './messages';
import type { RoomCohort, RoomMessage, RoomOutcome, RoomSnapshot } from './roomTypes';

export interface RoomState {
  id: string | null;
  url: string;
  open: boolean;
  snap: RoomSnapshot | null;
  offline: boolean;
  result: { roomYes: number; modelYes: number; crushBefore: number; crushAfter: number; votes: number; perCohort: { id: string; label: string; yes: number; no: number; p: number | null; modelP: number }[] } | null;
  running: boolean;
}

export const roomStore = createStore<RoomState>({ id: null, url: '', open: false, snap: null, offline: false, result: null, running: false });
const get = roomStore.getState;
const set = roomStore.setState;

const BLURB: Record<string, string> = {
  nerul_rail: 'on the harbour line into Nerul',
  seawoods_rail: 'on the harbour line into Seawoods',
  taxi_drop: 'coming by cab or auto to Palm Beach Road',
  late_book: 'who booked late and have no room nearby',
};

export function roomCohorts(scn: Scenario): RoomCohort[] {
  return scn.cohorts.filter((c) => c.alt).map((c) => ({ id: c.id, label: c.label, size: c.size, blurb: BLURB[c.id] || c.label.toLowerCase() }));
}

let poll: ReturnType<typeof setInterval> | undefined;
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

export async function openRoom() {
  if (get().id) {
    set({ open: true });
    return;
  }
  const scn = consoleStore.getState().scn;
  const cohorts = roomCohorts(scn);
  try {
    const r = await fetch('/api/room', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cohorts }) }).then((x) => x.json());
    let origin = window.location.origin;
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)) {
      const net = await fetch('/api/net').then((x) => x.json()).catch(() => ({ ips: [] }));
      if (net.ips?.[0]) origin = `${window.location.protocol}//${net.ips[0]}:${window.location.port || '3000'}`;
    }
    set({ id: r.id, url: `${origin}/join/${r.id}`, open: true, offline: false });
    clearInterval(poll);
    poll = setInterval(refresh, 1000);
    refresh();
  } catch {
    // no server: the room still works as a simulation on this machine
    set({ id: 'LOCAL', url: '', open: true, offline: true, snap: { id: 'LOCAL', cohorts, participants: [], votes: {}, broadcast: null, outcome: null, now: Date.now() } });
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

/** fallback: fake phones that vote with the model's own probability (seeded, repeatable) */
export async function simulateRoom(n = 24) {
  const s = consoleStore.getState();
  const res = s.approved?.result || s.base;
  const rnd = mulberry32(4242 + (get().snap?.participants.length || 0));
  const cohorts = get().snap?.cohorts || roomCohorts(s.scn);
  if (get().offline) {
    const participants = [...(get().snap?.participants || [])];
    const votes = { ...(get().snap?.votes || {}) };
    const total = cohorts.reduce((a, c) => a + c.size, 0);
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
      participants.push({ id, cohort: pick.id, lang: (['mr', 'hi', 'en'] as Lang[])[i % 3], joinedAt: Date.now(), simulated: true });
      const p = res.nudgeInfo.find((x) => x.cohort === pick.id)?.p ?? 0.3;
      if (get().snap?.broadcast) votes[id] = { choice: rnd() < p ? 'yes' : 'no', at: Date.now() };
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
  const snap = get().snap;
  if (snap?.broadcast) {
    for (const pid of ids) {
      const p = snap.participants.find((x) => x.id === pid);
      const pr = res.nudgeInfo.find((x) => x.cohort === p?.cohort)?.p ?? 0.3;
      await post('vote', { pid, choice: rnd() < pr ? 'yes' : 'no' });
    }
  }
  refresh();
}

/** acceptOverride[cohort] = yes / (yes + no); cohorts with fewer than 2 votes keep the model's p */
export async function runWithRoom() {
  const snap = get().snap;
  const s = consoleStore.getState();
  if (!snap || !s.approved) return;
  set({ running: true });
  const byCohort: Record<string, { yes: number; no: number }> = {};
  for (const [pid, v] of Object.entries(snap.votes)) {
    const p = snap.participants.find((x) => x.id === pid);
    if (!p) continue;
    const b = (byCohort[p.cohort] ||= { yes: 0, no: 0 });
    v.choice === 'yes' ? b.yes++ : b.no++;
  }
  const override: Record<string, number> = {};
  const nudged = s.approved.ivs.filter((iv) => iv.type === 'nudge').map((iv) => (iv as { cohort: string }).cohort);
  const modelRes = simulate(s.scn, s.approved.ivs, { waits: s.waits, lite: true });
  const perCohort = nudged.map((id) => {
    const b = byCohort[id] || { yes: 0, no: 0 };
    const n = b.yes + b.no;
    const modelP = modelRes.nudgeInfo.find((x) => x.cohort === id)?.p ?? 0;
    const p = n >= 2 ? b.yes / n : null;
    if (p != null) override[id] = p;
    return { id, label: s.scn.cohorts.find((c) => c.id === id)?.label || id, yes: b.yes, no: b.no, p, modelP };
  });
  const votes = perCohort.reduce((a, c) => a + c.yes + c.no, 0);
  const yesAll = perCohort.reduce((a, c) => a + c.yes, 0);
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
