/*
 * "Any venue in 60 seconds" (§8.5): every cached venue must build, simulate deterministically,
 * and let the optimiser find plans that are never worse than doing nothing.
 */
import { describe, expect, it } from 'vitest';
import {
  buildVenueScenario,
  clockFor,
  optimiseProfile,
  overpassQuery,
  probeWaits,
  simulate,
  specFromOverpass,
  VENUES,
  type OverpassJson,
  type Scenario,
  type SimResult,
} from '../index';

const noNaN = (r: SimResult) => {
  for (const v of [r.crushMin, r.missed, r.waitHours, r.maxGateWait]) {
    expect(Number.isFinite(v)).toBe(true);
  }
};

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
  // every gate has exactly one screening link (simulate() assumes it)
  for (const g of scn.zones.filter((z) => z.type === 'gate')) expect(scn.links.filter((l) => l.gate === g.id).length).toBe(1);
  const venue = scn.zones.find((z) => z.type === 'venue')!;
  expect(scn.cohorts.reduce((a, c) => a + c.size, 0)).toBe(venue.capacity);
  for (const c of scn.cohorts) {
    for (const p of [c.path, c.alt, c.housed].filter(Boolean) as string[][]) {
      // contiguous, ends in the venue
      for (let k = 1; k < p.length; k++) expect(links.get(p[k])!.from).toBe(links.get(p[k - 1])!.to);
      expect(links.get(p[p.length - 1])!.to).toBe(venue.id);
    }
  }
}

describe('cached venues', () => {
  for (const v of VENUES) {
    it(v.name, () => {
      const scn = v.build();
      if (v.id === 'dyPatil') expect(scn.id).toBe('dyPatil');
      else {
        expect(scn.id).not.toBe('dyPatil');
        expect(scn.zones.filter((z) => z.type === 'gate' || z.type === 'plaza' || z.type === 'venue').every((z) => z.estimated)).toBe(true);
        expect(scn.links.every((l) => l.estimated)).toBe(true);
      }
      checkGraph(scn);

      const waits = probeWaits(scn);
      const t0 = performance.now();
      const base = simulate(scn, [], { waits });
      const ms = performance.now() - t0;
      noNaN(base);
      // determinism: same inputs → same evening
      const again = simulate(scn, [], { waits });
      expect(again.crushMin).toBe(base.crushMin);
      expect(again.missed).toBe(base.missed);
      expect(again.waitHours).toBe(base.waitHours);
      expect(again.maxGateWait).toBe(base.maxGateWait);
      expect(Array.from(again.maxDenSeries)).toEqual(Array.from(base.maxDenSeries));
      if (v.spec) expect(JSON.stringify(v.build())).toBe(JSON.stringify(scn));

      const lite = simulate(scn, [], { waits, lite: true });
      const t1 = performance.now();
      for (let i = 0; i < 5; i++) simulate(scn, [], { waits, lite: true });
      const liteMs = (performance.now() - t1) / 5;
      noNaN(lite);
      if (v.spec) expect(liteMs).toBeLessThan(30);

      const zero = optimiseProfile(scn, 'Zero rupees', waits);
      const bal = optimiseProfile(scn, 'Balanced', waits);
      noNaN(zero.result);
      noNaN(bal.result);
      expect(zero.result.crushMin).toBeLessThanOrEqual(base.crushMin);
      expect(bal.result.crushMin).toBeLessThanOrEqual(base.crushMin);

      const w = base.worst;
      const worstName = w.zone >= 0 ? scn.zones[w.zone].name : '—';
      const gw = Object.entries(base.gateWaitPeak)
        .map(([g, m]) => scn.zones.find((z) => z.id === g)!.name + ' ' + Math.round(m) + 'm')
        .join(', ');
      console.log(
        `[${v.id}] zones ${scn.zones.length} links ${scn.links.length} cohorts ${scn.cohorts.length} · sim ${ms.toFixed(1)} ms (lite ${liteMs.toFixed(1)} ms)\n` +
          `  do-nothing: crushMin ${base.crushMin}, missed ${base.missed}, waitHours ${Math.round(base.waitHours)}, maxGateWait ${Math.round(base.maxGateWait)} min\n` +
          `  worst: ${worstName} ${w.den.toFixed(2)}/m² at ${clockFor(scn, w.tick)} · gate waits: ${gw}\n` +
          `  Zero rupees → crushMin ${zero.result.crushMin}, missed ${zero.result.missed}: ${zero.chosen.map((c) => c.label).join(' | ') || '(nothing)'}\n` +
          `  Balanced → crushMin ${bal.result.crushMin}, missed ${bal.result.missed}, ₹${bal.result.rupees}: ${bal.chosen.map((c) => c.label).join(' | ') || '(nothing)'}`,
      );
    });
  }
});

