/*
 * These pin down a real bug caught by live browser verification during this slice's build (see
 * docs/DECISIONS.md): the first version of buildFallbackArrivalRows() split arrivals proportional
 * to each gate's OWN lane count, which meant cutting a gate's lanes also cut its assigned crowd —
 * the two effects cancelled and the risk readout never moved. These tests would have caught it.
 */
import { describe, expect, it } from 'vitest';
import { loadScenarioFromRows, simulate } from '@/engine';
import { sampleOwnerVenue } from '../types';
import { buildCsvInput, buildFallbackArrivalRows, gatePeoplePerMin } from '../store';

function crushMinFor(venue: ReturnType<typeof sampleOwnerVenue>): number {
  const input = buildCsvInput(venue, buildFallbackArrivalRows(venue));
  const res = loadScenarioFromRows(input, { venueLabel: venue.name });
  if (!res.ok) throw new Error(res.errors.join(' '));
  return simulate(res.data.scenario, [], { lite: true }).crushMin;
}

describe('buildFallbackArrivalRows — the no-registrations-yet placeholder', () => {
  it('splits evenly by gate COUNT, not by each gate\'s own lane share', () => {
    const v = sampleOwnerVenue(); // gates have 6, 4, 3 lanes — a lane-share split would NOT be even
    const rows = buildFallbackArrivalRows(v);
    const sizes = rows.map((r) => Number(r.size));
    expect(new Set(sizes).size).toBe(1); // every gate gets the same placeholder crowd
  });

  it('cutting a gate down to one lane makes the evening measurably more dangerous, never less', () => {
    const v = sampleOwnerVenue();
    const base = crushMinFor(v);
    expect(base).toBe(0); // the sample venue's defaults are meant to read Calm, not manufacture a crisis
    for (let i = 0; i < v.gates.length; i++) {
      const cut = { ...v, gates: v.gates.map((g, k) => (k === i ? { ...g, lanes: { ...g.lanes, value: 1 } } : g)) };
      expect(crushMinFor(cut)).toBeGreaterThanOrEqual(base);
    }
    // Gate 3 (fewest lanes, smallest forecourt already) crosses into real danger once cut further
    const g3cut = { ...v, gates: v.gates.map((g, k) => (k === 2 ? { ...g, lanes: { ...g.lanes, value: 1 } } : g)) };
    expect(crushMinFor(g3cut)).toBeGreaterThan(0);
  });
});

describe('gatePeoplePerMin', () => {
  it('is lanes × the engine\'s one global lane-rate (28)', () => {
    const g = sampleOwnerVenue().gates[0];
    expect(gatePeoplePerMin(g)).toBe(g.lanes.value * 28);
  });
});
