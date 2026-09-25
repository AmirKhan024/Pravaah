// Runs the ENGINE CODE of reference/prototype.html, unmodified, inside a Node VM
// and records its outputs to engine/__tests__/golden.json.
// This is the equivalent of "run the prototype in a browser console once" (SOURCE_OF_TRUTH §6.10),
// made repeatable. The DOM-bound parts of the prototype are sliced out; the engine is not touched.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'reference/prototype.html'), 'utf8');

const start = html.indexOf('/* ---------------- scenario ---------------- */');
const geomCut = html.indexOf('/* ---------------- geometry ---------------- */');
const intelStart = html.indexOf('/* ================= the intelligence layer');
const intelEnd = html.indexOf('/* ================= the five steps ================= */');
const whatIfStart = html.indexOf('/* ---------------- what-if ---------------- */');
const whatIfEnd = html.indexOf('function activeIvs(){');
if ([start, geomCut, intelStart, intelEnd, whatIfStart, whatIfEnd].some((i) => i < 0)) throw new Error('prototype markers not found');

const code =
  '"use strict";\n' +
  html.slice(start, geomCut) +
  html.slice(intelStart, intelEnd) +
  html.slice(whatIfStart, whatIfEnd) +
  `\nglobalThis.__P = { SCENARIO_A, SCENARIO_B, simulate, candidates, optimise, PROFILES, costOf, feasible,
     jitter, runEnsemble, runAblation, runConstraints, computeDecisionBoard, buildStressBatch,
     tracePerson, raviPath, RAVI, WHATIFS, applyWhatIf, fracRemaining, arrivalCurve, S,
     getBoard: () => DECISION_BOARD, setScenario: (s) => { SCENARIO = s; } };`;

const ctx = { console, setTimeout, Math, JSON, Float64Array, Float32Array, Array, Object, String, Number, Promise,
  el: () => null, engRows: () => {}, document: { getElementById: () => null } };
vm.createContext(ctx);
vm.runInContext(code, ctx);
const P = ctx.__P;

const r4 = (x) => Math.round(x * 1e6) / 1e6;
const arr = (a) => Array.from(a, r4);
const summary = (r) => ({
  crushMin: r.crushMin, missed: r.missed, waitHours: r4(r.waitHours), unhoused: r.unhoused, housed: r.housed,
  rupees: r.rupees, inconvenience: r.inconvenience, maxGateWait: r4(r.maxGateWait),
  peakDen: arr(r.peakDen), peakLinkDen: arr(r.peakLinkDen),
  gateWaitPeak: Object.fromEntries(Object.entries(r.gateWaitPeak).map(([k, v]) => [k, r4(v)])),
  foodWaitPeak: Object.fromEntries(Object.entries(r.foodWaitPeak).map(([k, v]) => [k, r4(v)])),
  worst: { zone: r.worst.zone, den: r4(r.worst.den), tick: r.worst.tick },
  maxDenSeries: arr(r.maxDenSeries), crushSeries: Array.from(r.crushSeries),
  nudgeInfo: r.nudgeInfo.map((n) => ({ ...n, p: r4(n.p) })),
});

const A = P.SCENARIO_A;
const probe = P.simulate(A, [], { lite: true });
const waits = { gate3: probe.gateWaitPeak.gate3, gate1: probe.gateWaitPeak.gate1, gate5: probe.gateWaitPeak.gate5 };
const base = P.simulate(A, [], { waits });
P.S.base = base; P.S.waits = waits;

const out = { generatedFrom: 'reference/prototype.html', waits: Object.fromEntries(Object.entries(waits).map(([k, v]) => [k, r4(v)])) };
out.probe = summary(probe);
out.base = summary(base);
out.baseFrames = [0, 150, 240, 290, 300, 310, 320, 330, 360, 539].map((t) => ({
  t, zoneOcc: arr(base.frames[t].zoneOcc), zoneDen: arr(base.frames[t].zoneDen), linkOcc: arr(base.frames[t].linkOcc),
  linkFlow: arr(base.frames[t].linkFlow), linkTT: arr(base.frames[t].linkTT), arrived: r4(base.frames[t].arrived), crush: base.frames[t].crush,
}));

