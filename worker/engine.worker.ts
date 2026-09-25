/// <reference lib="webworker" />
/*
 * Heavy searches run here, never on the main thread (SOURCE_OF_TRUTH §6.9, §14.5).
 * Everything is the same deterministic engine; this file only schedules it.
 */
import * as Comlink from 'comlink';
import {
  candidates,
  computeDecisionBoard,
  optimise,
  PROFILE_NAMES,
  PROFILES,
  probeWaits,
  retime,
  runAblation,
  runEnsemble,
  runRedTeam,
  runRejected,
  simulate,
  type Lever,
  type Scenario,
  type SimOptions,
  type Weights,
} from '../engine';

export type Stage =
  | { kind: 'ensemble'; data: ReturnType<typeof runEnsemble> }
  | { kind: 'ablation'; data: ReturnType<typeof runAblation> }
  | { kind: 'rejected'; data: ReturnType<typeof runRejected> }
  | { kind: 'plan'; name: string; chosen: Lever[]; crushMin: number; rupees: number; evals: number; ms: number }
  | { kind: 'plansDone'; evals: number; ms: number }
  | { kind: 'board'; data: ReturnType<typeof computeDecisionBoard> }
  | { kind: 'progress'; task: string; f: number };

const api = {
  /** the whole PREDICT → EXPLAIN → PROVE pass for a scenario, streamed stage by stage */
  async intel(scn: Scenario, watchZone: number, onStage: (s: Stage) => void) {
    const waits = probeWaits(scn);
    const base = simulate(scn, [], { waits, lite: true });
    const ens = runEnsemble(scn, 60, watchZone, (f) => onStage({ kind: 'progress', task: 'ensemble', f }));
    onStage({ kind: 'ensemble', data: ens });
    onStage({ kind: 'ablation', data: runAblation(scn, base, waits) });
    onStage({ kind: 'rejected', data: runRejected(scn, waits) });
    const t0 = performance.now();
    let evals = 0;
    let recommended: Lever[] = [];
    for (const name of PROFILE_NAMES) {
      const pf = PROFILES[name];
      const s0 = performance.now();
      const p = optimise(scn, { w: pf.w, depth: pf.depth, filter: pf.filter, waits, liteResult: true, onEval: () => {} });
      evals += p.evals;
      if (!recommended.length) recommended = p.chosen;
      onStage({ kind: 'plan', name, chosen: p.chosen, crushMin: p.result.crushMin, rupees: p.result.rupees, evals: p.evals, ms: Math.round(performance.now() - s0) });
    }
    onStage({ kind: 'plansDone', evals, ms: Math.round(performance.now() - t0) });
    const board = computeDecisionBoard(scn, recommended, (f) => onStage({ kind: 'progress', task: 'board', f }));
    onStage({ kind: 'board', data: board });
  },

  async redTeam(scn: Scenario, plan: Lever[], onProgress: (f: number) => void) {
    return runRedTeam(scn, plan, onProgress);
  },

  /** the decision clock hit zero: re-plan from `tick` without the levers that have closed */
  async replan(scn: Scenario, tick: number, expired: string[], opts?: SimOptions) {
    const waits = probeWaits(scn, opts);
    const levers = candidates(scn)
      .filter((c) => expired.indexOf(c.label) < 0)
      .map((c) => retime(c, tick, scn));
    const pf = PROFILES['Balanced'];
    const p = optimise(scn, { w: pf.w, depth: pf.depth, waits, levers, opts, liteResult: true });
    return { chosen: p.chosen, crushMin: p.result.crushMin, rupees: p.result.rupees, missed: p.result.missed, evals: p.evals };
  },

  /** a venue's do-nothing evening plus the free and balanced plans (venues page) */
  async venuePlans(scn: Scenario) {
    const waits = probeWaits(scn);
    const t0 = performance.now();
    const out: Record<string, { chosen: Lever[]; crushMin: number; rupees: number; missed: number; maxGateWait: number }> = {};
    let evals = 0;
    for (const name of ['Zero rupees', 'Balanced'] as const) {
      const pf = PROFILES[name];
      const p = optimise(scn, { w: pf.w, depth: pf.depth, filter: pf.filter, waits, liteResult: true });
      evals += p.evals;
      out[name] = { chosen: p.chosen, crushMin: p.result.crushMin, rupees: p.result.rupees, missed: p.result.missed, maxGateWait: p.result.maxGateWait };
    }
    return { plans: out, evals, ms: Math.round(performance.now() - t0) };
  },

  async ensemble(scn: Scenario, zone: number) {
    return runEnsemble(scn, 60, zone);
  },

  async custom(scn: Scenario, w: Weights, depth: number) {
    const waits = probeWaits(scn);
    const t0 = performance.now();
    const p = optimise(scn, { w, depth, waits, liteResult: true });
    return { chosen: p.chosen, crushMin: p.result.crushMin, rupees: p.result.rupees, evals: p.evals, ms: Math.round(performance.now() - t0) };
  },
};

export type EngineApi = typeof api;
Comlink.expose(api);
