'use client';
/*
 * Organiser console state. Every number shown in the console is read from SimResults held here,
 * all produced by the engine (main thread for single full runs, the Worker for searches).
 */
import {
  clockFor,
  comma,
  dyPatil,
  personPath,
  probeWaits,
  PROFILE_NAMES,
  RAVI,
  retime,
  simulate,
  tracePerson,
  applyWhatIf,
  buildNight,
  WHATIFS,
  type AblationRow,
  type BoardOption,
  type EnsembleResult,
  type Intervention,
  type Lever,
  type ProfileName,
  type RedTeamResult,
  type RejectedRow,
  type Scenario,
  type SimOptions,
  type SimResult,
  type Trace,
  type WhatIfId,
  type WhatIfPatch,
} from '@/engine';
import { createStore } from './createStore';
import type { WhatIfSpec } from './whatifParse';
import { engine, proxy } from './engineClient';
import { appendLedger, loadLedger, type LedgerEntry, type LedgerType } from './ledger';

export type Mode = 'intro' | 'story' | 'live' | 'replay' | 'free';
export type Drawer = null | 'about' | 'ledger' | 'report' | 'board' | 'chain' | 'redteam' | 'orders';

export interface PlanSummary {
  chosen: Lever[];
  crushMin: number;
  rupees: number;
  evals: number;
  ms: number;
}

export interface Approved {
  name: string;
  tick: number;
  ivs: Intervention[];
  result: SimResult;
  acceptOverride?: Record<string, number>;
  roomNote?: string;
}

export interface ConsoleState {
  scn: Scenario;
  waits: Record<string, number>;
  base: SimResult;
  cur: SimResult;
  ghost: SimResult | null;
  curLabel: string;
  tick: number;
  playing: boolean;
  speed: number;
  liveSpeed: number;
  stopAt: number | null;
  mode: Mode;
  peek: number | null;
  step: number;
  maxStep: number;
  ens?: EnsembleResult;
  abl?: AblationRow[];
  rejected?: RejectedRow[];
  plans: Partial<Record<ProfileName, PlanSummary>>;
  plansDone?: { evals: number; ms: number };
  board?: BoardOption[];
  progress: Record<string, number>;
  selected: ProfileName | 'Your plan';
  userPlan: Lever[];
  redTeam?: RedTeamResult;
  redTeamFor?: string;
  redTeamBusy: boolean;
  redTeamProgress: number;
  expired: string[];
  replan?: { chosen: Lever[]; crushMin: number; rupees: number; missed: number; atTick: number; lostMin: number };
  replanBusy: boolean;
  approved: Approved | null;
  whatIf: { id: WhatIfId | 'custom'; label: string; say: string; patch?: WhatIfPatch; none: SimResult; withPlan: SimResult | null; source?: string } | null;
  raviCur: Trace;
  raviGhost: Trace | null;
  ledger: LedgerEntry[];
  drawer: Drawer;
  caption: string;
  toast: string;
}

const BASE_SCN = dyPatil;
/** the rehearsal pauses here: the map is calm, and Pravaah already knows how the evening ends */
export const STORY_STOP = 230;

function initial(): ConsoleState {
  const waits = probeWaits(BASE_SCN);
  const base = simulate(BASE_SCN, [], { waits });
  return {
    scn: BASE_SCN,
    waits,
    base,
    cur: base,
    ghost: null,
    curLabel: 'If you do nothing',
    tick: 0,
    playing: false,
    speed: 12,
    liveSpeed: 0.25,
    stopAt: null,
    mode: 'intro',
    peek: null,
    step: 1,
    maxStep: 1,
    plans: {},
    progress: {},
    selected: 'Zero rupees',
    userPlan: [],
    redTeamBusy: false,
    redTeamProgress: 0,
    expired: [],
    replanBusy: false,
    approved: null,
    whatIf: null,
    raviCur: tracePerson(BASE_SCN, base, personPath(BASE_SCN, base), RAVI.release),
    raviGhost: null,
    ledger: [],
    drawer: null,
    caption: '',
    toast: '',
  };
}

