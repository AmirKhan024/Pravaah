/*
 * Incident replay: Bengaluru, 4 June 2025 (SOURCE_OF_TRUTH §8.4).
 * Reconstruction from public reporting. Illustrative, not a finding of fact.
 * Checks that the scenario runs on the unchanged engine, is deterministic, and that the
 * do-nothing afternoon is dangerous where and when the public reports say it was.
 */
import { describe, expect, it } from 'vitest';
import {
  autoCandidates,
  CRUSH,
  clockFor,
  comma,
  inr,
  optimise,
  PROFILES,
  probeWaits,
  runEnsemble,
  simulate,
  trendWarning,
  type ProfileName,
} from '../index';
import { bengaluru2025 as scn, bengaluru2025Meta as meta } from '../scenarios/bengaluru2025';

const toTick = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m - scn.t0Min;
};
// Reported window during which people were pressed together at the gates: 15:30–17:30 [source 1].
const CRUSH_FROM = toTick('15:30');
const CRUSH_TO = toTick('17:30');
const SLACK = 30;

const waits = probeWaits(scn);
const base = simulate(scn, [], { waits });
const watch = scn.zones.findIndex((z) => z.id === meta.watchZone);
const clock = (t: number) => clockFor(scn, t);

describe('Bengaluru 2025 reconstruction', () => {
  it('has a well-formed scenario and meta', () => {
    expect(scn.id).toBe('bengaluru2025');
    expect(watch).toBeGreaterThanOrEqual(0);
    expect(meta.label).toBe('Reconstruction from public reporting. Illustrative, not a finding of fact.');
    const ns = new Set(meta.sources.map((s) => s.n));
    for (const e of meta.timeline) expect(ns.has(e.source)).toBe(true);
    const zoneIds = new Set(scn.zones.map((z) => z.id));
    for (const l of scn.links) {
      expect(zoneIds.has(l.from)).toBe(true);
      expect(zoneIds.has(l.to)).toBe(true);
    }
    const linkIds = new Set(scn.links.map((l) => l.id));
    for (const c of scn.cohorts) for (const id of [...c.path, ...(c.alt || [])]) expect(linkIds.has(id)).toBe(true);
  });

  it('is deterministic', () => {
    const again = simulate(scn, [], { waits });
    expect(again.crushMin).toBe(base.crushMin);
    expect(Array.from(again.maxDenSeries)).toEqual(Array.from(base.maxDenSeries));
    expect(again.worst).toEqual(base.worst);
  });

  it('produces dangerous minutes inside the reported window', () => {
    expect(base.crushMin).toBeGreaterThan(0);
    expect(base.worst.tick).toBeGreaterThanOrEqual(CRUSH_FROM - SLACK);
    expect(base.worst.tick).toBeLessThanOrEqual(CRUSH_TO + SLACK);
    const total = scn.cohorts.reduce((s, c) => s + c.size, 0);
    const inside = base.frames[scn.horizon - 1].arrived;
    // the stands fill to roughly their seats and most people stay outside
    expect(inside).toBeLessThan(1.1 * scn.zones.find((z) => z.type === 'venue')!.capacity!);
    let first = -1;
    for (let t = 0; t < scn.horizon; t++)
      if (base.frames[t].zoneDen[watch] >= CRUSH) {
        first = t;
        break;
      }
    console.log(
      [
        `[bengaluru] baseline dangerous minutes: ${base.crushMin}`,
        `[bengaluru] worst: ${scn.zones[base.worst.zone].name} at ${clock(base.worst.tick)} (${base.worst.den.toFixed(2)} /m²)`,
        `[bengaluru] watch zone ${meta.watchZone} first ≥${CRUSH}/m² at ${first >= 0 ? clock(first) : 'never'}`,
        `[bengaluru] inside at ${clock(scn.horizon - 1)}: ${comma(inside)} of ${comma(total)}; outside: ${comma(total - inside)}; missed@show: ${comma(base.missed)}`,
        `[bengaluru] peak gate waits (min): ${Object.entries(base.gateWaitPeak)
          .map(([g, w]) => g + ' ' + w.toFixed(0))
          .join(', ')}`,
        `[bengaluru] peak zone densities: ${scn.zones
          .map((z, i) => (base.peakDen[i] > 0.5 ? `${z.id} ${base.peakDen[i].toFixed(1)}` : ''))
          .filter(Boolean)
          .join(', ')}`,
      ].join('\n'),
    );
  });

  it('shows when Pravaah would have warned', () => {
    let trendAt = -1,
      twoAt = -1;
    for (let t = 0; t < scn.horizon; t++) {
      if (trendAt < 0) {
        const w = trendWarning(scn, base, t);
        if (w && w.zone === meta.watchZone) trendAt = t;
      }
      if (twoAt < 0 && base.frames[t].zoneDen[watch] > 2.0) twoAt = t;
      if (trendAt >= 0 && twoAt >= 0) break;
    }
    expect(twoAt).toBeGreaterThanOrEqual(0);
    const warnAt = trendAt < 0 ? twoAt : Math.min(trendAt, twoAt);
    console.log(
      `[bengaluru] warning at watch zone: density > 2.0/m² at ${clock(twoAt)}; trend warning at ${trendAt >= 0 ? clock(trendAt) : 'never'}; earliest ${clock(warnAt)}`,
    );
  });

  it('ensemble on the watch zone', () => {
    const e = runEnsemble(scn, 60, watch);
    expect(e.n).toBe(60);
    expect(e.p).toBeGreaterThan(0.5);
    console.log(
      `[bengaluru] ensemble: p=${e.p.toFixed(2)} first crush p10 ${clock(e.tLo)} · p50 ${clock(e.tMed)} · p90 ${clock(e.tHi)}; median peak ${e.peakMed.toFixed(2)}/m²; median dangerous minutes ${e.crushMed}`,
    );
  });

  it('optimiser finds plans with autoCandidates', () => {
    const levers = autoCandidates(scn);
    expect(levers.length).toBeGreaterThan(0);
    const plans = (['Zero rupees', 'Balanced'] as ProfileName[]).map((name) => {
      const pf = PROFILES[name];
      const r = optimise(scn, { w: pf.w, depth: pf.depth, filter: pf.filter, waits, levers, liteResult: true });
      return { name, ...r };
    });
    for (const p of plans) {
      expect(p.result.crushMin).toBeLessThanOrEqual(base.crushMin);
      console.log(
        `[bengaluru] ${p.name}: dangerous minutes ${base.crushMin} → ${p.result.crushMin}, ${inr(p.result.rupees)}; levers: ${p.chosen.map((c) => c.label).join(' | ') || '(none)'}`,
      );
    }
    // cheapest plan removing most dangerous minutes
    const good = plans.filter((p) => base.crushMin - p.result.crushMin >= 0.5 * base.crushMin).sort((a, b) => a.result.rupees - b.result.rupees);
    const best = good[0] || plans.slice().sort((a, b) => a.result.crushMin - b.result.crushMin)[0];
    const bestFull = simulate(scn, best.chosen, { waits });
    console.log(
      `[bengaluru] cheapest effective plan (removes ≥50%: ${good.length ? 'yes' : 'no'}): ${best.name} — ${best.chosen.map((c) => c.label).join(' | ')} → ${best.result.crushMin} dangerous minutes, ${inr(best.result.rupees)}; people inside by ${clock(scn.horizon - 1)}: ${comma(bestFull.frames[scn.horizon - 1].arrived)} (seats 35,000)`,
    );
  });

  it('counterfactuals outside the lever set (scenario edits, same engine)', () => {
    // Gates open at the planned 13:45 instead of the 15:45 midpoint.
    const early = simulate({ ...scn, gatesOpenTick: toTick('13:45') }, [], { lite: true });
    // Entry by pass only: only as many people head for the gates as there are seats.
    const total = scn.cohorts.reduce((s, c) => s + c.size, 0);
    const k = 35000 / total;
    const passes = simulate({ ...scn, cohorts: scn.cohorts.map((c) => ({ ...c, size: Math.round(c.size * k) })) }, [], { lite: true });
    const both = simulate({ ...scn, gatesOpenTick: toTick('13:45'), cohorts: scn.cohorts.map((c) => ({ ...c, size: Math.round(c.size * k) })) }, [], { lite: true });
    expect(passes.crushMin).toBeLessThan(base.crushMin);
    console.log(
      `[bengaluru] counterfactual: gates at 13:45 → ${early.crushMin} dangerous minutes; crowd = seats (35,000) → ${passes.crushMin}; both → ${both.crushMin} (do-nothing ${base.crushMin})`,
    );
  });
});
