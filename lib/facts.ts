/*
 * Plain-language facts about a scenario and its evenings. Every figure is computed from the
 * scenario data or a SimResult — nothing here is typed in by hand.
 */
import { arrivalCurve, CRUSH, JAM, type Scenario, type SimResult } from '@/engine';

export function gateLoads(scn: Scenario) {
  const out: Record<string, number> = {};
  for (const c of scn.cohorts) {
    const l = scn.links.find((x) => x.id === c.path[c.path.length - 2]);
    if (l?.gate) out[l.gate] = (out[l.gate] || 0) + c.size;
  }
  return out;
}

export function scenarioFacts(scn: Scenario) {
  const venue = scn.zones.find((z) => z.type === 'venue')!;
  const hotels = scn.zones.filter((z) => z.type === 'hotel');
  const rooms = hotels.reduce((a, h) => a + (h.rooms || 0), 0);
  const emptyFar = hotels.filter((h) => h.rooms && (h.rooms - (h.occupied || 0)) / h.rooms > 0.35);
  const fullNear = hotels.filter((h) => h.rooms && (h.occupied || 0) / h.rooms >= 0.9);
  const freeFar = emptyFar.reduce((a, h) => a + (h.rooms! - (h.occupied || 0)), 0);
  const gates = scn.zones.filter((z) => z.type === 'gate');
  const lanes = gates.reduce((a, g) => a + (g.lanes || 0), 0);
  const rail = scn.cohorts.filter((c) => c.pulse);
  // biggest single burst: the busiest pulse window of the biggest pulsed cohort
  let burst = 0,
    burstEvery = 0,
    burstLink = '';
  for (const c of rail) {
    const curve = arrivalCurve(c.mean, c.std, scn.horizon, c.pulse);
    let best = 0;
    for (let t0 = 0; t0 < scn.horizon; t0 += c.pulse!.period) {
      let s = 0;
      for (let k = 0; k < c.pulse!.period && t0 + k < scn.horizon; k++) s += curve[t0 + k];
      best = Math.max(best, s);
    }
    if (best * c.size > burst) {
      burst = best * c.size;
      burstEvery = c.pulse!.period;
      burstLink = c.path[0];
    }
  }
  const loads = gateLoads(scn);
  const gateRank = Object.keys(loads).sort((a, b) => loads[b] - loads[a]);
  return {
    capacity: venue.capacity || 0,
    venueName: scn.venueLabel,
    hotels,
    rooms,
    freeFar,
    emptyFar,
    fullNear,
    lateBookings: scn.lateBookings,
    gates,
    lanes,
    throughput: lanes * scn.laneRate,
    railPeople: rail.reduce((a, c) => a + c.size, 0),
    railCohorts: rail,
    burst: Math.round(burst / 100) * 100,
    burstEvery,
    burstLink: scn.links.find((l) => l.id === burstLink),
    loads,
    busiestGate: gates.find((g) => g.id === gateRank[0]),
    quietestGate: gates.find((g) => g.id === gateRank[gateRank.length - 1]),
    roads: scn.links.filter((l) => l.mode === 'road').length,
  };
}

/** the causal chain behind the worst place, read out of the do-nothing frames */
export function causalChain(scn: Scenario, base: SimResult) {
  const wz = base.worst.zone;
  if (wz < 0) return null;
  const zone = scn.zones[wz];
  const gateLink = scn.links.find((l) => l.from === zone.id && l.mode === 'gate');
  const gate = gateLink ? scn.zones.find((z) => z.id === gateLink.gate) : undefined;
  const gateRate = gate ? (gate.lanes || 0) * scn.laneRate : 0;
  // inflow into the worst zone over the 30 minutes before it first fills
  let firstFull = -1,
    firstCrush = -1,
    crushRun = 0;
  for (let t = 0; t < scn.horizon; t++) {
    const d = base.frames[t].zoneDen[wz];
    if (firstCrush < 0 && d >= CRUSH) firstCrush = t;
    if (firstFull < 0 && d >= JAM * 0.98) firstFull = t;
    if (d >= CRUSH) crushRun++;
  }
  const t1 = firstFull > 0 ? firstFull : base.worst.tick;
  const inIdx = scn.links.map((l, i) => (l.to === zone.id ? i : -1)).filter((i) => i >= 0);
  let inflow = 0;
  const from = Math.max(0, t1 - 30);
  for (let t = from; t < t1; t++) for (const i of inIdx) inflow += base.frames[t].linkFlow[i];
  inflow = inflow / Math.max(1, t1 - from);
  // where the overflow backs up to
  let heldLink = -1,
    heldDen = 0;
  for (const i of inIdx) {
    const d = base.peakLinkDen[i];
    if (d > heldDen) {
      heldDen = d;
      heldLink = i;
    }
  }
  return {
    zone,
    gate,
    gateRate,
    inflow: Math.round(inflow),
    extra: Math.max(0, Math.round(inflow - gateRate)),
    firstCrush,
    firstFull,
    fullPeople: Math.round((zone.areaM2 || 0) * JAM),
    crushRun,
    heldLink: heldLink >= 0 ? scn.links[heldLink] : null,
    heldDen,
  };
}