export const store = createStore<ConsoleState>(initial());
const get = store.getState;
const set = store.setState;

export const clock = (t: number) => clockFor(get().scn, t);
export const viewTick = (s: ConsoleState = get()) => Math.floor(s.peek ?? s.tick);

/* ---------------- ledger ---------------- */
let ledgerQueue: Promise<unknown> = Promise.resolve();
export function log(type: LedgerType, summary: string, payload: unknown) {
  ledgerQueue = ledgerQueue.then(async () => {
    const next = await appendLedger(get().ledger, type, summary, payload, clock(get().tick));
    set({ ledger: next });
  });
}

/* ---------------- toast / caption ---------------- */
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(t: string) {
  set({ toast: t });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => set({ toast: '' }), 2800);
}
export const caption = (t: string) => set({ caption: t });

/* ---------------- boot ---------------- */
let booted = false;
export function boot() {
  if (booted) return;
  booted = true;
  set({ ledger: loadLedger() });
  const s = get();
  const watch = s.scn.zones.findIndex((z) => z.id === 'fc_west');
  engine()
    .intel(
      s.scn,
      watch >= 0 ? watch : s.base.worst.zone,
      proxy((st) => {
        if (st.kind === 'progress') set((p) => ({ progress: { ...p.progress, [st.task]: st.f } }));
        else if (st.kind === 'ensemble') {
          set({ ens: st.data });
          const e = st.data;
          log('forecast_issued', `Ran the evening ${e.n} times. ${Math.round(e.p * 100)}% end in a crush at ${get().scn.zones[e.zone].name}, most likely at ${clock(e.tMed)}.`, {
            p: e.p,
            tLo: e.tLo,
            tMed: e.tMed,
            tHi: e.tHi,
            zone: get().scn.zones[e.zone].id,
          });
        } else if (st.kind === 'ablation') set({ abl: st.data });
        else if (st.kind === 'rejected') {
          set({ rejected: st.data });
          st.data.forEach((r) => log('plan_rejected', `${r.name}: still ${r.left} dangerous minutes. ${r.why}`, { name: r.name, left: r.left, cost: r.cost }));
        } else if (st.kind === 'plan') set((p) => ({ plans: { ...p.plans, [st.name]: { chosen: st.chosen, crushMin: st.crushMin, rupees: st.rupees, evals: st.evals, ms: st.ms } } }));
        else if (st.kind === 'plansDone') {
          set({ plansDone: { evals: st.evals, ms: st.ms } });
          const p = get().plans['Zero rupees'];
          if (p) log('plan_recommended', `Recommended: ${p.chosen.map((c) => c.label).join('; ')}. ${get().base.crushMin} → ${p.crushMin} dangerous minutes, ₹${p.rupees}.`, { chosen: p.chosen.map((c) => c.label), crushMin: p.crushMin, rupees: p.rupees });
        } else if (st.kind === 'board') set({ board: st.data });
      }),
    )
    .catch((e) => {
      console.error(e);
      toast('The background engine failed to start. Reload the page.');
    });
}

/* ---------------- playback ---------------- */
export function tickForward(dtSec: number) {
  const s = get();
  if (!s.playing) return;
  const H = s.scn.horizon;
  let t = s.tick + dtSec * s.speed;
  const patch: Partial<ConsoleState> = {};
  if (s.stopAt != null && t >= s.stopAt) {
    t = s.stopAt;
    onStop(s.mode);
    return;
  }
  if (t >= H - 1) {
    t = H - 1;
    patch.playing = false;
    if (s.mode !== 'free') patch.mode = 'free';
  }
  patch.tick = t;
  set(patch);
  checkClock();
}

