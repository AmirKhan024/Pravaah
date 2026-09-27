'use client';
/*
 * Organiser console state. Every number shown in the console is read from SimResults held here,
 * all produced by the engine (main thread for single full runs, the Worker for searches).
 */
import {
  clockFor,
  comma,
  compareGates,
  demoActualFeed,
  dueActions,
  dyPatil,
  freezePrediction,
  loadScenarioFromRows,
  parseCsv,
  parsePlaybook,
  personPath,
  probeWaits,
  PROFILE_NAMES,
  RAVI,
  recalibrate,
  retime,
  simulate,
  tracePerson,
  trustForGate,
  applyWhatIf,
  WHATIFS,
  type AblationRow,
  type BoardOption,
  type Confidence,
  type CsvScenarioInput,
  type DataField,
  type DoByAction,
  type EnsembleResult,
  type GateBuckets,
  type GateComparison,
  type Intervention,
  type Lever,
  type PlaybookAction,
  type PredictedSnapshot,
  type ProfileName,
  type RecalibrationResult,
  type RedTeamResult,
  type RejectedRow,
  type ResourceRow,
  type Scenario,
  type SimOptions,
  type SimResult,
  type Trace,
  type WhatIfId,
  type WhatIfPatch,
} from '@/engine';
import { createStore } from './createStore';
import { EMPTY_SPEC, type WhatIfSpec } from './whatifParse';
import { engine, proxy } from './engineClient';
import { appendLedger, loadLedger, type LedgerEntry, type LedgerType } from './ledger';
import { bucketStatuses, type BucketId, type BucketInfo } from './buckets';
import { buildObservedScenario, firedTripwires, isObservedEmpty, mergeObserved, type ActionState } from './monitor';
import { buildTimelineData, defaultMatchDateISO, stepForDate, todayISO, type TimelineData } from './timeline';
import { crossesThreshold, fetchWeather, WEATHER_THRESHOLD, type WeatherReading } from './weather';
import {
  actionExpiringAlert,
  actionStoppedWorkingAlert,
  decisionRecordedAlert,
  newActionAlert,
  statusChangedAlert,
  tripwireFiredAlert,
  weatherThresholdAlert,
} from './telegramMessages';

export type Mode = 'intro' | 'story' | 'live' | 'replay' | 'free';
export type Drawer = null | 'about' | 'ledger' | 'report' | 'board' | 'chain' | 'redteam' | 'orders' | 'deck' | 'leverWhy' | 'bucket' | 'whatif' | 'liveOrders' | 'observe';

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
  replan?: { chosen: Lever[]; crushMin: number; rupees: number; missed: number; atTick: number; lostMin: number; lostRupees: number };
  replanBusy: boolean;
  approved: Approved | null;
  whatIf: { id: WhatIfId | 'custom'; label: string; say: string; patch?: WhatIfPatch; none: SimResult; withPlan: SimResult | null; source?: string } | null;
  raviCur: Trace;
  raviGhost: Trace | null;
  /** tick the followed-person map marker (Ravi for the flagship, this scenario's biggest cohort otherwise) appears */
  raviRelease: number;
  /** which cohort raviCur/raviGhost follow — the label to show when the scenario isn't the flagship */
  raviLabel: string;
  ledger: LedgerEntry[];
  /** order title -> "HH:MM" it was sent to Telegram at. One shared source of truth, so a lever
   *  sent via Live Ops's one-click Approve and the same order shown in the Guide/Orders tab (or
   *  Live Ops's own Orders-sent panel) never disagree about whether it's already been sent. */
  sentOrders: Record<string, string>;
  drawer: Drawer;
  /** which lever the 'leverWhy' drawer (Live Ops) is currently showing */
  drawerLever: string | null;
  /** which bucket the 'bucket' drawer (Live Ops) is currently showing */
  drawerBucket: BucketId | null;
  /** a free-text staff report flagging VIP movement, if one has been logged — a flag, never a
   *  simulated number (VIP has no cohort/gate of its own; see lib/buckets.ts). */
  vipNote: string | null;

  /* ---- monitor loop (Watch -> Detect -> Re-plan -> Ask), lib/monitor.ts ---- */
  /** the running, merged, clamped patch built from every staff report/chip logged so far */
  observed: WhatIfSpec;
  /** sim tick the monitor last actually applied `observed` and re-ranked — gates the periodic cadence */
  lastMonitorTick: number;
  monitorBusy: boolean;
  /** does the plan already in force still deliver what it promised, under what's been observed since? */
  approvedStatus: 'still-working' | 'stopped-working' | null;
  /** Red Team "breaks when" factor keys that have already fired a tripwire this evening — a
   *  tripwire proposes its backup once per factor, not on every monitor tick it stays true */
  tripwiresFiredKeys: string[];
  /** proposed levers the previous monitor tick recommended that the newest re-rank dropped —
   *  surfaced as 'superseded', not silently disappeared */
  supersededLabels: string[];
  /** skip vs. a missed deadline both land in `expired`; this remembers which, for actionState() */
  expiredReason: Record<string, 'skipped' | 'expired'>;

  caption: string;
  toast: string;

  /* ---- data-driven scenarios (an event head's own data, not the flagship prototype) ---- */
  /** 'flagship' = the hand-authored dyPatil prototype; 'sample' = the bundled illustrative fixture; 'custom' = the event head's own CSVs/form */
  dataSource: 'flagship' | 'sample' | 'custom';
  dataFields: DataField[];
  dataConfidence: Confidence | null;
  resources: ResourceRow[];

  /* ---- Timeline (Slice 1: "N days to match" + T-90..Match night stepper) ---- */
  /** the raw tickets/arrivals/etc. rows this scenario was built from, kept so the stepper can
   *  rebuild any other snapshot later without re-uploading anything; null for the flagship demo
   *  and for a Quick Start scenario (no tickets.csv snapshots to step through) */
  rawInput: CsvScenarioInput | null;
  /** event.csv's own match date if known, else the brief's own default (60 days out, never past) */
  matchDateISO: string;
  /** the T-90..Match night step list + each step's do-nothing dangerous-minute count, computed
   *  once per dataset load (each step is its own simulate() run) — null when rawInput has no
   *  distinct snapshots to step through */
  timeline: TimelineData | null;
  /** which step's numbers `scn`/`base`/`cur` currently reflect */
  activeSnapshot: string | null;
  /** null = the real clock decides "today"; set = a demo date the user picked, shown labelled as such */
  demoDateISO: string | null;
  /** data/playbooks.csv, loaded once in boot() */
  playbook: PlaybookAction[];
  /** playbook action id -> the organiser's decision, logged to the Black Box the moment it's made */
  timelineDecisions: Record<string, 'approved' | 'skipped'>;

  /* ---- Weather (Slice 2): real data at every horizon, lib/weather.ts ---- */
  /** null until boot()'s fetch resolves (forecast, climatology, or the offline sample) */
  weather: WeatherReading | null;

  /* ---- Predicted vs Actual (Slice 3), engine/actuals.ts ---- */
  /** frozen at the first approval — "what we promised": per-gate arrivals per bucket, peak, crush */
  predicted: PredictedSnapshot | null;
  /** per-gate scan counts per bucket, from a demo feed or a real pasted/uploaded log */
  actualBuckets: GateBuckets | null;
  actualsSource: 'none' | 'demo-feed' | 'real';
  comparison: GateComparison[] | null;
  recalibration: RecalibrationResult | null;
  /** per-gate trust badge from the deterministic <=15%-error rule (engine/actuals.ts's trustForGate) */
  gateTrust: Record<string, 'claimed' | 'verified'>;
}

