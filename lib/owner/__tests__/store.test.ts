/*
 * These pin down a real bug caught by live browser verification during this slice's build (see
 * docs/DECISIONS.md): the first version of buildFallbackArrivalRows() split arrivals proportional
 * to each gate's OWN lane count, which meant cutting a gate's lanes also cut its assigned crowd —
 * the two effects cancelled and the risk readout never moved. These tests would have caught it.
 */
import { describe, expect, it } from 'vitest';
import { loadScenarioFromRows, simulate } from '@/engine';
import { sampleOwnerVenue } from '../types';
import { applyDocumentValue, buildCsvInput, buildFallbackArrivalRows, docCheckOwnerValues, gatePeoplePerMin, totalGateLanes, totalParkingSpaces } from '../store';

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

describe('applyDocumentValue — Slice 4 safety-document check', () => {
  it('sets capacity/exits directly, tagged document-checked', () => {
    const v = sampleOwnerVenue();
    const nv = applyDocumentValue(v, 'capacity', 45000);
    expect(nv.capacity).toEqual({ value: 45000, trust: 'document-checked' });
    const nv2 = applyDocumentValue(v, 'exits', 12);
    expect(nv2.exits).toEqual({ value: 12, trust: 'document-checked' });
  });

  it('a real bug this slice\'s own live verification caught: redistributing gate lanes must land EXACTLY on the document\'s total, not 1 short from independent rounding', () => {
    const v = sampleOwnerVenue(); // gates: 6, 4, 3 = 13 lanes
    expect(totalGateLanes(v)).toBe(13);
    const nv = applyDocumentValue(v, 'gateLanes', 14); // the sample safety-doc's own claimed figure
    expect(totalGateLanes(nv)).toBe(14); // NOT 13 — independently rounding 6*14/13, 4*14/13, 3*14/13 each floors back to 6,4,3
    expect(nv.gates.every((g) => g.lanes.trust === 'document-checked')).toBe(true);
    // re-checking against the venue's own screen now reads a match, not a mismatch
    expect(docCheckOwnerValues(nv).gateLanes).toBe(14);
  });

  it('same exact-total guarantee for parking spaces, across an arbitrary number of lots', () => {
    const v = sampleOwnerVenue();
    const withThreeLots = { ...v, parking: [...v.parking, { id: 'P2', name: 'South lot', capacityVehicles: { value: 250, trust: 'claimed' as const }, areaM2: { value: 4000, trust: 'claimed' as const } }, { id: 'P3', name: 'East lot', capacityVehicles: { value: 90, trust: 'claimed' as const }, areaM2: { value: 1500, trust: 'claimed' as const } }] };
    expect(totalParkingSpaces(withThreeLots)).toBe(940);
    const nv = applyDocumentValue(withThreeLots, 'parkingSpaces', 550); // the sample safety-doc's own claimed figure
    expect(totalParkingSpaces(nv)).toBe(550);
  });

  it('handles a zero-total edge case (every row currently 0) by splitting evenly, still summing exactly', () => {
    const v = sampleOwnerVenue();
    const zeroed = { ...v, gates: v.gates.map((g) => ({ ...g, lanes: { ...g.lanes, value: 0 } })) };
    const nv = applyDocumentValue(zeroed, 'gateLanes', 10);
    expect(totalGateLanes(nv)).toBe(10);
  });
});
