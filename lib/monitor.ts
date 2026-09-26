/*
 * The monitor loop's pure logic (Watch -> Detect -> Re-plan -> Ask). lib/console.ts owns the store
 * mutation, worker calls and ledger writes — exactly the split lib/buckets.ts and lib/roomVotes.ts
 * already use for their own pieces of state. Nothing here calls simulate() directly; it only
 * merges/matches already-validated, already-clamped data (WhatIfSpec, RedTeamResult).
 */
import { buildNight, type RedTeamFactors, type RedTeamResult, type Scenario, type SimOptions } from '@/engine';
import { EMPTY_SPEC, type WhatIfSpec } from './whatifParse';

export type ActionState = 'proposed' | 'accepted' | 'skipped' | 'expired' | 'superseded' | 'still-working' | 'stopped-working';

/**
 * The same WhatIfSpec -> {scn, opts} mapping runWhatIfSpec() already used (buildNight + the show-
 * delay case), factored out so the monitor loop can build the exact same "apply the observed
 * conditions" scenario a manual what-if test would, plus "lock the past": every capacity patch is
 * clamped to start no earlier than `lockFromTick`, the same principle retime()/fracRemaining()
 * already apply to individual levers, now applied to an observed-conditions patch too.
 */
export function buildObservedScenario(base: Scenario, observed: WhatIfSpec, lockFromTick: number): { scn: Scenario; opts: SimOptions } {
  const { scn, opts } = buildNight(base, {
    turnout: 1 + observed.turnoutPct / 100,
    rain: observed.rain,
    railFail: observed.railFailAt != null ? Math.max(0, observed.railFailAt - base.t0Min) : null,
    gatesLate: observed.gatesLateMin,
    slowLanes: observed.slowLanes,
  });
  if (observed.showDelayMin) {
    scn.showStartTick += observed.showDelayMin;
    scn.cohorts.forEach((c) => (c.mean += Math.round(observed.showDelayMin * 0.6)));
  }
  if (opts.patch) opts.patch.fromTick = Math.max(opts.patch.fromTick || 0, lockFromTick);
  if (opts.linkCapMult) for (const k of Object.keys(opts.linkCapMult)) opts.linkCapMult[k] = { ...opts.linkCapMult[k], fromTick: Math.max(opts.linkCapMult[k].fromTick, lockFromTick) };
  return { scn, opts };
}

/**
 * Merge a newly observed report (a rail delay, a rain chip, a typed staff report parsed the same
 * way a what-if question is) into the running observed-inputs patch. Severity-preserving: once
 * something is reported it can only get worse or more specific with a later report, never
 * silently un-reported — an organiser correcting a false report clears it explicitly (resetObserved).
 */
export function mergeObserved(cur: WhatIfSpec, incoming: Partial<WhatIfSpec>): WhatIfSpec {
  return {
    rain: cur.rain || !!incoming.rain,
    railFailAt: incoming.railFailAt != null ? (cur.railFailAt != null ? Math.min(cur.railFailAt, incoming.railFailAt) : incoming.railFailAt) : cur.railFailAt,
    showDelayMin: Math.max(cur.showDelayMin, incoming.showDelayMin ?? 0),
    gatesLateMin: Math.max(cur.gatesLateMin, incoming.gatesLateMin ?? 0),
    turnoutPct: incoming.turnoutPct ? Math.max(-30, Math.min(30, cur.turnoutPct + incoming.turnoutPct)) : cur.turnoutPct,
    slowLanes: cur.slowLanes || !!incoming.slowLanes,
  };
}

export const isObservedEmpty = (s: WhatIfSpec) => !s.rain && s.railFailAt == null && !s.showDelayMin && !s.gatesLateMin && !s.turnoutPct && !s.slowLanes;

/** A pre-armed tripwire: one factor Red Team found this plan breaks under at least half the time,
 *  paired with the backup plan Red Team already computed for its single worst night. "Propose",
 *  never "execute" — lib/console.ts only ever turns a fired tripwire into a new Plan B to approve. */
export interface Tripwire {
  key: keyof RedTeamFactors;
  label: string;
  failRate: number;
}

export function tripwiresFor(rt: RedTeamResult | undefined): Tripwire[] {
  if (!rt?.backup) return [];
  return rt.breaksWhen.map((b) => ({ key: b.key, label: b.label, failRate: b.failRate }));
}

function factorMatches(key: keyof RedTeamFactors, value: RedTeamFactors[keyof RedTeamFactors], observed: WhatIfSpec): boolean {
  switch (key) {
    case 'rain':
      return !!value && observed.rain;
    case 'railFail':
      return value != null && observed.railFailAt != null;
    case 'gatesLate':
      return (value as number) > 0 && observed.gatesLateMin >= (value as number);
    case 'turnout': {
      const v = value as number;
      if (v > 1) return observed.turnoutPct >= Math.round((v - 1) * 100);
      if (v < 1) return observed.turnoutPct <= -Math.round((1 - v) * 100);
      return false;
    }
    case 'slowLanes':
      return !!value && observed.slowLanes;
  }
}

/** Which of Red Team's "breaks when" factors are matched by what's actually been observed right
 *  now. Backup-array `rt.breaksWhen` already carries {key, value}; this just checks each against
 *  the live, clamped WhatIfSpec — no new numbers, no invented thresholds. */
export function firedTripwires(rt: RedTeamResult | undefined, observed: WhatIfSpec): Tripwire[] {
  if (!rt?.backup || isObservedEmpty(observed)) return [];
  return rt.breaksWhen.filter((b) => factorMatches(b.key, b.value, observed)).map((b) => ({ key: b.key, label: b.label, failRate: b.failRate }));
}

export { EMPTY_SPEC };