/** loaded once via loadScenario(); everything a data-driven scenario carries beyond the Scenario itself */
export interface ScenarioBundle {
  scenario: Scenario;
  source: 'sample' | 'custom';
  fields?: DataField[];
  confidence?: Confidence | null;
  resources?: ResourceRow[];
  /** Slice 1 (Timeline): the raw rows this scenario came from, its match date, its precomputed
   *  step chart, and which step is currently active — all optional so every pre-Timeline caller
   *  (Quick Start, the owner registration flow) keeps working unchanged. */
  rawInput?: CsvScenarioInput;
  matchDateISO?: string;
  timeline?: TimelineData | null;
  activeSnapshot?: string | null;
}

const SCENARIO_KEY = 'pravaah:scenario:v1';
function readStoredBundle(): ScenarioBundle | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SCENARIO_KEY);
    if (!raw) return null;
    const b = JSON.parse(raw) as ScenarioBundle;
    if (!b?.scenario?.zones?.length) return null;
    return b;
  } catch {
    return null;
  }
}
function writeStoredBundle(b: ScenarioBundle | null) {
  if (typeof window === 'undefined') return;
  try {
    if (b) window.localStorage.setItem(SCENARIO_KEY, JSON.stringify(b));
    else window.localStorage.removeItem(SCENARIO_KEY);
  } catch {
    /* private-browsing/quota — the scenario just won't survive a reload */
  }
}

const STORED_BUNDLE = readStoredBundle();
const BASE_SCN = STORED_BUNDLE?.scenario ?? dyPatil;
/** the rehearsal pauses here: the map is calm, and Pravaah already knows how the evening ends */
export const STORY_STOP = 230;

/** who the console/live "follow one person" trace follows: Ravi for the flagship, otherwise this
 *  scenario's biggest cohort — never a name or cohort id from another venue's data. */
function focusCohortId(scn: Scenario): string {
  if (scn.id === 'dyPatil') return RAVI.cohort;
  return [...scn.cohorts].sort((a, b) => b.size - a.size)[0]?.id ?? '';
}
function focusRelease(scn: Scenario): number {
  if (scn.id === 'dyPatil') return RAVI.release;
  const c = scn.cohorts.find((x) => x.id === focusCohortId(scn));
  return c ? Math.max(0, Math.round(c.mean)) : 0;
}

function initial(scn: Scenario = BASE_SCN, bundle: ScenarioBundle | null = STORED_BUNDLE): ConsoleState {
  const waits = probeWaits(scn);
  const base = simulate(scn, [], { waits });
  return {
    scn,
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
    raviCur: tracePerson(scn, base, personPath(scn, base, focusCohortId(scn)), focusRelease(scn)),
    raviGhost: null,
    raviRelease: focusRelease(scn),
    raviLabel: scn.cohorts.find((c) => c.id === focusCohortId(scn))?.label ?? '',
    ledger: [],
    sentOrders: {},
    drawer: null,
    drawerLever: null,
    drawerBucket: null,
    vipNote: null,
    observed: EMPTY_SPEC,
    lastMonitorTick: 0,
    monitorBusy: false,
    approvedStatus: null,
    tripwiresFiredKeys: [],
    supersededLabels: [],
    expiredReason: {},
    caption: '',
    toast: '',

    dataSource: scn.id === 'dyPatil' ? 'flagship' : bundle?.source ?? 'custom',
    dataFields: bundle?.fields ?? [],
    dataConfidence: bundle?.confidence ?? null,
    resources: bundle?.resources ?? [],

    rawInput: bundle?.rawInput ?? null,
    matchDateISO: bundle?.matchDateISO ?? defaultMatchDateISO(todayISO()),
    timeline: bundle?.timeline ?? null,
    activeSnapshot: bundle?.timeline ? bundle.activeSnapshot ?? 'Match night' : null,
    demoDateISO: null,
    playbook: [],
    timelineDecisions: {},
    weather: null,

    predicted: null,
    actualBuckets: null,
    actualsSource: 'none',
    comparison: null,
    recalibration: null,
    gateTrust: {},
  };
}

