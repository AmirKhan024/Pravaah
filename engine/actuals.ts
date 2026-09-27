/*
 * Slice 3 (Predicted vs Actual) — the learning loop. Pure TS, no fs/DOM: freezes a prediction from
 * a real SimResult, compares it against real (or demo-feed) gate scan counts, fits a deterministic
 * recalibration, and applies a plain trust rule. Nothing here is an LLM output — Groq (if used at
 * all, for a pasted scan list) only maps column names; every number below is arithmetic over
 * SimResult/scan-count data the caller already validated.
 */
import { clone, mulberry32 } from './ensemble';
import { simulate } from './simulate';
import type { Cohort, Intervention, Scenario, SimOptions, SimResult } from './types';

/** Predicted or actual arrivals per gate, bucketed into fixed-width windows over the whole
 *  simulated evening — the shape both "sides" of the comparison share. */
export type GateBuckets = Record<string, number[]>;

export interface PredictedSnapshot {
  frozenAtTick: number;
  bucketMin: number;
  perGate: GateBuckets;
  peakBucket: Record<string, number>;
  peakDen: Record<string, number>;
  crushMin: number;
}

function gateZoneIds(scn: Scenario): string[] {
  return scn.zones.filter((z) => z.type === 'gate').map((z) => z.id);
}
function gateLinkIndex(scn: Scenario, gateId: string): number {
  return scn.links.findIndex((l) => l.mode === 'gate' && l.gate === gateId);
}
const peakBucketOf = (buckets: number[]): number => buckets.reduce((best, v, i) => (v > buckets[best] ? i : best), 0);

/** Sums each gate's screening-link flow into fixed `bucketMin`-wide windows — "expected arrivals
 *  per 10-minute bucket," read straight off the same frames the map/charts already use. */
export function bucketizeGateArrivals(scn: Scenario, result: SimResult, bucketMin = 10): GateBuckets {
  const nBuckets = Math.max(1, Math.ceil(scn.horizon / bucketMin));
  const out: GateBuckets = {};
  for (const gateId of gateZoneIds(scn)) {
    const li = gateLinkIndex(scn, gateId);
    const buckets = new Array(nBuckets).fill(0);
    if (li >= 0) for (let t = 0; t < result.frames.length; t++) buckets[Math.min(nBuckets - 1, Math.floor(t / bucketMin))] += result.frames[t]?.linkFlow[li] ?? 0;
    out[gateId] = buckets.map((v) => Math.round(v));
  }
  return out;
}

/** The Black Box entry frozen at approval (or at "now," for a plan still being decided): per-gate
 *  expected arrivals per bucket, peak bucket/density, and total dangerous minutes. */
export function freezePrediction(scn: Scenario, result: SimResult, atTick: number, bucketMin = 10): PredictedSnapshot {
  const perGate = bucketizeGateArrivals(scn, result, bucketMin);
  const peakBucket: Record<string, number> = {};
  const peakDen: Record<string, number> = {};
  for (const gateId of gateZoneIds(scn)) {
    const zi = scn.zones.findIndex((z) => z.id === gateId);
    let best = -1,
      bestT = 0;
    for (let t = 0; t < result.frames.length; t++) {
      const d = result.frames[t]?.zoneDen[zi] ?? 0;
      if (d > best) {
        best = d;
        bestT = t;
      }
    }
    peakBucket[gateId] = Math.floor(bestT / bucketMin);
    peakDen[gateId] = Math.round(best * 100) / 100;
  }
  return { frozenAtTick: atTick, bucketMin, perGate, peakBucket, peakDen, crushMin: result.crushMin };
}

/** A plausible actual scan stream, generated FROM the frozen prediction — never a second, separate
 *  invented number. Seeded noise (±15%) plus two disruptions always injected in a fixed, documented
 *  way: the busiest gate gets a "late train" (mass shifted later), the second-busiest gets a "slow
 *  lane" (throughput capped, backlog carried into the next bucket). Always tagged 'demo feed' by
 *  the caller — this function never claims to be real data. */
export function demoActualFeed(predicted: PredictedSnapshot, seed = 42): GateBuckets {
  const rand = mulberry32(seed);
  const gates = Object.keys(predicted.perGate).sort((a, b) => predicted.perGate[b].reduce((s, v) => s + v, 0) - predicted.perGate[a].reduce((s, v) => s + v, 0));
  const lateTrainGate = gates[0];
  const slowLaneGate = gates[1] ?? gates[0];
  const out: GateBuckets = {};
  for (const gateId of gates) {
    const pred = predicted.perGate[gateId];
    let series = pred.map((v) => Math.max(0, Math.round(v * (0.85 + rand() * 0.3))));
    if (gateId === lateTrainGate) {
      const shifted = new Array(series.length).fill(0);
      series.forEach((v, i) => (shifted[Math.min(series.length - 1, i + 2)] += v));
      series = shifted;
    }
    if (gateId === slowLaneGate) {
      let backlog = 0;
      series = series.map((v) => {
        const demand = v + backlog;
        const cap = Math.max(1, Math.round(v * 0.75));
        const processed = Math.min(demand, cap);
        backlog = demand - processed;
        return processed;
      });
    }
    out[gateId] = series;
  }
  return out;
}

export interface GateComparison {
  gateId: string;
  predictedTotal: number;
  actualTotal: number;
  /** signed: positive = busier than predicted */
  pctDiff: number;
  predictedPeakBucket: number;
  actualPeakBucket: number;
  peakShiftMin: number;
}

