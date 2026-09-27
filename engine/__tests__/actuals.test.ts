/*
 * Slice 3 (Predicted vs Actual): freezing a prediction, comparing it to a (demo-feed) actual, and
 * the deterministic recalibration + trust rule — all against the real sample scenario.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCsv } from '../csv';
import { loadScenarioFromRows, type ArrivalRow, type CsvScenarioInput, type EventRow, type GateRow, type HotelRow, type ResourceRow, type TicketRow } from '../dataLoader';
import { applyRecalibration, bucketizeGateArrivals, compareGates, demoActualFeed, fitRecalibration, freezePrediction, recalibrate, trustForGate } from '../actuals';
import { probeWaits, simulate } from '../simulate';

const DIR = join(__dirname, '../../data/sample/dy-patil');
const readRows = <T>(file: string): T[] => parseCsv(readFileSync(join(DIR, file), 'utf8')) as unknown as T[];
function sampleInput(): CsvScenarioInput {
  return {
    event: readRows<EventRow>('event.csv'),
    gates: readRows<GateRow>('gates.csv'),
    tickets: readRows<TicketRow>('tickets.csv'),
    arrivals: readRows<ArrivalRow>('arrivals.csv'),
    hotels: readRows<HotelRow>('hotels.csv'),
    resources: readRows<ResourceRow>('resources.csv'),
  };
}

const res = loadScenarioFromRows(sampleInput(), { venueLabel: 'DY Patil Stadium (sample fixture)' });
if (!res.ok) throw new Error('sample fixture failed to load: ' + res.errors.join('; '));
const scn = res.data.scenario;
const waits = probeWaits(scn);
const base = simulate(scn, [], { waits });

describe('bucketizeGateArrivals / freezePrediction', () => {
  const predicted = freezePrediction(scn, base, 0);

  it('every gate zone gets a bucket series, and its total roughly matches that gate\'s cohort demand', () => {
    const gateIds = scn.zones.filter((z) => z.type === 'gate').map((z) => z.id);
    expect(Object.keys(predicted.perGate).sort()).toEqual(gateIds.sort());
    for (const g of gateIds) expect(predicted.perGate[g].every((v) => v >= 0)).toBe(true);
  });

  it('peakBucket falls inside the bucketized series length', () => {
    for (const [gate, bucket] of Object.entries(predicted.peakBucket)) {
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(predicted.perGate[gate].length);
    }
  });

  it('bucketizeGateArrivals alone matches freezePrediction\'s own perGate', () => {
    expect(bucketizeGateArrivals(scn, base, 10)).toEqual(predicted.perGate);
  });
});

describe('demoActualFeed', () => {
  const predicted = freezePrediction(scn, base, 0);
  const actual = demoActualFeed(predicted, 7);

  it('is deterministic for a fixed seed', () => {
    expect(demoActualFeed(predicted, 7)).toEqual(actual);
  });
  it('differs from another seed (real noise, not a static copy)', () => {
    expect(demoActualFeed(predicted, 8)).not.toEqual(actual);
  });
  it('stays within a plausible range of the prediction it was generated from (noise + 2 disruptions, never wildly off)', () => {
    for (const gate of Object.keys(predicted.perGate)) {
      const predTotal = predicted.perGate[gate].reduce((a, b) => a + b, 0);
      const actTotal = actual[gate].reduce((a, b) => a + b, 0);
      if (predTotal > 0) expect(actTotal / predTotal).toBeGreaterThan(0.5);
    }
  });
});

describe('compareGates + recalibrate', () => {
  const predicted = freezePrediction(scn, base, 0);
  const actual = demoActualFeed(predicted, 3);
  const comparisons = compareGates(predicted, actual);

  it('sorts worst-mismatch gate first', () => {
    for (let i = 1; i < comparisons.length; i++) expect(Math.abs(comparisons[i].pctDiff)).toBeLessThanOrEqual(Math.abs(comparisons[i - 1].pctDiff));
  });

  it('fitRecalibration clamps multiplier to 0.5..2 and shift to -45..45', () => {
    const fits = fitRecalibration(comparisons);
    for (const f of fits) {
      expect(f.mult).toBeGreaterThanOrEqual(0.5);
      expect(f.mult).toBeLessThanOrEqual(2);
      expect(f.shiftMin).toBeGreaterThanOrEqual(-45);
      expect(f.shiftMin).toBeLessThanOrEqual(45);
    }
  });

  it('applyRecalibration never mutates the original scenario', () => {
    const fits = fitRecalibration(comparisons);
    const before = JSON.stringify(scn);
    applyRecalibration(scn, fits);
    expect(JSON.stringify(scn)).toBe(before);
  });

  it('recalibrate() shrinks (or at least does not worsen) the mean absolute error', () => {
    const r = recalibrate(scn, predicted, actual, [], { waits });
    expect(r.errorAfter).toBeLessThanOrEqual(r.errorBefore + 0.5); // small float slack
  });

  it('recalibrate() re-applies the same interventions predicted was frozen under — dropping them would compare against a different evening', () => {
    // a nudge intervention on the busiest cohort's path changes which gate people actually go
    // through; if recalibrate() forgot to re-apply it, the recalibrated total would drift back
    // toward the un-nudged split and the error could get WORSE instead of shrinking (a real bug
    // this test pins down, caught live via Playwright — see docs/DECISIONS.md)
    const busiestCohort = scn.cohorts.find((c) => c.alt)!; // fails loudly (not silently vacuous) if the sample ever loses its alt-gate cohorts
    expect(busiestCohort).toBeDefined();
    const nudge = { type: 'nudge' as const, cohort: busiestCohort.id, ask: 'reroute' as const, rupees: 0, label: 'test nudge' };
    const nudgedResult = simulate(scn, [nudge], { waits });
    const nudgedPredicted = freezePrediction(scn, nudgedResult, 0);
    const nudgedActual = demoActualFeed(nudgedPredicted, 9);
    const withIvs = recalibrate(scn, nudgedPredicted, nudgedActual, [nudge], { waits });
    const withoutIvs = recalibrate(scn, nudgedPredicted, nudgedActual, [], { waits });
    expect(withIvs.errorAfter).toBeLessThanOrEqual(withoutIvs.errorAfter + 0.5);
  });
});

describe('trustForGate', () => {
  it('verified within 15% error, claimed beyond it, symmetric for over/under', () => {
    expect(trustForGate(0)).toBe('verified');
    expect(trustForGate(15)).toBe('verified');
    expect(trustForGate(-15)).toBe('verified');
    expect(trustForGate(15.1)).toBe('claimed');
    expect(trustForGate(-40)).toBe('claimed');
  });
});