export const store = createStore<ConsoleState>(initial());
const get = store.getState;
const set = store.setState;

export const clock = (t: number) => clockFor(get().scn, t);

/** Hands a loaded scenario (from /setup — CSVs, the bundled sample, or the quick-start form) to the
 *  whole app: /live and /console both read the same store, so this is the one seam that makes
 *  "an event head's own data" replace the flagship prototype everywhere at once. Persists to
 *  localStorage (never sent to a server) so the choice survives a reload. */
export function loadScenario(bundle: ScenarioBundle) {
  const matchDateISO = bundle.matchDateISO ?? defaultMatchDateISO(todayISO());
  const timeline = bundle.timeline !== undefined ? bundle.timeline : bundle.rawInput ? buildTimelineData(bundle.rawInput, matchDateISO, bundle.scenario.venueLabel) : null;
  const full: ScenarioBundle = { ...bundle, matchDateISO, timeline };
  writeStoredBundle(full);
  booted = false;
  set(initial(full.scenario, full));
  boot();
}

/** back to the hand-authored DY Patil demo */
export function resetToFlagship() {
  writeStoredBundle(null);
  booted = false;
  set(initial(dyPatil, null));
  boot();
}

/* ---------------- Timeline (Slice 1) ---------------- */

/** Jumps to a T-90..Match night step: rebuilds cohort sizes at that snapshot (engine/dataLoader.ts's
 *  own opts.snapshot), re-runs the evening, and re-runs the whole board/optimiser/red-team pipeline
 *  against the new sizes (via boot()) — a different snapshot really is a differently-sized evening,
 *  not a cosmetic label change. `displayDateISO` lets a free-typed demo date keep its own exact
 *  value on screen even though the underlying data snaps to the nearest snapshot we actually have. */
export function setTimelineStep(label: string, displayDateISO?: string) {
  const s = get();
  if (!s.rawInput || !s.timeline) return;
  const step = s.timeline.steps.find((x) => x.label === label);
  if (!step) return;
  const res = loadScenarioFromRows(s.rawInput, { snapshot: label === 'Match night' ? undefined : label, venueLabel: s.timeline.venueLabel });
  if (!res.ok) return;
  const bundle: ScenarioBundle = {
    scenario: res.data.scenario,
    source: (s.dataSource === 'flagship' ? 'sample' : s.dataSource) as 'sample' | 'custom',
    fields: res.data.fields,
    confidence: res.data.confidence,
    resources: res.data.resources,
    rawInput: s.rawInput,
    matchDateISO: s.matchDateISO,
    timeline: s.timeline,
    activeSnapshot: label,
  };
  writeStoredBundle(bundle);
  booted = false;
  const shown = displayDateISO ?? step.dateISO;
  set({ ...initial(res.data.scenario, bundle), demoDateISO: shown === todayISO() ? null : shown });
  boot();
  rehearse();
  requestAnimationFrame(() => skipStory());
}

/** The free-form "demo date" control: snaps to whichever step's data is the most recent one at or
 *  before the chosen date (real ticket snapshots are discrete; the displayed date can still be
 *  exact), and re-runs the evening only if that actually changes which step is loaded. */
export function setDemoDate(iso: string) {
  const s = get();
  if (!s.timeline) {
    set({ demoDateISO: iso === todayISO() ? null : iso });
    return;
  }
  const step = stepForDate(s.timeline, iso);
  if (step.label === s.activeSnapshot) set({ demoDateISO: iso === todayISO() ? null : iso });
  else setTimelineStep(step.label, iso);
}

/** Back to the real clock — re-picks whichever step the real date actually falls into. */
export function resetDemoDate() {
  const s = get();
  if (s.timeline) {
    const step = stepForDate(s.timeline, todayISO());
    if (step.label !== s.activeSnapshot) {
      setTimelineStep(step.label);
      return;
    }
  }
  set({ demoDateISO: null });
}

/** The next 1-3 playbook actions due, nearest-first, each with a real simulated benefit when the
 *  row has a leverType — read by the Timeline row's "Do by" list. Already-decided actions (Approve/
 *  Not now) drop off the list; they stay in the Black Box, not on screen twice. */
export function timelineDueActions(s: ConsoleState = get()): DoByAction[] {
  if (!s.playbook.length) return [];
  const today = s.demoDateISO ?? todayISO();
  const weatherTriggered = !!s.weather && crossesThreshold(s.weather);
  return dueActions(s.playbook, s.matchDateISO, today, s.scn, s.base, s.scn.gatesOpenTick, {}, weatherTriggered)
    .filter((a) => !s.timelineDecisions[a.id])
    .slice(0, 3);
}

export function approveTimelineAction(a: DoByAction) {
  set((s) => ({ timelineDecisions: { ...s.timelineDecisions, [a.id]: 'approved' } }));
  log(
    'decision_recorded',
    `Approved "${a.action}" (do by ${a.doByISO}, ${a.owner}).${a.benefitMin != null ? ` Removes ~${a.benefitMin} dangerous minute${a.benefitMin === 1 ? '' : 's'} once done.` : ''}`,
    { id: a.id, action: a.action, owner: a.owner, doByISO: a.doByISO, benefitMin: a.benefitMin, decision: 'approved' },
  );
}
export function skipTimelineAction(a: DoByAction) {
  set((s) => ({ timelineDecisions: { ...s.timelineDecisions, [a.id]: 'skipped' } }));
  log('decision_recorded', `Not now: "${a.action}" (was due ${a.doByISO}, ${a.owner}).`, { id: a.id, action: a.action, owner: a.owner, doByISO: a.doByISO, decision: 'skipped' });
}
/* ---------------- Predicted vs Actual (Slice 3) ---------------- */

/** Freezes "what we promised" into the Black Box the moment a plan is first approved — per gate,
 *  expected arrivals per 10-min bucket, peak bucket, peak density, dangerous minutes
 *  (engine/actuals.ts's freezePrediction, straight off the just-approved SimResult). */