function onStop(mode: Mode) {
  const s = get();
  if (mode === 'story') {
    set({ tick: s.stopAt!, stopAt: null, mode: 'live', speed: s.liveSpeed, playing: true, step: 2, maxStep: Math.max(s.maxStep, 2) });
    caption('Nothing looks wrong yet. Pravaah has already run the rest of the evening, and it does not end well.');
    const e = get().ens;
    if (e) log('warning_raised', `Early warning at ${clock(get().tick)}: ${Math.round(e.p * 100)}% chance of a crush at ${get().scn.zones[e.zone].name}, most likely ${clock(e.tMed)}.`, { tick: get().tick, p: e.p });
  } else if (mode === 'replay') {
    set({ tick: s.stopAt!, stopAt: null, playing: false, mode: 'free' });
  } else set({ tick: s.stopAt!, stopAt: null, playing: false });
}

export function rehearse() {
  set({ mode: 'story', tick: 0, playing: true, speed: 11, stopAt: STORY_STOP, peek: null });
}
export function skipStory() {
  const s = get();
  if (s.mode !== 'story') return;
  set({ tick: STORY_STOP - 0.1 });
}
export function togglePlay() {
  const s = get();
  if (s.mode === 'intro') return rehearse();
  set({ playing: !s.playing });
}
export function setLiveSpeed(v: number) {
  const s = get();
  set({ liveSpeed: v, ...(s.mode === 'live' ? { speed: v } : {}) });
}
export function setPeek(t: number | null) {
  set({ peek: t == null ? null : Math.max(0, Math.min(get().scn.horizon - 1, t)) });
}
export function scrub(t: number) {
  const s = get();
  const tt = Math.max(0, Math.min(s.scn.horizon - 1, t));
  if (s.mode === 'live' || s.mode === 'story' || s.mode === 'intro') setPeek(tt);
  else set({ tick: tt, playing: false, peek: null });
}
export function goStep(n: number) {
  const s = get();
  if (n > s.maxStep) return;
  set({ step: n, drawer: null });
}
export function unlock(n: number) {
  set((s) => ({ maxStep: Math.max(s.maxStep, n) }));
}

/* ---------------- plans ---------------- */
export function selectedPlan(s: ConsoleState = get()): { name: string; chosen: Lever[] } | null {
  if (s.replan) return { name: 'Plan B', chosen: s.replan.chosen };
  if (s.selected === 'Your plan') return { name: 'Your plan', chosen: s.userPlan };
  const p = s.plans[s.selected];
  return p ? { name: s.selected, chosen: p.chosen } : null;
}

export function recommended(s: ConsoleState = get()) {
  return s.plans['Zero rupees'];
}

/** the Decision Clock: earliest still-open deadline among the recommended plan's levers */
export function decisionDeadline(s: ConsoleState = get()): { tick: number; label: string } | null {
  if (!s.board || s.approved || s.replan) return null;
  const open = s.board.filter((o) => !o.useless && s.expired.indexOf(o.label) < 0);
  if (!open.length) return null;
  const o = open.reduce((a, b) => (b.deadlineTick < a.deadlineTick ? b : a), open[0]);
  return { tick: o.deadlineTick, label: o.label };
}

function checkClock() {
  const s = get();
  if (s.mode !== 'live' || s.approved || s.replanBusy) return;
  const d = decisionDeadline(s);
  if (!d || s.tick < d.tick) return;
  const closing = (s.board || []).filter((o) => !o.useless && o.deadlineTick <= s.tick && s.expired.indexOf(o.label) < 0).map((o) => o.label);
  const expired = [...s.expired, ...closing];
  set({ expired, replanBusy: true });
  log('clock_expired', `The decision window closed at ${clock(s.tick)} for: ${closing.join('; ')}.`, { closing, tick: Math.floor(s.tick) });
  const atTick = Math.floor(s.tick);
  engine()
    .replan(s.scn, atTick, expired)
    .then((r) => {
      const orig = recommended(get());
      const lostMin = r.crushMin - (orig ? orig.crushMin : 0);
      set({ replan: { ...r, atTick, lostMin }, replanBusy: false, selected: 'Balanced' });
      caption(`Waiting cost you ${lostMin} more dangerous minute${lostMin === 1 ? '' : 's'}. This is the best plan still possible from ${clock(atTick)}.`);
      log('plan_recommended', `Plan B from ${clock(atTick)}: ${r.chosen.map((c) => c.label).join('; ')}. ${r.crushMin} dangerous minutes (waiting cost ${lostMin}).`, { ...r, atTick });
    })
    .catch(() => set({ replanBusy: false }));
}

