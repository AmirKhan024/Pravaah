/*
 * GOLDEN TEST (SOURCE_OF_TRUTH §6.10). golden.json is produced by running the engine code of
 * reference/prototype.html itself (scripts/extract-golden.mjs). The TypeScript port must reproduce
 * it exactly. Do not "improve" the engine without updating this deliberately.
 */
import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import {
  WHATIFS,
  applyWhatIf,
  computeDecisionBoard,
  dyPatil,
  jitter,
  marathon,
  optimiseProfile,
  personPath,
  PROFILE_NAMES,
  probeWaits,
  RAVI,
  runAblation,
  runEnsemble,
  runRejected,
  simulate,
  tracePerson,
  type SimResult,
} from '../index';

const close = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThanOrEqual(eps);
const closeArr = (a: ArrayLike<number>, b: number[]) => {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < b.length; i++) close(a[i], b[i], 2e-6);
};

type G = typeof golden;
function matchSummary(r: SimResult, g: G['base'], opts: { waitHours?: boolean } = {}) {
  expect(r.crushMin).toBe(g.crushMin);
  expect(r.missed).toBe(g.missed);
  expect(r.rupees).toBe(g.rupees);
  expect(r.inconvenience).toBe(g.inconvenience);
  expect(r.unhoused).toBe(g.unhoused);
  expect(r.housed).toBe(g.housed);
  close(r.maxGateWait, g.maxGateWait);
  if (opts.waitHours !== false) close(r.waitHours, g.waitHours, 1e-5);
  closeArr(r.peakDen, g.peakDen);
  closeArr(r.peakLinkDen, g.peakLinkDen);
  closeArr(r.maxDenSeries, g.maxDenSeries);
  expect(Array.from(r.crushSeries)).toEqual(g.crushSeries);
  for (const k of Object.keys(g.gateWaitPeak)) close(r.gateWaitPeak[k], (g.gateWaitPeak as Record<string, number>)[k]);
  for (const k of Object.keys(g.foodWaitPeak)) close(r.foodWaitPeak[k], (g.foodWaitPeak as Record<string, number>)[k]);
  expect(r.worst.zone).toBe(g.worst.zone);
  expect(r.worst.tick).toBe(g.worst.tick);
  close(r.worst.den, g.worst.den);
  expect(r.nudgeInfo.length).toBe(g.nudgeInfo.length);
  r.nudgeInfo.forEach((n, i) => {
    const gn = g.nudgeInfo[i] as { cohort: string; accepted: number; saved: number; p: number };
    expect(n.cohort).toBe(gn.cohort);
    expect(n.accepted).toBe(gn.accepted);
    expect(n.saved).toBe(gn.saved);
    close(n.p, gn.p);
  });
}

const waits = probeWaits(dyPatil);
const base = simulate(dyPatil, [], { waits });

describe('simulate() matches the prototype', () => {
  it('probe waits', () => {
    for (const k of Object.keys(golden.waits)) close(waits[k], (golden.waits as Record<string, number>)[k]);
  });
  it('do-nothing probe (no waits)', () => matchSummary(simulate(dyPatil, [], { lite: true }), golden.probe));
  it('do-nothing evening', () => matchSummary(base, golden.base));
  it('frames at key minutes', () => {
    for (const gf of golden.baseFrames) {
      const f = base.frames[gf.t];
      closeArr(f.zoneOcc, gf.zoneOcc);
      closeArr(f.zoneDen, gf.zoneDen);
      closeArr(f.linkOcc, gf.linkOcc);
      closeArr(f.linkFlow, gf.linkFlow);
      closeArr(f.linkTT, gf.linkTT);
      close(f.arrived, gf.arrived, 1e-5);
      expect(f.crush).toBe(gf.crush);
    }
  });
  it('late decisions (fracRemaining)', () => {
    const r = simulate(
      dyPatil,
      [
        { type: 'nudge', cohort: 'nerul_rail', ask: 'reroute', rupees: 0, decisionTick: 290 },
        { type: 'house', decisionTick: 300 },
        { type: 'stagger', cohort: 'kharghar_htl', delta: -30, decisionTick: 250 },
      ],
      { lite: true, waits },
    );
    matchSummary(r, golden.lateDecision);
  });
  it('scenario B (engine is scenario-agnostic)', () => {
    const w = probeWaits(marathon);
    // prototype waitHours is NaN for B (hardcoded DY Patil plaza ids); ours sums all plazas — skip it
    matchSummary(simulate(marathon, [], { waits: w }), golden.scenarioB, { waitHours: false });
  });
});

describe('optimiser matches the prototype', () => {
  for (const name of PROFILE_NAMES) {
    it(name, () => {
      const p = optimiseProfile(dyPatil, name, waits);
      const g = (golden.plans as Record<string, { chosen: string[]; result: G['base'] }>)[name];
      expect(p.chosen.map((c) => c.label)).toEqual(g.chosen);
      matchSummary(p.result, g.result);
    });
  }
});

