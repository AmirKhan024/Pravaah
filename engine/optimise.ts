/*
 * Greedy forward search over levers — port of optimise() in reference/prototype.html.
 * Synchronous (it runs in a Web Worker in the app); progress is reported through a callback.
 */
import { candidates, costOf, feasible, PROFILES, type Lever, type ProfileName, type Weights } from './interventions';
import { simulate } from './simulate';
import type { Scenario, SimOptions, SimResult } from './types';

export interface OptimiseResult {
  chosen: Lever[];
  result: SimResult;
  evals: number;
}

export interface OptimiseArgs {
  w: Weights;
  waits: Record<string, number>;
  depth?: number;
  filter?: (c: Lever) => boolean;
  /** override the lever list (e.g. re-planning from the current tick without an expired lever) */
  levers?: Lever[];
  /** extra options applied to every run (what-if patches, room overrides) */
  opts?: SimOptions;
  onEval?: (n: number) => void;
  /** skip frames on the final run */
  liteResult?: boolean;
}

export function optimise(scn: Scenario, a: OptimiseArgs): OptimiseResult {
  const all = a.levers || candidates(scn);
  const C = a.filter ? all.filter(a.filter) : all;
  const chosen: Lever[] = [];
  const base = { ...(a.opts || {}), waits: a.waits };
  let evals = 0;
  const best = simulate(scn, [], { ...base, lite: true });
  evals++;
  let bestCost = costOf(best, a.w);
  for (let d = 0; d < (a.depth || 3); d++) {
    let pick: Lever | null = null,
      pc = bestCost;
    for (const c of C) {
      if (chosen.indexOf(c) >= 0) continue;
      const trial = chosen.concat([c]);
      if (!feasible(trial)) continue;
      const r = simulate(scn, trial, { ...base, lite: true });
      evals++;
      a.onEval?.(evals);
      const j = costOf(r, a.w);
      if (j < pc - 1e-9) {
        pc = j;
        pick = c;
      }
    }
    if (!pick) break;
    chosen.push(pick);
    bestCost = pc;
  }
  return { chosen, result: simulate(scn, chosen, { ...base, lite: !!a.liteResult }), evals: evals + 1 };
}

export function optimiseProfile(scn: Scenario, name: ProfileName, waits: Record<string, number>, extra?: Partial<OptimiseArgs>): OptimiseResult {
  const pf = PROFILES[name];
  return optimise(scn, { w: pf.w, depth: pf.depth, filter: pf.filter, waits, ...(extra || {}) });
}