function freezePredictionNow(scn: Scenario, result: SimResult, at: number) {
  const predicted = freezePrediction(scn, result, at);
  set({ predicted, actualBuckets: null, actualsSource: 'none', comparison: null, recalibration: null, gateTrust: {} });
  log('prediction_frozen', `Froze the prediction at ${clock(at)}: ${predicted.crushMin} dangerous minutes promised across ${Object.keys(predicted.perGate).length} gates.`, {
    at,
    crushMin: predicted.crushMin,
    peakBucket: predicted.peakBucket,
  });
}

function applyActuals(buckets: GateBuckets, source: 'demo-feed' | 'real', note: string) {
  const s = get();
  if (!s.predicted) return;
  const comparison = compareGates(s.predicted, buckets);
  const gateTrust: Record<string, 'claimed' | 'verified'> = {};
  comparison.forEach((c) => (gateTrust[c.gateId] = trustForGate(c.pctDiff)));
  set({ actualBuckets: buckets, actualsSource: source, comparison, gateTrust, recalibration: null });
  log('actuals_received', note, { source, totals: comparison.map((c) => ({ gate: c.gateId, predicted: c.predictedTotal, actual: c.actualTotal, pctDiff: c.pctDiff })) });
}

/** Brief: "a Demo feed generator that produces a plausible scan stream ... with a few injected
 *  disruptions ... always tagged 'demo feed.'" Freezes a prediction first if none exists yet (e.g.
 *  no plan has been approved), so the demo can be shown without requiring that step first. */
export function generateDemoActualFeed() {
  const s = get();
  if (!s.predicted) freezePredictionNow(s.scn, s.cur, Math.floor(s.tick));
  const predicted = get().predicted!;
  const buckets = demoActualFeed(predicted, 42);
  applyActuals(buckets, 'demo-feed', 'Loaded a demo scan feed (seeded, with a late-train and a slow-lane disruption injected) — tagged "demo feed," never presented as real.');
}

/** Brief: "(a) a paste/upload box that reuses the registrations column-mapper (Groq maps columns;
 *  code counts)." Called with already-mapped, already-validated buckets (lib/scans/apply.ts is the
 *  only place a raw count is ever read) — this function just applies and logs them. */
export function submitActualScans(buckets: GateBuckets, rowCount: number, rejected: number) {
  applyActuals(buckets, 'real', `Loaded ${rowCount} real gate-scan row${rowCount === 1 ? '' : 's'}${rejected ? ` (${rejected} rejected — unresolved gate, time, or count)` : ''}.`);
}

/** Brief: "a deterministic recalibration ..., then re-run the REST of the evening from now (reuse
 *  the monitor loop)." Re-simulates the whole scenario under the fitted per-gate multiplier/shift —
 *  the same shape the monitor loop already uses (buildObservedScenario re-simulates the whole
 *  evening under a patch, never a literal in-place resume) — and swaps it in as the new baseline,
 *  same lightweight update `runMonitorTick` itself uses (scn/base/cur, tick and mode untouched). */
export function recalibrateNow() {
  const s = get();
  if (!s.predicted || !s.actualBuckets) return;
  const r = recalibrate(s.scn, s.predicted, s.actualBuckets, s.approved?.ivs ?? [], { waits: s.waits });
  set({ recalibration: r, scn: r.recalibratedScn, base: r.recalibratedResult, cur: r.recalibratedResult });
  log('recalibrated', `Recalibrated from the actuals: forecast error ${r.errorBefore}% → ${r.errorAfter}%.`, { errorBefore: r.errorBefore, errorAfter: r.errorAfter, fits: r.fits });
}

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

/** data/playbooks.csv, fetched once — same-origin, server reads a local file, so this works under
 *  DEMO_OFFLINE too (unlike Groq/Supabase/Telegram, nothing here leaves the machine running Pravaah). */
async function loadPlaybook(): Promise<PlaybookAction[]> {
  try {
    const r = await fetch('/api/playbooks');
    const j = (await r.json()) as { playbooks: string };
    return parsePlaybook(parseCsv(j.playbooks) as never);
  } catch {
    return [];
  }
}

/** Slice 2 (Weather): fetches once per scenario load (real forecast/climatology, or the offline
 *  sample) for `scn`'s own venue zone lat/lng and match date, then — if it crosses
 *  WEATHER_THRESHOLD — applies the existing rain patch via reportObserved() (never a second rain
 *  model; see engine/whatif.ts's applyRain, already wired through lib/monitor.ts) and sends the
 *  ops Telegram alert. A network hiccup can never block this: fetchWeather() itself always
 *  resolves (falls back to the sample reading) rather than throwing. */
async function fetchWeatherForScenario() {
  const s = get();
  const venue = s.scn.zones.find((z) => z.type === 'venue');
  if (!venue) return;
  const wrap = (m: number) => ((m % 1440) + 1440) % 1440;
  const gatesOpenMin = wrap(s.scn.t0Min + s.scn.gatesOpenTick);
  const showStartMin = wrap(s.scn.t0Min + s.scn.showStartTick);
  const reading = await fetchWeather(venue.lat, venue.lng, s.matchDateISO, gatesOpenMin, showStartMin);
  set({ weather: reading });
  if (!crossesThreshold(reading)) return;
  reportObserved(
    { rain: true },
    `${reading.label} Crosses the rain threshold (${WEATHER_THRESHOLD.probabilityPct}%/${WEATHER_THRESHOLD.amountMm}mm) — applying the rain patch (fewer effective lanes, slower cabs, later arrivals) to the rest of the evening.`,
  );
  const a = weatherThresholdAlert(reading.label, reading.source);
  sendTelegramAlert(a.kindLabel, a.title, a.text, 'tripwire_fired', { reword: true, summary: 'Sent the weather tripwire alert to the ops Telegram channel.' });
}