describe('analyses match the prototype', () => {
  it('jitter', () => {
    const j = jitter(dyPatil, 1000);
    golden.jitterSample.forEach((gc, i) => {
      expect(j.cohorts[i].size).toBe(gc.size);
      close(j.cohorts[i].mean, gc.mean);
      close(j.cohorts[i].std, gc.std);
    });
  });
  it('ensemble (60 runs)', () => {
    const e = runEnsemble(dyPatil, 60, dyPatil.zones.findIndex((z) => z.id === 'fc_west'));
    const g = golden.ensemble;
    close(e.p, g.p);
    expect(e.tMed).toBe(g.tMed);
    expect(e.tLo).toBe(g.tLo);
    expect(e.tHi).toBe(g.tHi);
    close(e.peakMed, g.peakMed);
    expect(e.crushMed).toBe(g.crushMed);
    expect(e.missMed).toBe(g.missMed);
  });
  it('ablation', () => {
    const a = runAblation(dyPatil, base, waits);
    expect(a.map((x) => [x.name, x.removed, x.left])).toEqual(golden.ablation.map((x) => [x.name, x.removed, x.left]));
  });
  it('rejected options', () => {
    const r = runRejected(dyPatil, waits);
    expect(r.map((x) => [x.name, x.left, x.cost])).toEqual(golden.constraints.map((x) => [x.name, x.left, x.cost]));
  });
  it('decision window board', () => {
    const plan = optimiseProfile(dyPatil, 'Zero rupees', waits).chosen;
    const b = computeDecisionBoard(dyPatil, plan);
    expect(b.map((o) => [o.label, o.deadlineTick, o.useless, o.tested, o.worstLabels])).toEqual(
      golden.decisionBoard.options.map((o) => [o.label, o.deadlineTick, o.useless, o.tested, o.worstLabels]),
    );
  });
  it('Ravi trace, both evenings', () => {
    const zr = optimiseProfile(dyPatil, 'Zero rupees', waits).result;
    for (const [res, g] of [
      [base, golden.ravi.base],
      [zr, golden.ravi.zeroRupees],
    ] as const) {
      const tr = tracePerson(dyPatil, res, personPath(dyPatil, res), RAVI.release);
      expect(tr.inside).toBe(g.inside);
      expect(tr.waited).toBe(g.waited);
      close(tr.worst, g.worst);
      expect(tr.segs.map((s) => [s.type, s.from, s.to])).toEqual(g.segs.map((s) => [s.type, s.from, s.to]));
    }
  });
  it('what-ifs', () => {
    const zeroPlan = optimiseProfile(dyPatil, 'Zero rupees', waits).chosen;
    for (const w of WHATIFS) {
      const { scn, opts } = applyWhatIf(dyPatil, w);
      const ww = probeWaits(scn, opts);
      const none = simulate(scn, [], { ...opts, waits: ww, lite: true });
      const withPlan = simulate(scn, zeroPlan, { ...opts, waits: ww, lite: true });
      const g = (golden.whatIfs as Record<string, { none: { crushMin: number; missed: number }; zeroRupees: { crushMin: number; missed: number } }>)[w.id];
      expect([none.crushMin, none.missed]).toEqual([g.none.crushMin, g.none.missed]);
      expect([withPlan.crushMin, withPlan.missed]).toEqual([g.zeroRupees.crushMin, g.zeroRupees.missed]);
    }
  });
});

describe('new options keep default behaviour', () => {
  it('acceptOverride absent → identical; present → replaces p', () => {
    const iv = [{ type: 'nudge' as const, cohort: 'nerul_rail', ask: 'reroute' as const, rupees: 0 }];
    const a = simulate(dyPatil, iv, { waits, lite: true });
    const b = simulate(dyPatil, iv, { waits, lite: true, acceptOverride: {} });
    expect(b.crushMin).toBe(a.crushMin);
    const c = simulate(dyPatil, iv, { waits, lite: true, acceptOverride: { nerul_rail: 0.9 } });
    close(c.nudgeInfo[0].p, 0.9);
    expect(c.nudgeInfo[0].fromRoom).toBe(true);
    expect(c.nudgeInfo[0].accepted).toBe(Math.round(24000 * 0.9));
  });
  it('is deterministic', () => {
    const a = simulate(dyPatil, [], { waits, lite: true });
    const b = simulate(dyPatil, [], { waits, lite: true });
    expect(a.maxDenSeries).toEqual(b.maxDenSeries);
  });
  it('one evening simulates fast', () => {
    const t0 = performance.now();
    for (let i = 0; i < 10; i++) simulate(dyPatil, [], { waits });
    const ms = (performance.now() - t0) / 10;
    expect(ms).toBeLessThan(60);
  });
});
