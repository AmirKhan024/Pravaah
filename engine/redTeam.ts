/*
 * RED TEAM (SOURCE_OF_TRUTH §8.3) — we try to break our own plan.
 * Every combination of bad-night factors is run twice (do nothing, and the plan) in lite mode.
 * A night is "survived" when dangerous minutes stay ≤ 5 and the plan leaves no more people
 * outside at showtime than doing nothing would. The worst night gets its own backup plan.
 */
import { arrivalCurve } from './arrivals';
import { clone } from './ensemble';
import { type Lever } from './interventions';
import { optimise } from './optimise';
import { simulate } from './simulate';
import { applyRain, isRail, railLinks } from './whatif';
import type { Scenario, SimOptions } from './types';

export const SURVIVE_CRUSH = 5;

export interface RedTeamFactors {
  turnout: number;
  rain: boolean;
  /** tick the rail line fails, or null */
  railFail: number | null;
  gatesLate: number;
  slowLanes: boolean;
}

export interface RedTeamNight {
  f: RedTeamFactors;
  labels: string[];
  planCrush: number;
  planMissed: number;
  noneCrush: number;
  noneMissed: number;
  survived: boolean;
  /** safe: ≤5 dangerous min · better: fewer than doing nothing · same · worse: more than doing nothing */
  tier: 'safe' | 'better' | 'same' | 'worse';
}

export interface RedTeamResult {
  nights: RedTeamNight[];
  survived: number;
  total: number;
  worst: RedTeamNight;
  /** factor values under which the plan fails at least half the time */
  breaksWhen: { label: string; failRate: number; n: number }[];
  backup: { chosen: Lever[]; crush: number; missed: number; rupees: number } | null;
  /** the 12-night stress batch view (same nights as the decision window) */
  headline: { survived: number; total: number };
  tiers: Record<RedTeamNight['tier'], number>;
}

const TURNOUT = [0.9, 1, 1.12, 1.2];
const RAIL_FAIL_MIN = [null, 18 * 60, 18 * 60 + 30, 19 * 60];
const GATES_LATE = [0, 30, 60];

