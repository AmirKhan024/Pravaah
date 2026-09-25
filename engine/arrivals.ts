import type { Cohort, Pulse } from './types';

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