/** Predicted vs actual, per gate, worst mismatch first. */
export function compareGates(predicted: PredictedSnapshot, actual: GateBuckets): GateComparison[] {
  return Object.keys(predicted.perGate)
    .map((gateId) => {
      const pred = predicted.perGate[gateId] ?? [];
      const act = actual[gateId] ?? [];
      const predictedTotal = pred.reduce((a, b) => a + b, 0);
      const actualTotal = act.reduce((a, b) => a + b, 0);
      const pctDiff = predictedTotal > 0 ? Math.round(((actualTotal - predictedTotal) / predictedTotal) * 1000) / 10 : 0;
      const predictedPeakBucket = peakBucketOf(pred);
      const actualPeakBucket = peakBucketOf(act);
      return { gateId, predictedTotal, actualTotal, pctDiff, predictedPeakBucket, actualPeakBucket, peakShiftMin: (actualPeakBucket - predictedPeakBucket) * predicted.bucketMin };
    })
    .sort((a, b) => Math.abs(b.pctDiff) - Math.abs(a.pctDiff));
}

const meanAbsPct = (vals: number[]): number => (vals.length ? Math.round((vals.reduce((a, b) => a + Math.abs(b), 0) / vals.length) * 10) / 10 : 0);

export interface RecalFit {
  gateId: string;
  /** clamped 0.5..2 — "a turnout multiplier ... per cohort [feeding this gate]" */
  mult: number;
  /** clamped -45..45 minutes — "an arrival-time shift" */
  shiftMin: number;
}
const clampNum = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function fitRecalibration(comparisons: GateComparison[]): RecalFit[] {
  return comparisons.map((c) => ({
    gateId: c.gateId,
    mult: clampNum(c.predictedTotal > 0 ? c.actualTotal / c.predictedTotal : 1, 0.5, 2),
    shiftMin: clampNum(c.peakShiftMin, -45, 45),
  }));
}

/** Which gate a cohort ultimately screens through — the last gate-mode link on its path (its
 *  primary route; a cohort's `alt` reroute path is a separate, later concern, not part of the
 *  calibration fit). */
function gateOfCohort(scn: Scenario, c: Cohort): string | null {
  const byId = new Map(scn.links.map((l) => [l.id, l]));
  for (const linkId of c.path) {
    const l = byId.get(linkId);
    if (l?.mode === 'gate' && l.gate) return l.gate;
  }
  return null;
}

/** Applies each gate's fitted multiplier/shift to every cohort that screens through it. A clone,
 *  never a mutation of the caller's scenario — same convention as engine/whatif.ts's applyRain. */
export function applyRecalibration(scn: Scenario, fits: RecalFit[]): Scenario {
  const byGate = new Map(fits.map((f) => [f.gateId, f]));
  const out = clone(scn);
  out.cohorts = out.cohorts.map((c: Cohort) => {
    const gate = gateOfCohort(scn, c);
    const fit = gate ? byGate.get(gate) : undefined;
    if (!fit) return c;
    return { ...c, size: Math.max(0, Math.round(c.size * fit.mult)), mean: c.mean + fit.shiftMin };
  });
  return out;
}

export interface RecalibrationResult {
  fits: RecalFit[];
  /** mean absolute %, before vs after fitting — the "Forecast error 18% -> 6%" line */
  errorBefore: number;
  errorAfter: number;
  recalibratedScn: Scenario;
  recalibratedResult: SimResult;
}

/** The whole learning step: fit multiplier+shift per gate from actual vs. predicted, apply it to
 *  a fresh clone of the scenario, and re-run — "re-run the REST of the evening" (SOURCE_OF_TRUTH's
 *  monitor loop always re-simulates the whole evening under a patch that only changes what's ahead,
 *  never a literal in-place resume; recalibration follows that same, already-established shape).
 *  `ivs` MUST be the same interventions that produced `predicted` (e.g. the approved plan's nudge) —
 *  re-simulating with an empty plan here would silently drop any in-force reroute and compare the
 *  fit against a different evening than the one the actuals were actually measured against, which
 *  can make the error look worse instead of better (a real bug this function's own build caught). */
export function recalibrate(scn: Scenario, predicted: PredictedSnapshot, actual: GateBuckets, ivs: Intervention[] = [], opts: SimOptions = {}): RecalibrationResult {
  const comparisons = compareGates(predicted, actual);
  const fits = fitRecalibration(comparisons);
  const errorBefore = meanAbsPct(comparisons.map((c) => c.pctDiff));
  const recalibratedScn = applyRecalibration(scn, fits);
  const recalibratedResult = simulate(recalibratedScn, ivs, opts);
  const recalibratedPredicted = freezePrediction(recalibratedScn, recalibratedResult, 0, predicted.bucketMin);
  const errorAfter = meanAbsPct(compareGates(recalibratedPredicted, actual).map((c) => c.pctDiff));
  return { fits, errorBefore, errorAfter, recalibratedScn, recalibratedResult };
}

/** The trust ladder's one rule, shown with its reason, never a black-box score: a gate whose
 *  predicted-vs-actual error is within 15% across the event earns "verified"; otherwise it stays
 *  "claimed" (a fresh forecast has made no promise yet to be checked against). */
export function trustForGate(pctDiffAbs: number): 'claimed' | 'verified' {
  return Math.abs(pctDiffAbs) <= 15 ? 'verified' : 'claimed';
}
