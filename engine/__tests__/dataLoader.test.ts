/*
 * Loader tests: the sample DY Patil CSVs (data/sample/dy-patil/*.csv) must load into a valid,
 * simulate()-able Scenario, and bad rows must produce plain-language errors, not exceptions.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCsv } from '../csv';
import {
  computeConfidence,
  loadScenarioFromRows,
  validateCsvInput,
  type ArrivalRow,
  type CsvScenarioInput,
  type EventRow,
  type GateRow,
  type HotelRow,
  type ResourceRow,
  type TicketRow,
} from '../dataLoader';
import { autoCandidates } from '../interventions';
import { simulate } from '../simulate';
import type { Scenario } from '../types';

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

function checkGraph(scn: Scenario) {
  const zones = new Set(scn.zones.map((z) => z.id));
  const links = new Map(scn.links.map((l) => [l.id, l]));
  expect(zones.size).toBe(scn.zones.length);
  expect(links.size).toBe(scn.links.length);
  for (const l of scn.links) {
    expect(zones.has(l.from) && zones.has(l.to)).toBe(true);
    if (l.mode === 'gate') expect(zones.has(l.gate!)).toBe(true);
    else expect(l.cap! > 0 && l.ff! >= 1).toBe(true);
  }
  for (const g of scn.zones.filter((z) => z.type === 'gate')) expect(scn.links.filter((l) => l.gate === g.id).length).toBe(1);
  const venue = scn.zones.find((z) => z.type === 'venue')!;
  expect(scn.cohorts.reduce((a, c) => a + c.size, 0)).toBe(venue.capacity);
  for (const c of scn.cohorts) {
    for (const p of [c.path, c.alt].filter(Boolean) as string[][]) {
      for (let k = 1; k < p.length; k++) expect(links.get(p[k])!.from).toBe(links.get(p[k - 1])!.to);
      expect(links.get(p[p.length - 1])!.to).toBe(venue.id);
    }
  }
}

describe('CSV loader — sample DY Patil event', () => {
  it('validates clean', () => {
    expect(validateCsvInput(sampleInput())).toEqual([]);
  });

  it('builds a valid, simulate()-able scenario', () => {
    const res = loadScenarioFromRows(sampleInput(), { venueLabel: 'DY Patil Stadium' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    checkGraph(res.data.scenario);
    const sim = simulate(res.data.scenario);
    expect(Number.isFinite(sim.crushMin)).toBe(true);
    expect(sim.frames.length).toBeGreaterThan(0);
  });

  it('tags every row and computes a confidence level', () => {
    const res = loadScenarioFromRows(sampleInput());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.fields.length).toBe(1 + 5 + 30 + 10 + 20 + 7); // event+gates+tickets+arrivals+hotels+resources rows = 73
    const conf = computeConfidence(res.data.fields);
    expect(conf.total).toBe(res.data.fields.length);
    expect(conf.invented).toBeGreaterThan(0);
    expect(['low', 'medium', 'high']).toContain(conf.level);
  });

  it('the tuned sample actually breaks at the West gate, and a data-derived redirect helps', () => {
    const res = loadScenarioFromRows(sampleInput(), { venueLabel: 'DY Patil Stadium' });
    if (!res.ok) throw new Error('load failed');
    const scn = res.data.scenario;
    const base = simulate(scn);
    expect(base.crushMin).toBeGreaterThan(0); // Step 5: never manufacture a problem, but a tuned sample must show one

    const nerul = scn.cohorts.find((c) => c.label === 'Nerul rail')!;
    const redirect = autoCandidates(scn).find((c) => c.type === 'nudge' && c.cohort === nerul.id && c.rupees === 0)!;
    expect(redirect.label.toLowerCase()).toContain('gate 2'); // gates.csv alt_gates for G3 is "G2;G1" — never Gate 5
    const withRedirect = simulate(scn, [redirect]);
    expect(withRedirect.crushMin).toBeLessThan(base.crushMin);
  });

  it('respects alt_gates for redirects (West gate → Gate 2 or Gate 1, never itself)', () => {
    const res = loadScenarioFromRows(sampleInput());
    if (!res.ok) throw new Error('load failed');
    const westCohort = res.data.scenario.cohorts.find((c) => c.label.includes('Nerul'))!;
    expect(westCohort.alt).toBeTruthy();
    const altGateLink = res.data.scenario.links.find((l) => l.id === westCohort.alt![westCohort.alt!.length - 2]);
    const altGateName = res.data.scenario.zones.find((z) => z.id === altGateLink!.gate)!.name;
    expect(['Gate 2', 'Gate 1']).toContain(altGateName);
  });

  it('rejects a gate referenced in arrivals.csv but missing from gates.csv, with a plain message', () => {
    const input = sampleInput();
    input.arrivals = input.arrivals.map((a, i) => (i === 0 ? { ...a, ticket_gate: 'G7' } : a));
    const errors = validateCsvInput(input);
    expect(errors.some((e) => e === 'Gate G7 in arrivals.csv is not in gates.csv.')).toBe(true);
  });

  it('rejects mismatched ticket totals', () => {
    const input = sampleInput();
    input.arrivals = input.arrivals.map((a) => (a.group === 'Nerul rail' ? { ...a, size: '500' } : a));
    const errors = validateCsvInput(input);
    expect(errors.some((e) => e.includes('Gate G3') && e.includes("doesn't match"))).toBe(true);
  });

  it('rebuilds smaller cohorts at an earlier snapshot (T-90)', () => {
    const t1 = loadScenarioFromRows(sampleInput(), { snapshot: 'T-1' });
    const t90 = loadScenarioFromRows(sampleInput(), { snapshot: 'T-90' });
    if (!t1.ok || !t90.ok) throw new Error('load failed');
    const totalAt = (r: typeof t1) => (r.ok ? r.data.scenario.cohorts.reduce((a, c) => a + c.size, 0) : 0);
    expect(totalAt(t90)).toBeLessThan(totalAt(t1));
  });
});