export function describeNight(scn: Scenario, f: RedTeamFactors): string[] {
  const out: string[] = [];
  if (f.turnout > 1) out.push(Math.round((f.turnout - 1) * 100) + '% more people than expected');
  if (f.turnout < 1) out.push(Math.round((1 - f.turnout) * 100) + '% fewer people');
  if (f.rain) out.push('heavy rain');
  if (f.railFail != null) {
    const m = scn.t0Min + f.railFail;
    out.push('the rail line fails at ' + String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
  }
  if (f.gatesLate) out.push('gates open ' + f.gatesLate + ' min late');
  if (f.slowLanes) out.push('bag checks 10% slower');
  return out;
}

export function buildNight(base: Scenario, f: RedTeamFactors): { scn: Scenario; opts: SimOptions } {
  const scn = clone(base);
  const opts: SimOptions = {};
  if (f.turnout !== 1) scn.cohorts.forEach((c) => (c.size = Math.round(c.size * f.turnout)));
  if (f.rain) {
    applyRain(scn);
    opts.patch = { capMult: { walk: 0.74, road: 0.85 }, fromTick: Math.max(0, scn.showStartTick - 90) };
  }
  if (f.railFail != null) {
    // people still to travel when the line fails are delayed and bunched; the station approaches choke
    const T = f.railFail;
    scn.cohorts.forEach((c) => {
      if (!isRail(c)) return;
      const curve = arrivalCurve(c.mean, c.std, scn.horizon, null);
      let cum = 0;
      for (let t = 0; t <= Math.min(scn.horizon - 1, T); t++) cum += curve[t];
      const rem = Math.max(0, 1 - cum);
      c.mean += 26 * rem;
      c.std = Math.max(16, c.std - 9 * rem);
    });
    opts.linkCapMult = {};
    for (const id of railLinks(scn)) opts.linkCapMult[id] = { mult: 0.42, fromTick: T };
  }
  if (f.gatesLate) scn.gatesOpenTick += f.gatesLate;
  if (f.slowLanes) scn.laneRate = scn.laneRate * 0.9;
  return { scn, opts };
}

export function runRedTeam(base: Scenario, plan: Lever[], onProgress?: (f: number) => void, withBackup = true): RedTeamResult {
  const grid: RedTeamFactors[] = [];
  const railFails = base.cohorts.some(isRail) ? RAIL_FAIL_MIN.map((m) => (m == null ? null : m - base.t0Min)) : [null];
  for (const turnout of TURNOUT)
    for (const rain of [false, true])
      for (const railFail of railFails) for (const gatesLate of GATES_LATE) for (const slowLanes of [false, true]) grid.push({ turnout, rain, railFail, gatesLate, slowLanes });

  const nights: RedTeamNight[] = grid.map((f, i) => {
    const { scn, opts } = buildNight(base, f);
    const none = simulate(scn, [], { ...opts, lite: true });
    const waits = { ...none.gateWaitPeak };
    const r = simulate(scn, plan, { ...opts, lite: true, waits });
    onProgress?.((i + 1) / grid.length);
    const survived = r.crushMin <= SURVIVE_CRUSH && r.missed <= none.missed;
    const tier: RedTeamNight['tier'] = survived ? 'safe' : r.crushMin < none.crushMin ? 'better' : r.crushMin > none.crushMin ? 'worse' : 'same';
    return { f, labels: describeNight(base, f), planCrush: r.crushMin, planMissed: r.missed, noneCrush: none.crushMin, noneMissed: none.missed, survived, tier };
  });

  const worst = nights.reduce((a, b) => (b.planCrush > a.planCrush || (b.planCrush === a.planCrush && b.planMissed > a.planMissed) ? b : a), nights[0]);

  // which single factor values make failure likely?
  const dims: { key: keyof RedTeamFactors; label: (v: unknown) => string | null }[] = [
    { key: 'turnout', label: (v) => ((v as number) > 1 ? Math.round(((v as number) - 1) * 100) + '% more people' : null) },
    { key: 'rain', label: (v) => (v ? 'heavy rain' : null) },
    { key: 'railFail', label: (v) => (v == null ? null : 'rail fails at ' + tickLabel(base, v as number)) },
    { key: 'gatesLate', label: (v) => ((v as number) ? 'gates open ' + v + ' min late' : null) },
    { key: 'slowLanes', label: (v) => (v ? 'slower bag checks' : null) },
  ];
  const breaksWhen: RedTeamResult['breaksWhen'] = [];
  for (const d of dims) {
    const vals = [...new Set(nights.map((n) => JSON.stringify(n.f[d.key])))];
    for (const vs of vals) {
      const v = JSON.parse(vs);
      const lab = d.label(v);
      if (!lab) continue;
      const sub = nights.filter((n) => JSON.stringify(n.f[d.key]) === vs);
      const failRate = sub.filter((n) => !n.survived).length / sub.length;
      if (failRate >= 0.5) breaksWhen.push({ label: lab, failRate, n: sub.length });
    }
  }
  breaksWhen.sort((a, b) => b.failRate - a.failRate);

  let backup: RedTeamResult['backup'] = null;
  if (withBackup && !worst.survived) {
    const { scn, opts } = buildNight(base, worst.f);
    const waits = { ...simulate(scn, [], { ...opts, lite: true }).gateWaitPeak };
    const b = optimise(scn, { w: [1.0, 0.55, 0.9, 0.04, 0.05, 2.0], depth: 6, waits, opts, liteResult: true });
    backup = { chosen: b.chosen, crush: b.result.crushMin, missed: b.result.missed, rupees: b.result.rupees };
  }

  // the 12 named nights (turnout {1,1.12,0.9} × rain × late train) — the same batch the decision window uses
  const twelve = nights.filter((n) => [1, 1.12, 0.9].includes(n.f.turnout) && !n.f.gatesLate && !n.f.slowLanes && (n.f.railFail == null || n.f.railFail === railFails[2]));
  return {
    nights,
    survived: nights.filter((n) => n.survived).length,
    total: nights.length,
    worst,
    breaksWhen,
    backup,
    headline: { survived: twelve.filter((n) => n.survived).length, total: twelve.length },
    tiers: nights.reduce((o, n) => ((o[n.tier] += 1), o), { safe: 0, better: 0, same: 0, worse: 0 } as Record<RedTeamNight['tier'], number>),
  };
}

function tickLabel(scn: Scenario, t: number) {
  const m = scn.t0Min + t;
  return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