const t0 = Date.now();
const plans = {};
for (const name of Object.keys(P.PROFILES)) {
  const pf = P.PROFILES[name];
  const p = await P.optimise(A, pf.w, waits, pf.depth, pf.filter);
  plans[name] = p;
  out.plans = out.plans || {};
  out.plans[name] = { chosen: p.chosen.map((c) => c.label), result: summary(p.result) };
}
console.log('optimiser ms', Date.now() - t0);
P.S.plans = plans;

out.ravi = {
  base: P.tracePerson(base, P.raviPath(base), P.RAVI.release),
  zeroRupees: P.tracePerson(plans['Zero rupees'].result, P.raviPath(plans['Zero rupees'].result), P.RAVI.release),
};
for (const k of Object.keys(out.ravi)) { const t = out.ravi[k]; t.worst = r4(t.worst); }

const fcWest = A.zones.findIndex((z) => z.id === 'fc_west');
const ens = await P.runEnsemble(60, fcWest);
out.ensemble = Object.fromEntries(Object.entries(ens).map(([k, v]) => [k, r4(v)]));
out.jitterSample = P.jitter(1000).cohorts.map((c) => ({ id: c.id, size: c.size, mean: r4(c.mean), std: r4(c.std), pulse: c.pulse || null }));

out.ablation = await P.runAblation();
out.constraints = await P.runConstraints();

await P.computeDecisionBoard();
out.decisionBoard = P.getBoard();

out.whatIfs = {};
for (const w of P.WHATIFS) {
  const { scn, opts } = P.applyWhatIf(w);
  const pr = P.simulate(scn, [], Object.assign({ lite: true }, opts));
  const ww = { gate3: pr.gateWaitPeak.gate3, gate1: pr.gateWaitPeak.gate1, gate5: pr.gateWaitPeak.gate5 };
  const none = P.simulate(scn, [], Object.assign({ waits: ww }, opts));
  const withPlan = P.simulate(scn, plans['Zero rupees'].chosen, Object.assign({ waits: ww }, opts));
  out.whatIfs[w.id] = { none: { crushMin: none.crushMin, missed: none.missed }, zeroRupees: { crushMin: withPlan.crushMin, missed: withPlan.missed } };
}

const lateDecision = P.simulate(A, [{ type: 'nudge', cohort: 'nerul_rail', ask: 'reroute', rupees: 0, decisionTick: 290 }, { type: 'house', decisionTick: 300 }, { type: 'stagger', cohort: 'kharghar_htl', delta: -30, decisionTick: 250 }], { lite: true, waits });
out.lateDecision = summary(lateDecision);

P.setScenario(P.SCENARIO_B);
const B = P.SCENARIO_B;
const bp = P.simulate(B, [], { lite: true });
out.scenarioB = summary(P.simulate(B, [], { waits: bp.gateWaitPeak }));

const dest = path.join(root, 'engine/__tests__/golden.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 1));
console.log('wrote', dest);
console.log('base crushMin', base.crushMin, 'missed', base.missed, 'maxGateWait', base.maxGateWait.toFixed(2));
for (const n of Object.keys(out.plans)) console.log(n, out.plans[n].result.crushMin, out.plans[n].result.rupees, out.plans[n].chosen);
console.log('ensemble', out.ensemble);
console.log('ablation', out.ablation.map((a) => a.name + ':' + a.removed));
console.log('board', JSON.stringify(out.decisionBoard.options.map((o) => [o.label, o.deadlineTick, o.useless])));
console.log('ravi', out.ravi.base.inside, out.ravi.base.waited, out.ravi.zeroRupees.inside, out.ravi.zeroRupees.waited);
console.log('whatifs', JSON.stringify(out.whatIfs));