describe('specFromOverpass', () => {
  const center = { lat: 19.0, lng: 73.0 };
  const meta = { name: 'Test Ground', city: 'Pune', capacity: 20000, center, t0Min: 840, gatesOpenMin: 960, showMin: 1170 };
  const fixture: OverpassJson = {
    elements: [
      { type: 'node', id: 1, lat: 19.006, lon: 73.001, tags: { railway: 'station', name: 'Test Junction', train: 'yes' } },
      { type: 'way', id: 2, center: { lat: 19.0061, lon: 73.0011 }, tags: { public_transport: 'station', name: 'Test Junction' } },
      { type: 'node', id: 3, lat: 18.995, lon: 73.004, tags: { railway: 'station', station: 'subway', name: 'Test Metro' } },
      { type: 'node', id: 4, lat: 19.002, lon: 72.994, tags: { amenity: 'bus_station', name: 'Test Bus Depot' } },
      { type: 'way', id: 5, center: { lat: 18.998, lon: 73.006 }, tags: { amenity: 'parking', name: 'Ground Parking' } },
      { type: 'way', id: 6, center: { lat: 19.001, lon: 73.008 }, tags: { amenity: 'parking', access: 'private' } },
      { type: 'node', id: 7, lat: 19.004, lon: 73.003, tags: { tourism: 'hotel', name: 'Near Inn', rooms: '80' } },
      { type: 'node', id: 8, lat: 19.05, lon: 73.05, tags: { tourism: 'hotel', name: 'Far Lodge' } },
      { type: 'node', id: 9, lat: 19.0012, lon: 73.0, tags: { entrance: 'main', name: 'North Gate' } },
      { type: 'node', id: 10, lat: 18.9988, lon: 73.0, tags: { barrier: 'gate', ref: '4' } },
      { type: 'node', id: 11, lat: 19.0, lon: 73.0013, tags: { entrance: 'yes' } },
      { type: 'node', id: 12, lat: 19.0, lon: 72.9987, tags: { entrance: 'emergency' } },
    ],
  };

  it('converts stations, parking, hotels and entrances', () => {
    const spec = specFromOverpass(fixture, meta);
    expect(spec.id).toBe('osm_test_ground');
    expect(spec.stations.map((s) => s.kind).sort()).toEqual(['bus', 'metro', 'rail']);
    expect(spec.stations.filter((s) => s.name === 'Test Junction').length).toBe(1);
    expect(spec.parking.map((p) => p.name)).toEqual(['Ground Parking']);
    expect(spec.hotels.find((h) => h.name === 'Near Inn')!.rooms).toBe(80);
    expect(spec.gates.length).toBe(3);
    expect(spec.gates.map((g) => g.name)).toContain('North Gate');
    expect(spec.gates.map((g) => g.name)).toContain('Gate 4');
    const scn = buildVenueScenario(spec);
    checkGraph(scn);
    const r = simulate(scn, [], { waits: probeWaits(scn) });
    noNaN(r);
  });

  it('synthesises gates on a ring when there are no entrances', () => {
    const spec = specFromOverpass({ elements: fixture.elements.filter((e) => !e.tags?.entrance && !e.tags?.barrier) }, meta);
    expect(spec.gates.length).toBeGreaterThanOrEqual(3);
    expect(spec.gates.every((g) => g.estimated)).toBe(true);
    expect(spec.notes!.some((n) => /No entrances/.test(n))).toBe(true);
    const scn = buildVenueScenario(spec);
    checkGraph(scn);
    noNaN(simulate(scn, [], { lite: true }));
  });

  it('builds a query string without fetching', () => {
    const q = overpassQuery(19, 73, 1500);
    expect(q).toContain('[out:json]');
    expect(q).toContain('"railway"="station"');
    expect(q).toContain('"tourism"="hotel"');
    expect(q).toContain('"barrier"="gate"');
    expect(q).toContain('around:1500,19,73');
  });

  it('never produces the flagship id', () => {
    const spec = specFromOverpass(fixture, { ...meta, id: 'dyPatil' });
    expect(buildVenueScenario(spec).id).not.toBe('dyPatil');
  });
});