/** approve: the plan is applied from NOW — late decisions only reach people who have not left yet */
export function approve(acceptOverride?: Record<string, number>, roomNote?: string) {
  const s = get();
  const plan = selectedPlan(s);
  if (!plan) return;
  const at = s.approved ? s.approved.tick : Math.floor(s.tick);
  const ivs = plan.chosen.map((c) => retime(c, at));
  const opts: SimOptions = { waits: s.waits, ...(acceptOverride ? { acceptOverride } : {}) };
  const result = simulate(s.scn, ivs, opts);
  const approved: Approved = { name: plan.name, tick: at, ivs, result, acceptOverride, roomNote };
  const raviCur = tracePerson(s.scn, result, personPath(s.scn, result), RAVI.release);
  const raviGhost = tracePerson(s.scn, s.base, personPath(s.scn, s.base), RAVI.release);
  const start = Math.max(200, Math.min(at, 270));
  set({
    approved,
    cur: result,
    ghost: s.base,
    curLabel: plan.name + (acceptOverride ? ' · with the room' : ''),
    raviCur,
    raviGhost,
    whatIf: null,
    peek: null,
    mode: 'replay',
    tick: start,
    playing: true,
    speed: 7,
    stopAt: 372,
    step: 5,
    maxStep: 5,
    drawer: null,
  });
  caption(`Same evening, same ${comma(s.scn.zones.find((z) => z.type === 'venue')?.capacity || 0)} people. This time you acted at ${clock(at)}.`);
  if (!s.approved)
    log('plan_approved', `Approved "${plan.name}" at ${clock(at)}: ${s.base.crushMin} → ${result.crushMin} dangerous minutes, ₹${result.rupees}.`, {
      name: plan.name,
      at,
      levers: plan.chosen.map((c) => c.label),
      crushMin: result.crushMin,
      rupees: result.rupees,
      missed: result.missed,
    });
  else if (acceptOverride) log('room_result', roomNote || 'Re-ran the plan with the room’s choices.', { acceptOverride, crushMin: result.crushMin });
}

export function replayOutcome() {
  const s = get();
  if (!s.approved) return;
  set({ tick: Math.max(200, Math.min(s.approved.tick, 270)), playing: true, speed: 7, stopAt: 372, mode: 'replay', peek: null });
}

