import type { Cohort, Pulse, Scenario } from './types';

/**
 * Gaussian arrival weights over [0,H), normalised to sum 1.
 * With a pulse, each `period`-tick window's share is redistributed evenly over `width` ticks —
 * trains discharging in bursts. Crushes are built from bursts; do not smooth this away.
 */
export function arrivalCurve(mean: number, std: number, H: number, pulse?: Pulse | null): Float64Array {
  const w = new Float64Array(H);
  let s = 0;
  for (let t = 0; t < H; t++) {
    const z = (t - mean) / std;
    const v = Math.exp(-0.5 * z * z);
    w[t] = v;
    s += v;
  }
  for (let t = 0; t < H; t++) w[t] /= s;
  if (!pulse) return w;
  const p = new Float64Array(H);
  for (let t0 = 0; t0 < H; t0 += pulse.period) {
    let sum = 0;
    for (let k = 0; k < pulse.period && t0 + k < H; k++) sum += w[t0 + k];
    for (let k = 0; k < pulse.width; k++) {
      const t = t0 + (pulse.offset % pulse.period) + k;
      if (t < H) p[t] += sum / pulse.width;
    }
  }
  return p;
}

/**
 * Share of a cohort that has not yet arrived by `decisionTick`. A late decision can only
 * act on people who have not already gone past the point it was meant to change.
 */
export function fracRemaining(cohort: Pick<Cohort, 'mean' | 'std'>, decisionTick: number, H: number): number {
  const curve = arrivalCurve(cohort.mean, cohort.std, H, null);
  let cum = 0;
  const upto = Math.max(0, Math.min(H - 1, Math.round(decisionTick)));
  for (let t = 0; t <= upto; t++) cum += curve[t];
  return Math.max(0, Math.min(1, 1 - cum));
}

export interface PeakBurst {
  cohortId: string;
  /** people in the single busiest pulse window for this cohort */
  size: number;
  /** rounded to the nearest 100, for display */
  rounded: number;
  /** the pulse period in ticks (minutes) */
  every: number;
  /** the link this cohort's burst travels first — where the crowd actually shows up */
  firstLink: string;
}

/**
 * The single busiest pulse-window burst across a scenario's pulsed (rail/metro) cohorts —
 * "trains discharge roughly N people every M minutes." This is the ONE place that number is
 * computed; copy (console fact blocks, ablation test descriptions, docs) must read it from here
 * instead of writing a remembered figure, or the two can silently drift apart (as "~900 people"
 * did against this scenario's real ~2,000-person Nerul burst).
 */
export function peakPulseBurst(scn: Pick<Scenario, 'cohorts' | 'horizon'>): PeakBurst | null {
  let best: PeakBurst | null = null;
  for (const c of scn.cohorts) {
    if (!c.pulse) continue;
    const curve = arrivalCurve(c.mean, c.std, scn.horizon, c.pulse);
    let bestShare = 0;
    for (let t0 = 0; t0 < scn.horizon; t0 += c.pulse.period) {
      let sum = 0;
      for (let k = 0; k < c.pulse.period && t0 + k < scn.horizon; k++) sum += curve[t0 + k];
      if (sum > bestShare) bestShare = sum;
    }
    const size = bestShare * c.size;
    if (!best || size > best.size) best = { cohortId: c.id, size, rounded: Math.round(size / 100) * 100, every: c.pulse.period, firstLink: c.path[0] };
  }
  return best;
}
