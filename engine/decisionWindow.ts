/*
 * Decision window — "how long do I have left to act". Port of buildStressBatch()/
 * computeDecisionBoard() in reference/prototype.html.
 *
 * For each lever in the recommended plan, on each of 12 rough nights, try starting it at a
 * handful of checkpoints. The deadline on that night is the last checkpoint that still delivers
 * ≥15% of that night's best benefit (and ≥1 dangerous minute). The shown deadline is the EARLIEST
 * across nights — the most cautious answer. The live countdown is arithmetic: deadline − now.
 */
import { clone } from './ensemble';
import { PARAM_FOR_TYPE, type Lever } from './interventions';
import { simulate } from './simulate';
import { applyRailFail, applyRain } from './whatif';
import type { Intervention, Scenario } from './types';

export const BOARD_CHECKS = [120, 180, 240, 300, 360, 420];
export const BOARD_KEEP = 0.15;
export const BOARD_MIN_HELP = 1;
export const MAX_BOARD_OPTIONS = 4;

const STRESS_TURNOUT = [
  { id: 'normal', label: null, mult: 1 },
  { id: 'more', label: 'more people than expected', mult: 1.12 },
  { id: 'fewer', label: 'fewer people than expected', mult: 0.9 },
];
const STRESS_RAIN = [
  { id: 'none', label: null, on: false },
  { id: 'rain', label: 'heavy rain', on: true },
];
const STRESS_TRAIN = [
  { id: 'none', label: null, on: false },
  { id: 'late', label: 'a late train', on: true },
];

export interface StressNight {
  id: string;
  labels: string[];
  build: () => Scenario;
}

export function buildStressBatch(base: Scenario): StressNight[] {
  const out: StressNight[] = [];
  for (const to of STRESS_TURNOUT)
    for (const ra of STRESS_RAIN)
      for (const tr of STRESS_TRAIN) {
        const labels = [to.label, ra.label, tr.label].filter(Boolean) as string[];
        out.push({
          id: to.id + '_' + ra.id + '_' + tr.id,
          labels,
          build: () => {
            const scn = clone(base);
            if (to.mult !== 1) scn.cohorts.forEach((c) => (c.size = Math.round(c.size * to.mult)));
            if (ra.on) applyRain(scn);
            if (tr.on) applyRailFail(scn);
            return scn;
          },
        });
      }
  return out; // 3 × 2 × 2 = 12 rough versions of tonight
}

export interface BoardOption {
  id: string;
  label: string;
  iv: Lever;
  deadlineTick: number;
  useless: boolean;
  tested: number;
  worstLabels: string[];
  /** per-night benefit curves, for the drill-down chart */
  curves: { night: string; labels: string[]; points: { t: number; benefit: number }[]; deadline: number | null }[];
}

export function boardOptionIv(iv: Lever, t: number): Intervention[] {
  const copy = { ...iv } as Record<string, unknown>;
  copy[PARAM_FOR_TYPE[iv.type]] = t;
  return [copy as unknown as Intervention];
}

export function computeDecisionBoard(scn: Scenario, plan: Lever[], onProgress?: (f: number) => void): BoardOption[] {
  const options = plan.slice(0, MAX_BOARD_OPTIONS);
  if (!options.length) return [];
  const nights = buildStressBatch(scn).map((night) => {
    const s = night.build();
    const probe = simulate(s, [], { lite: true });
    const waits = { ...probe.gateWaitPeak };
    const base = simulate(s, [], { lite: true, waits }).crushMin;
    return { id: night.id, labels: night.labels, scn: s, waits, base };
  });
  const total = options.length * nights.length;
  let done = 0;
  const out: BoardOption[] = [];
  options.forEach((iv, i) => {
    let earliest: number | null = null,
      worstLabels: string[] | null = null,
      anyHelped = false;
    const curves: BoardOption['curves'] = [];
    for (const night of nights) {
      const curve = BOARD_CHECKS.map((t) => {
        const r = simulate(night.scn, boardOptionIv(iv, t), { lite: true, waits: night.waits });
        return { t, benefit: Math.max(0, night.base - r.crushMin) };
      });
      onProgress?.(++done / total);
      let maxBenefit = 0;
      curve.forEach((c) => {
        if (c.benefit > maxBenefit) maxBenefit = c.benefit;
      });
      if (maxBenefit < BOARD_MIN_HELP) {
        curves.push({ night: night.id, labels: night.labels, points: curve, deadline: null });
        continue;
      }
      anyHelped = true;
      let deadline = BOARD_CHECKS[0];
      for (const c of curve) if (c.benefit >= BOARD_KEEP * maxBenefit) deadline = c.t;
      curves.push({ night: night.id, labels: night.labels, points: curve, deadline });
      if (earliest === null || deadline < earliest) {
        earliest = deadline;
        worstLabels = night.labels;
      }
    }
    out.push({
      id: 'brd_' + i,
      label: iv.label || iv.type,
      iv,
      deadlineTick: earliest === null ? BOARD_CHECKS[0] : earliest,
      useless: !anyHelped,
      tested: nights.length,
      worstLabels: worstLabels || [],
      curves,
    });
  });
  out.sort((a, b) => a.deadlineTick - b.deadlineTick);
  return out;
}
