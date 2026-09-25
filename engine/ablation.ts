/*
 * EXPLAIN — remove one cause, re-run the evening, measure what disappears.
 * PROVE (rejected) — simulate the plausible-but-wrong fixes and publish their result.
 * Ports of runAblation()/runConstraints() in reference/prototype.html.
 */
import { peakPulseBurst } from './arrivals';
import { comma } from './format';
import { simulate } from './simulate';
import type { Intervention, Scenario, SimOptions, SimResult } from './types';

export interface AblationRow {
  name: string;
  detail: string;
  removed: number;
  left: number;
}
export interface RejectedRow {
  name: string;
  left: number;
  why: string;
  cost: number;
  ivs: Intervention[];
}

interface Test {
  name: string;
  detail: string;
  opts: SimOptions;
  ivs: Intervention[];
}

function gateLoads(scn: Scenario) {
  const out: Record<string, number> = {};
  for (const c of scn.cohorts) {
    const l = scn.links.find((x) => x.id === c.path[c.path.length - 2]);
    if (l?.gate) out[l.gate] = (out[l.gate] || 0) + c.size;
  }
  return out;
}

function pulseDetail(scn: Scenario): string {
  const b = peakPulseBurst(scn);
  return b ? `about ${comma(b.rounded)} people every ${b.every} minutes` : 'in bursts, not a steady stream';
}

function ablationTests(scn: Scenario, waits: Record<string, number>): Test[] {
  if (scn.id === 'dyPatil') {
    return [
      { name: 'How the 84,000 are routed to gates', detail: '47,000 sent to Gate 3, 14,000 to Gate 5', opts: { waits, forceDivert: { seawoods_rail: 1.0, taxi_drop: 0.45 } }, ivs: [] },
      { name: 'Screening capacity at Gate 3', detail: '12 lanes clearing 336 people a minute', opts: { waits }, ivs: [{ type: 'lanes', gate: 'gate3', n: 8, from: 230 }] },
      { name: '1,400 late bookings with no room nearby', detail: 'they cab in late, straight to Gate 3', opts: { waits }, ivs: [{ type: 'house' }] },
      // was hardcoded "about 900 people at a time" — this scenario's real peak burst is ~2,000
      // (see engine/arrivals.ts peakPulseBurst); read it live so it can never drift again.
      { name: 'Trains arriving in six-minute pulses', detail: pulseDetail(scn), opts: { waits, noPulse: true }, ivs: [] },
    ];
  }
  // generic venue: the same four questions, derived from the graph
  const loads = gateLoads(scn);
  const gates = Object.keys(loads).sort((a, b) => loads[b] - loads[a]);
  const busiest = gates[0];
  const name = (id: string) => scn.zones.find((z) => z.id === id)?.name || id;
  const fd: Record<string, number> = {};
  scn.cohorts.filter((c) => c.alt).forEach((c) => (fd[c.id] = 0.45));
  const tests: Test[] = [];
  if (Object.keys(fd).length)
    tests.push({ name: 'How people are routed to gates', detail: gates.map((g) => comma(loads[g]) + ' to ' + name(g)).join(', '), opts: { waits, forceDivert: fd }, ivs: [] });
  if (busiest)
    tests.push({ name: 'Screening capacity at ' + name(busiest), detail: (scn.zones.find((z) => z.id === busiest)?.lanes || 0) + ' lanes', opts: { waits }, ivs: [{ type: 'lanes', gate: busiest, n: 8, from: scn.gatesOpenTick }] });
  if (scn.cohorts.some((c) => c.housed) && scn.lateBookings)
    tests.push({ name: comma(scn.lateBookings) + ' late bookings with no room nearby', detail: 'they arrive late, by cab', opts: { waits }, ivs: [{ type: 'house' }] });
  if (scn.cohorts.some((c) => c.pulse)) tests.push({ name: 'Trains arriving in pulses', detail: pulseDetail(scn), opts: { waits, noPulse: true }, ivs: [] });
  return tests;
}

export function runAblation(scn: Scenario, base: SimResult, waits: Record<string, number>): AblationRow[] {
  const B = base.crushMin;
  const out = ablationTests(scn, waits).map((t) => {
    const r = simulate(scn, t.ivs, { ...t.opts, lite: true });
    return { name: t.name, detail: t.detail, removed: B - r.crushMin, left: r.crushMin };
  });
  out.sort((a, b) => b.removed - a.removed);
  return out;
}

export function runRejected(scn: Scenario, waits: Record<string, number>): RejectedRow[] {
  let tests: { name: string; ivs: Intervention[]; why: string }[];
  if (scn.id === 'dyPatil') {
    tests = [
      { name: 'Open 8 more lanes at Gate 5', ivs: [{ type: 'lanes', gate: 'gate5', n: 8, from: 230 }], why: 'Gate 5 is already empty. More lanes do not help, because nobody is walking there.' },
      { name: 'Run 14 shuttles on the east corridor', ivs: [{ type: 'shuttle', link: 'L15', add: 260, vehicles: 14, from: 230 }], why: 'That road is already free. Making it bigger changes nothing while everyone still walks west.' },
      { name: 'Open 8 more lanes at Gate 1', ivs: [{ type: 'lanes', gate: 'gate1', n: 8, from: 230 }], why: 'Gate 1 handles its 23,000 people easily. This is not where the problem is.' },
    ];
  } else {
    const loads = gateLoads(scn);
    const gates = Object.keys(loads).sort((a, b) => loads[a] - loads[b]);
    const name = (id: string) => scn.zones.find((z) => z.id === id)?.name || id;
    tests = gates.slice(0, Math.max(1, gates.length - 1)).map((g) => ({
      name: 'Open 8 more lanes at ' + name(g),
      ivs: [{ type: 'lanes', gate: g, n: 8, from: scn.gatesOpenTick } as Intervention],
      why: name(g) + ' only gets ' + comma(loads[g]) + ' people. Adding lanes where nobody queues changes nothing.',
    }));
  }
  return tests.map((t) => {
    const r = simulate(scn, t.ivs, { waits, lite: true });
    return { name: t.name, left: r.crushMin, why: t.why, cost: r.rupees, ivs: t.ivs };
  });
}