/* ---------------- what-if ---------------- */
export function runWhatIf(id: WhatIfId | 'custom', custom?: { label: string; say: string; patch: WhatIfPatch }) {
  const s = get();
  const w = id === 'custom' ? custom! : WHATIFS.find((x) => x.id === id)!;
  const { scn, opts } = applyWhatIf(s.scn, w);
  const waits = probeWaits(scn, opts);
  const none = simulate(scn, [], { ...opts, waits });
  const ivs = s.approved ? s.approved.ivs : selectedPlan(s)?.chosen || [];
  const withPlan = ivs.length ? simulate(scn, ivs, { ...opts, waits }) : null;
  const shown = withPlan || none;
  set({
    whatIf: { id, label: w.label, say: w.say, patch: w.patch, none, withPlan },
    cur: shown,
    ghost: s.base,
    curLabel: w.label + (withPlan ? ' · plan in force' : ' · no plan'),
    raviCur: tracePerson(scn, shown, personPath(scn, shown), RAVI.release),
    raviGhost: tracePerson(s.scn, s.base, personPath(s.scn, s.base), RAVI.release),
    ...(s.mode === 'live' || s.mode === 'story' || s.mode === 'intro' ? { peek: null } : { tick: 200, playing: true, speed: 9, stopAt: null, mode: 'free' as Mode }),
  });
  caption(w.say);
}
/** a typed question, parsed into a validated spec (LLM or word matching), run through the same engine */
export function runWhatIfSpec(spec: WhatIfSpec, label: string, say: string, source: string) {
  const s = get();
  const { scn, opts } = buildNight(s.scn, {
    turnout: 1 + spec.turnoutPct / 100,
    rain: spec.rain,
    railFail: spec.railFailAt != null ? Math.max(0, spec.railFailAt - s.scn.t0Min) : null,
    gatesLate: spec.gatesLateMin,
    slowLanes: spec.slowLanes,
  });
  if (spec.showDelayMin) {
    scn.showStartTick += spec.showDelayMin;
    scn.cohorts.forEach((c) => (c.mean += Math.round(spec.showDelayMin * 0.6)));
  }
  const waits = probeWaits(scn, opts);
  const none = simulate(scn, [], { ...opts, waits });
  const ivs = s.approved ? s.approved.ivs : selectedPlan(s)?.chosen || [];
  const withPlan = ivs.length ? simulate(scn, ivs, { ...opts, waits }) : null;
  const shown = withPlan || none;
  set({
    whatIf: { id: 'custom', label, say, none, withPlan, source },
    cur: shown,
    ghost: s.base,
    curLabel: label + (withPlan ? ' · plan in force' : ' · no plan'),
    raviCur: tracePerson(scn, shown, personPath(scn, shown), RAVI.release),
    raviGhost: tracePerson(s.scn, s.base, personPath(s.scn, s.base), RAVI.release),
    ...(s.mode === 'live' || s.mode === 'story' || s.mode === 'intro' ? { peek: null } : { tick: 200, playing: true, speed: 9, stopAt: null, mode: 'free' as Mode }),
  });
  caption(say);
}
export function clearWhatIf() {
  const s = get();
  const cur = s.approved ? s.approved.result : s.base;
  set({
    whatIf: null,
    cur,
    ghost: s.approved ? s.base : null,
    curLabel: s.approved ? s.approved.name : 'If you do nothing',
    raviCur: tracePerson(s.scn, cur, personPath(s.scn, cur), RAVI.release),
    raviGhost: s.approved ? tracePerson(s.scn, s.base, personPath(s.scn, s.base), RAVI.release) : null,
  });
}

/* ---------------- red team ---------------- */
export function runRedTeamFor() {
  const s = get();
  const plan = s.approved ? { name: s.approved.name, chosen: s.approved.ivs as Lever[] } : selectedPlan(s);
  if (!plan || s.redTeamBusy) return;
  set({ redTeamBusy: true, redTeamProgress: 0, drawer: 'redteam' });
  engine()
    .redTeam(
      s.scn,
      plan.chosen,
      proxy((f) => set({ redTeamProgress: f })),
    )
    .then((r) => {
      set({ redTeam: r, redTeamFor: plan.name, redTeamBusy: false });
      log('redteam', `Tried to break "${plan.name}" on ${r.total} rough nights. Safe on ${r.survived}. Worst: ${r.worst.labels.join(', ') || 'an ordinary night'} (${r.worst.planCrush} dangerous minutes).`, {
        survived: r.survived,
        total: r.total,
        tiers: r.tiers,
        worst: r.worst.labels,
        backup: r.backup?.chosen.map((c) => c.label),
      });
    })
    .catch(() => set({ redTeamBusy: false }));
}

export { PROFILE_NAMES };