/* ---------------- boot ---------------- */
let booted = false;
export function boot() {
  if (booted) return;
  booted = true;
  loadLedger().then((ledger) => set({ ledger }));
  loadPlaybook().then((playbook) => set({ playbook }));
  fetchWeatherForScenario();
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
  checkStatusAlert();
  maybeRunMonitor();
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

/**
 * Marks the given lever labels expired and re-plans from `atTick` without them — the one place
 * this happens, shared by the automatic tick-driven check below and `skipLever()` (Live Ops), so
 * a manual skip produces exactly the same re-plan as a window closing on its own. `reason`
 * distinguishes the two afterwards, for actionState()'s 'skipped' vs. 'expired'.
 */
function expireLevers(labels: string[], atTick: number, reason: 'skipped' | 'expired' = 'expired') {
  if (!labels.length) return;
  const s = get();
  const expired = [...s.expired, ...labels.filter((l) => s.expired.indexOf(l) < 0)];
  if (expired.length === s.expired.length) return; // nothing new
  const expiredReason = { ...s.expiredReason };
  labels.forEach((l) => (expiredReason[l] = reason));
  set({ expired, expiredReason, replanBusy: true });
  log('clock_expired', `The decision window closed at ${clock(atTick)} for: ${labels.join('; ')}.`, { closing: labels, tick: atTick });
  engine()
    .replan(s.scn, atTick, expired)
    .then((r) => {
      const orig = recommended(get());
      const lostMin = r.crushMin - (orig ? orig.crushMin : 0);
      const lostRupees = Math.max(0, r.rupees - (orig ? orig.rupees : 0));
      set({ replan: { ...r, atTick, lostMin, lostRupees }, replanBusy: false, selected: 'Balanced' });
      caption(waitingCost(lostMin, lostRupees) + ` This is the best plan still possible from ${clock(atTick)}.`);
      log('plan_recommended', `Plan B from ${clock(atTick)}: ${r.chosen.map((c) => c.label).join('; ')}. ${r.crushMin} dangerous minutes (waiting cost ${lostMin}).`, { ...r, atTick });
    })
    .catch(() => set({ replanBusy: false }));
}

export type OpsStatus = 'calm' | 'watch' | 'act';
/**
 * Live Ops's one-word status band. Derived entirely from state that already exists — the same
 * `decisionDeadline()` the Decision Clock counts down, and the same `urgent` threshold (≤15 min)
 * DecisionClock.tsx uses for its own pulsing state — so the word and the full console's clock can
 * never disagree about how much trouble the evening is in.
 */
export function opsStatus(s: ConsoleState = get()): OpsStatus {
  if (s.approved) return s.approvedStatus === 'stopped-working' && s.replan ? 'act' : 'calm';
  if (s.replan || s.replanBusy) return 'act';
  const d = decisionDeadline(s);
  if (!d) return 'calm';
  return d.tick - s.tick <= 15 ? 'act' : 'watch';
}

/** the levers actually worth showing right now: what's in force, else Plan B, else the
 *  recommendation. Once a plan is approved this normally stays fixed on it — but if the monitor
 *  loop has found that approved plan stopped working (approvedStatus, set by runMonitorTick()) and
 *  produced a fresh replan under what's actually been observed since, that fresh replan is a new
 *  thing to ask about, so it takes over (never silently replacing what's already in force without
 *  saying so — see approvedStatus and the "stopped working" badge on the action card). */
export function opsLevers(s: ConsoleState = get()): Lever[] {
  if (s.approved && !(s.approvedStatus === 'stopped-working' && s.replan)) return s.approved.ivs as Lever[];
  if (s.approved && s.replan) return s.replan.chosen;
  return selectedPlan(s)?.chosen || [];
}

/** One action's current lifecycle state (brief: proposed / accepted / skipped / expired /
 *  superseded / still-working / stopped-working — show only the current one). still-working /
 *  stopped-working describe the plan already in force as a whole (approvedStatus), not a single
 *  lever, so they're read separately by the UI; this covers the rest. */
export function actionState(label: string, s: ConsoleState = get()): ActionState {
  if (s.approved && s.approved.ivs.some((iv) => (iv as Lever).label === label)) return 'accepted';
  if (s.expiredReason[label] === 'skipped') return 'skipped';
  if (s.expired.indexOf(label) >= 0) return 'expired';
  if (s.supersededLabels.indexOf(label) >= 0) return 'superseded';
  return 'proposed';
}

const EXPIRING_SOON_MIN = 15;
function checkClock() {
  const s = get();
  if (s.mode !== 'live' || s.approved || s.replanBusy) return;
  const d = decisionDeadline(s);
  if (!d) return;
  if (s.tick < d.tick) {
    // not yet closed, but close enough to warn ops once (dedup is the alert's own title, same
    // mechanism as every other Telegram send here — see sendTelegramAlert)
    if (d.tick - s.tick <= EXPIRING_SOON_MIN) {
      const lever = opsLevers(s).find((l) => l.label === d.label);
      if (lever) {
        const a = actionExpiringAlert(s.scn, lever, d.tick, Math.max(0, Math.round(d.tick - s.tick)));
        sendTelegramAlert(a.kindLabel, a.title, a.text, 'action_expiring', { reword: true, summary: `Warned ops that "${d.label}" is about to close.` });
      }
    }
    return;
  }
  const closing = (s.board || []).filter((o) => !o.useless && o.deadlineTick <= s.tick && s.expired.indexOf(o.label) < 0).map((o) => o.label);
  expireLevers(closing, Math.floor(s.tick), 'expired');
}

/** "status changed" alert — fires the first time the evening reaches Act now (the meaningful
 *  transition ops actually need to know about), deduped for the whole evening by its own title
 *  like every other alert here. A calm/watch flap in between is not itself alert-worthy. */
function checkStatusAlert() {
  const s = get();
  if (s.mode !== 'live' || opsStatus(s) !== 'act') return;
  const a = statusChangedAlert('act', 'A move needs a decision now.');
  sendTelegramAlert(a.kindLabel, a.title, a.text, 'status_changed', { reword: true, summary: 'Told ops the status is now Act now.' });
}

const MONITOR_INTERVAL_MIN = 15;
/** the periodic side of the loop: called every simulated frame, only actually does anything once
 *  every MONITOR_INTERVAL_MIN sim-minutes (or immediately, forced, right after a new report —
 *  see reportObserved()) and only while there's something observed to react to. */
function maybeRunMonitor() {
  const s = get();
  if (s.mode !== 'live' || s.monitorBusy || isObservedEmpty(s.observed)) return;
  if (s.tick - s.lastMonitorTick < MONITOR_INTERVAL_MIN) return;
  runMonitorTick();
}

/**
 * Watch -> Detect -> Re-plan -> Ask, one pass. Builds the scenario patch from everything observed
 * so far (lib/monitor.ts's buildObservedScenario — the same buildNight() a manual what-if uses,
 * with every capacity change clamped to start no earlier than `now`), then: (1) checks Red Team's
 * pre-armed tripwires against it — a firing tripwire installs Red Team's own backup as Plan B
 * directly, no fresh optimiser run needed, and is never auto-approved; (2) otherwise asks the
 * worker to re-rank the recommendation under the new conditions, same replan() the decision clock
 * already uses; (3) if a plan is already in force, re-simulates it (unchanged, at its own approved
 * tick) under the new conditions to see whether it still delivers what it promised.
 */
export function runMonitorTick() {
  const s = get();
  if (s.monitorBusy) return;
  const tick = Math.floor(s.tick);
  const { scn, opts } = buildObservedScenario(s.scn, s.observed, tick);
  const waits = probeWaits(scn, opts);

  // Watch: whatever's on screen (map, six dots, readouts) reflects what's actually been observed
  // from now on — whichever plan is in force (or proposed, if none is), re-run under it.
  const activeIvs = s.approved ? s.approved.ivs : opsLevers(s);
  const shown = simulate(scn, activeIvs, { ...opts, waits });
  set({
    cur: shown,
    ghost: s.base,
    curLabel: (s.approved ? s.approved.name : selectedPlan(s)?.name || 'If you do nothing') + (isObservedEmpty(s.observed) ? '' : ' · observed conditions'),
    raviCur: tracePerson(scn, shown, personPath(scn, shown), RAVI.release),
    raviGhost: tracePerson(s.scn, s.base, personPath(s.scn, s.base), RAVI.release),
  });

  // (1) tripwires — only factors that haven't already fired once this evening
  const fired = firedTripwires(s.redTeam, s.observed).filter((t) => s.tripwiresFiredKeys.indexOf(t.key) < 0);
  if (fired.length && s.redTeam?.backup) {
    const b = s.redTeam.backup;
    const orig = recommended(get());
    const lostMin = b.crush - (orig ? orig.crushMin : 0);
    const lostRupees = Math.max(0, b.rupees - (orig ? orig.rupees : 0));
    const before = opsLevers(get()).map((l) => l.label);
    const after = b.chosen.map((l) => l.label);
    set({
      replan: { chosen: b.chosen, crushMin: b.crush, rupees: b.rupees, missed: b.missed, atTick: tick, lostMin, lostRupees },
      supersededLabels: before.filter((l) => after.indexOf(l) < 0),
      tripwiresFiredKeys: [...s.tripwiresFiredKeys, ...fired.map((t) => t.key)],
      lastMonitorTick: tick,
      selected: 'Balanced',
    });
    fired.forEach((t) => {
      log('tripwire_fired', `Tripwire: ${t.label} — Red Team already found this breaks the plan ${Math.round(t.failRate * 100)}% of the time. Proposing the backup it found for the worst night.`, {
        key: t.key,
        failRate: t.failRate,
        backup: after,
      });
      const a = tripwireFiredAlert(t.label, Math.round(t.failRate * 100), after);
      sendTelegramAlert(a.kindLabel, a.title, a.text, 'tripwire_fired', { reword: true, summary: `Sent the "${t.label}" tripwire alert to the ops Telegram channel.` });
    });
    const what = fired.length === 1 ? fired[0].label : fired.map((t) => t.label).join(', ');
    caption(`Observed: ${what}. Pravaah is proposing the backup Red Team already found for a night like this. It has not been approved.`);
  }

  // (2) re-rank the recommendation under the observed conditions (skip if a tripwire just replaced it)
  if (!fired.length) {
    set({ monitorBusy: true });
    engine()
      .replan(scn, tick, s.expired, opts)
      .then((r) => {
        const before = opsLevers(get()).map((l) => l.label);
        const after = r.chosen.map((l) => l.label);
        set({
          replan: { chosen: r.chosen, crushMin: r.crushMin, rupees: r.rupees, missed: r.missed, atTick: tick, lostMin: 0, lostRupees: 0 },
          supersededLabels: before.filter((l) => after.indexOf(l) < 0),
          lastMonitorTick: tick,
          monitorBusy: false,
          selected: 'Balanced',
        });
        log('plan_recommended', `Re-ranked from ${clock(tick)} under what's been observed: ${after.join('; ') || 'nothing more to do'}.`, { chosen: after, crushMin: r.crushMin, observed: s.observed });
        // "new action" — only when the lead move genuinely changed, not on every re-rank that
        // reconfirms the same one (that would spam ops with a message on every 15-minute tick)
        if (after[0] && after[0] !== before[0]) {
          const lever = r.chosen[0];
          const board = get().board?.find((o) => o.label === lever.label);
          const a = newActionAlert(scn, lever, board && !board.useless ? board.deadlineTick : null, `Re-ranked from ${clock(tick)} under what's been observed.`);
          sendTelegramAlert(a.kindLabel, a.title, a.text, 'plan_recommended', { reword: true });
        }
      })
      .catch(() => set({ monitorBusy: false, lastMonitorTick: tick }));
  }

  // (3) does the plan already in force still hold up? `shown` above already IS that recheck,
  // since activeIvs === s.approved.ivs whenever a plan is in force.
  if (s.approved) {
    const worse = shown.crushMin - s.approved.result.crushMin;
    const status: ConsoleState['approvedStatus'] = worse > 3 ? 'stopped-working' : 'still-working';
    if (status !== s.approvedStatus) {
      set({ approvedStatus: status });
      if (status === 'stopped-working') {
        log('action_stopped_working', `"${s.approved.name}" stopped working: ${s.approved.result.crushMin} → ${shown.crushMin} dangerous minutes under what's now been observed.`, { was: s.approved.result.crushMin, now: shown.crushMin });
        const a = actionStoppedWorkingAlert(s.approved.name, s.approved.result.crushMin, shown.crushMin);
        sendTelegramAlert(a.kindLabel, a.title, a.text, 'action_stopped_working', { reword: true });
      }
    }
  }
}

/** Log an observed report (a chip or a parsed staff-report sentence) and react to it immediately —
 *  the periodic MONITOR_INTERVAL_MIN cadence above is the safety net for "nothing new was reported
 *  but the clock moved on"; a fresh report should not have to wait for it. */
export function reportObserved(patch: Partial<WhatIfSpec>, note: string) {
  const s = get();
  const merged = mergeObserved(s.observed, patch);
  set({ observed: merged });
  log('staff_report', note, { patch, mergedInto: merged });
  runMonitorTick();
}
export function clearObserved() {
  set({ observed: EMPTY_SPEC });
  log('staff_report', 'Observed conditions cleared by staff — back to the plain evening.', {});
}

/**
 * Live Ops "Skip": deliberately closes one lever's window right now, before its own deadline,
 * instead of waiting for the clock to do it. Reuses the exact same expire-and-replan path a
 * missed deadline uses — a skip and a missed window produce the same, honest, re-simulated result.
 */
/** was this exact order already sent to Telegram, and when? (title is the order's own title, already unique per plan) */
export function orderSentAt(title: string): string | undefined {
  return get().sentOrders[title];
}
export function markOrderSent(title: string, at: string) {
  set((s) => ({ sentOrders: { ...s.sentOrders, [title]: at } }));
}
function unmarkOrderSent(title: string) {
  set((s) => {
    const next = { ...s.sentOrders };
    delete next[title];
    return { sentOrders: next };
  });
}

export interface TelegramSendOutcome {
  ok: boolean;
  at?: string;
  reason?: string;
  deduped?: boolean;
}

/**
 * The one place any message — an order or a monitor-loop alert — actually reaches Telegram
 * (`/api/telegram/send`, the same route Phase 3's orders always used). De-duplicated by title in
 * the same shared `sentOrders` record orders already use (see docs/DECISIONS.md, "sent state
 * moved into the shared store" — the exact bug that fix prevents would reappear here if alerts
 * kept their own separate "sent" tracking). `reword`, when set, passes the fixed text through the
 * existing number-safe placeholder scheme (app/api/llm/polish) for tone only; on any failure,
 * timeout or offline it silently keeps the fixed template — never blocks the send on it.
 *
 * The title is reserved in `sentOrders` SYNCHRONOUSLY, before any `await` — not just after a
 * successful send. Some callers (checkStatusAlert(), maybeRunMonitor()) run on every simulated
 * frame; without an immediate, synchronous reservation, several calls for the same title in the
 * same tick would all pass the "already sent?" check before the first call's fetch resolves, and
 * all really send — caught live during this pass: a naive after-the-fact mark sent "Status: Act
 * now" to the real ops chat 28 times in one short test. The reservation is released again if the
 * send actually fails, so a real failure can still be retried later.
 */
export async function sendTelegramAlert(
  kind: string,
  title: string,
  text: string,
  ledgerType: LedgerType,
  opts?: { summary?: string; reword?: boolean; lang?: 'mr' | 'hi' | 'en' },
): Promise<TelegramSendOutcome> {
  if (orderSentAt(title)) return { ok: true, at: orderSentAt(title), deduped: true };
  markOrderSent(title, '…'); // reserved — see above
  let finalText = text;
  if (opts?.reword) {
    try {
      const r = await fetch('/api/llm/polish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, lang: opts.lang || 'en' }) }).then((x) => x.json());
      if (r.ok && typeof r.text === 'string') finalText = r.text;
    } catch {
      /* keep the fixed template */
    }
  }
  try {
    const r = await fetch('/api/telegram/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, title, text: finalText }) }).then((x) => x.json());
    if (r.ok) {
      const d = new Date(r.sentAt);
      const at = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      markOrderSent(title, at);
      log(ledgerType, opts?.summary || `Sent "${title}" to the ops Telegram channel.`, { kind, chars: finalText.length });
      return { ok: true, at };
    }
    unmarkOrderSent(title);
    return { ok: false, reason: r.reason || 'Telegram send failed' };
  } catch {
    unmarkOrderSent(title);
    return { ok: false, reason: 'Could not reach the server' };
  }
}

/** Live Ops "Why?": opens the same per-lever detail the Timing tab's drawer shows, for one lever. */
export function openLeverWhy(label: string) {
  set({ drawer: 'leverWhy', drawerLever: label });
}

/** Live Ops's six status dots (lib/buckets.ts) — every number in them is read off `cur`/`base`,
 *  nothing here recomputes a simulation. Memoised by reference identity of its own inputs (same
 *  pattern as planCache.ts): bucketStatuses() builds a fresh array/objects on every call, and
 *  useSlice()'s cache only recognises "unchanged" by comparing references, so without this a
 *  render where nothing actually changed would still hand back new objects and loop forever. */
let bucketsCache: { cur: SimResult; base: SimResult; whatIf: ConsoleState['whatIf']; observed: WhatIfSpec; vipNote: string | null; t: number; out: BucketInfo[] } | null = null;
export function liveBuckets(s: ConsoleState = get()): BucketInfo[] {
  const t = viewTick(s);
  const c = bucketsCache;
  if (c && c.cur === s.cur && c.base === s.base && c.whatIf === s.whatIf && c.observed === s.observed && c.vipNote === s.vipNote && c.t === t) return c.out;
  const out = bucketStatuses({ scn: s.scn, cur: s.cur, base: s.base, whatIf: s.whatIf, observed: s.observed, vipNote: s.vipNote }, t);
  bucketsCache = { cur: s.cur, base: s.base, whatIf: s.whatIf, observed: s.observed, vipNote: s.vipNote, t, out };
  return out;
}
export function openBucket(id: BucketId) {
  set({ drawer: 'bucket', drawerBucket: id });
}
/** A staff report flagging VIP movement — a plain flag shown on the VIP dot, never a number the
 *  engine didn't produce. Pass null to clear it. */
export function setVipNote(note: string | null) {
  set({ vipNote: note });
  if (note) log('staff_report', `Staff report — VIP: ${note}`, { bucket: 'vip', note });
}

export function skipLever(label: string) {
  const s = get();
  if (s.approved || s.replanBusy || s.expired.indexOf(label) >= 0) return;
  expireLevers([label], Math.floor(s.tick), 'skipped');
  const a = decisionRecordedAlert(label, 'skipped', Math.floor(s.tick), s.scn);
  sendTelegramAlert(a.kindLabel, a.title, a.text, 'decision_recorded', { reword: true });
}

/** approve: the plan is applied from NOW — late decisions only reach people who have not left yet */
/** what waiting cost, in plain words: dangerous minutes first, money second */
export function waitingCost(lostMin: number, lostRupees: number) {
  if (lostMin > 0) return `Waiting cost you ${lostMin} more dangerous minute${lostMin === 1 ? '' : 's'}${lostRupees ? ` and ₹${Math.round(lostRupees).toLocaleString('en-IN')}` : ''}.`;
  if (lostRupees > 0) return `Waiting turned a free fix into one that costs ₹${Math.round(lostRupees).toLocaleString('en-IN')}.`;
  return 'Waiting has not cost anything yet.';
}

export function approve(acceptOverride?: Record<string, number>, roomNote?: string) {
  const s = get();
  const plan = selectedPlan(s);
  if (!plan) return;
  const at = s.approved ? s.approved.tick : Math.floor(s.tick);
  const ivs = plan.chosen.map((c) => retime(c, at, s.scn));
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
  if (!s.approved) freezePredictionNow(s.scn, result, at);
  if (!s.approved) {
    log('plan_approved', `Approved "${plan.name}" at ${clock(at)}: ${s.base.crushMin} → ${result.crushMin} dangerous minutes, ₹${result.rupees}.`, {
      name: plan.name,
      at,
      levers: plan.chosen.map((c) => c.label),
      crushMin: result.crushMin,
      rupees: result.rupees,
      missed: result.missed,
    });
    // one decision per action (SOURCE_OF_TRUTH: "approval is per ACTION, not per plan"), even
    // though a first approval still applies the whole recommended set at once
    plan.chosen.forEach((c) => {
      const a = decisionRecordedAlert(c.label, 'approved', at, s.scn);
      sendTelegramAlert(a.kindLabel, a.title, a.text, 'decision_recorded', { reword: true });
    });
  } else if (acceptOverride) log('room_result', roomNote || 'Re-ran the plan with the room’s choices.', { acceptOverride, crushMin: result.crushMin });
}

export function replayOutcome() {
  const s = get();
  if (!s.approved) return;
  set({ tick: Math.max(200, Math.min(s.approved.tick, 270)), playing: true, speed: 7, stopAt: 372, mode: 'replay', peek: null });
}

/**
 * Approve the monitor loop's fresh replan once what's already in force has stopped working
 * (approvedStatus, set by runMonitorTick()). Deliberately NOT the same code path as approve():
 * that one jumps into a canned replay of the outcome (right for a first, pre-event approval);
 * this one is a live, mid-event decision — it stays in 'live' mode, at the real clock, and simply
 * replaces what's in force with the new plan, at NOW, under whatever's actually been observed.
 */
export function approveReplacement() {
  const s = get();
  if (!s.approved || !s.replan) return;
  const at = Math.floor(s.tick);
  const { scn, opts } = buildObservedScenario(s.scn, s.observed, at);
  const waits = probeWaits(scn, opts);
  const ivs = s.replan.chosen.map((c) => retime(c, at, scn));
  const result = simulate(scn, ivs, { ...opts, waits });
  const approved: Approved = { name: 'Plan B', tick: at, ivs, result };
  set({ approved, approvedStatus: 'still-working', replan: undefined, supersededLabels: [], cur: result, ghost: s.base, curLabel: 'Plan B (updated)' });
  caption(`Updated the plan at ${clock(at)}: ${s.approved.result.crushMin} → ${result.crushMin} dangerous minutes.`);
  log('plan_approved', `Approved the updated plan at ${clock(at)} — the earlier one had stopped working: ${result.crushMin} dangerous minutes, ₹${result.rupees}.`, {
    name: 'Plan B',
    at,
    levers: ivs.map((c) => c.label),
    crushMin: result.crushMin,
    rupees: result.rupees,
  });
  ivs.forEach((c) => {
    const a = decisionRecordedAlert(c.label, 'approved', at, scn);
    sendTelegramAlert(a.kindLabel, a.title, a.text, 'decision_recorded', { reword: true });
  });
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
  const { scn, opts } = buildObservedScenario(s.scn, spec, 0);
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
