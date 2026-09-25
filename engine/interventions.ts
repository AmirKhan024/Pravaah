/*
 * Candidate levers, feasibility, cost — ported from candidates()/feasible()/costOf()/PROFILES
 * in reference/prototype.html. For DY Patil the lever list is the prototype's exactly.
 * Other venues get an auto-built lever list from their graph (autoCandidates).
 */
import { MAX_FOOD_STALLS_ZONE, MAX_LANES_GATE, MAX_LANES_TOTAL } from './constants';
import { clockFor, comma, inr } from './format';
import type { Intervention, Scenario, SimResult } from './types';

export type Lever = Intervention & { label: string };

export function candidates(scn: Scenario): Lever[] {
  if (scn.id !== 'dyPatil') return autoCandidates(scn);
  const clock = (t: number) => clockFor(scn, t);
  const C: Lever[] = [];
  for (const from of [200, 260])
    for (const n of [4, 8]) C.push({ type: 'lanes', gate: 'gate3', n, from, label: 'Open ' + n + ' more screening lanes at Gate 3 from ' + clock(from) });
  for (const from of [230])
    for (const n of [4, 6]) C.push({ type: 'lanes', gate: 'gate5', n, from, label: 'Open ' + n + ' more screening lanes at Gate 5 from ' + clock(from) });
  C.push({ type: 'lanes', gate: 'gate1', n: 4, from: 240, label: 'Open 4 more screening lanes at Gate 1 from 18:00' });
  for (const r of [0, 100, 250])
    C.push({ type: 'nudge', cohort: 'nerul_rail', ask: 'reroute', rupees: r, label: r ? 'Offer ₹' + r + ' to Nerul arrivals to walk to Gate 5' : 'Tell Nerul arrivals that Gate 5 is empty' });
  for (const r of [0, 200])
    C.push({ type: 'nudge', cohort: 'seawoods_rail', ask: 'reroute', rupees: r, label: r ? 'Offer ₹' + r + ' to Seawoods arrivals to use Gate 5' : 'Tell Seawoods arrivals that Gate 5 is empty' });
  for (const r of [0, 200])
    C.push({ type: 'nudge', cohort: 'taxi_drop', ask: 'reroute', rupees: r, label: r ? 'Offer ₹' + r + ' to cab arrivals to use Gate 5' : 'Tell cab arrivals that Gate 5 is empty' });
  for (const r of [150])
    C.push({ type: 'nudge', cohort: 'nerul_rail', ask: 'shift', delta: -45, rupees: r, label: 'Offer ₹' + r + ' to Nerul arrivals to come 45 minutes earlier' });
  C.push({ type: 'stagger', cohort: 'self_drive', delta: -40, label: 'Move self-drive parking entry 40 minutes earlier' });
  C.push({ type: 'stagger', cohort: 'kharghar_htl', delta: -30, label: 'Send Kharghar hotel coaches 30 minutes earlier' });
  C.push({ type: 'house', label: 'Block-book the empty Kharghar and Panvel rooms for the 1,400 late bookings' });
  C.push({ type: 'shuttle', link: 'L15', add: 260, vehicles: 14, from: 230, label: 'Run 14 shuttles on the east service road' });
  C.push({ type: 'shuttle', link: 'L16', add: 220, vehicles: 8, from: 230, label: 'Open the perimeter path with 8 marshalled shuttles' });
  C.push({ type: 'food', zone: 'food_east', n: 2, from: 270, label: 'Open 2 more food stalls at the East forecourt from ' + clock(270) });
  return C;
}

const gateOfPath = (scn: Scenario, pth: string[]) => {
  const l = scn.links.find((x) => x.id === pth[pth.length - 2]);
  return l ? l.gate : undefined;
};
const zoneName = (scn: Scenario, id?: string) => scn.zones.find((z) => z.id === id)?.name || id || '';

/** Levers derived from any venue graph: lanes at each gate, reroute messages, earlier coaches, rooms. */
export function autoCandidates(scn: Scenario): Lever[] {
  const clock = (t: number) => clockFor(scn, t);
  const C: Lever[] = [];
  const gates = scn.zones.filter((z) => z.type === 'gate');
  const early = Math.max(scn.gatesOpenTick, scn.showStartTick - 130);
  const mid = Math.max(scn.gatesOpenTick, scn.showStartTick - 70);
  for (const g of gates)
    for (const from of [early, mid])
      for (const n of [4, 8]) C.push({ type: 'lanes', gate: g.id, n, from, label: `Open ${n} more screening lanes at ${g.name} from ${clock(from)}` });
  for (const c of scn.cohorts) {
    if (c.alt) {
      const to = zoneName(scn, gateOfPath(scn, c.alt));
      C.push({ type: 'nudge', cohort: c.id, ask: 'reroute', rupees: 0, label: `Tell ${c.label} that ${to} is quieter` });
      C.push({ type: 'nudge', cohort: c.id, ask: 'reroute', rupees: 100, label: `Offer ₹100 to ${c.label} to use ${to}` });
    }
    if (!c.pulse && !c.housed) C.push({ type: 'stagger', cohort: c.id, delta: -30, label: `Bring ${c.label} in 30 minutes earlier` });
  }
  if (scn.cohorts.some((c) => c.housed) && scn.lateBookings > 0)
    C.push({ type: 'house', label: `Block-book empty far rooms for the ${comma(scn.lateBookings)} late bookings` });
  for (const f of scn.zones.filter((z) => z.type === 'food'))
    C.push({ type: 'food', zone: f.id, n: 2, from: mid, label: `Open 2 more stalls at ${f.name} from ${clock(mid)}` });
  return C;
}

export function feasible(list: Intervention[]): boolean {
  const per: Record<string, number> = {};
  let tot = 0;
  const seen: Record<string, 1> = {};
  const foodPer: Record<string, number> = {};
  for (const iv of list) {
    if (iv.type === 'lanes') {
      per[iv.gate] = (per[iv.gate] || 0) + iv.n;
      tot += iv.n;
      if (per[iv.gate] > MAX_LANES_GATE) return false;
    }
    if (iv.type === 'nudge') {
      if (seen[iv.cohort]) return false;
      seen[iv.cohort] = 1;
    }
    if (iv.type === 'food') {
      foodPer[iv.zone] = (foodPer[iv.zone] || 0) + iv.n;
      if (foodPer[iv.zone] > MAX_FOOD_STALLS_ZONE) return false;
    }
  }
  return tot <= MAX_LANES_TOTAL;
}

export type Weights = [number, number, number, number, number, number?];

export function costOf(r: Pick<SimResult, 'crushMin' | 'waitHours' | 'missed' | 'rupees' | 'inconvenience' | 'unhoused'>, w: Weights): number {
  return (
    w[0] * r.crushMin + w[1] * (r.waitHours / 100) + w[2] * (r.missed / 1000) + w[3] * (r.rupees / 10000) + w[4] * (r.inconvenience / 10000) + (w[5] || 0) * (r.unhoused / 100)
  );
}

export interface Profile {
  w: Weights;
  depth: number;
  filter?: (c: Lever) => boolean;
  sub: string;
}
export type ProfileName = 'Zero rupees' | 'Balanced' | 'Safest';
export const PROFILE_NAMES: ProfileName[] = ['Zero rupees', 'Balanced', 'Safest'];
export const PROFILES: Record<ProfileName, Profile> = {
  'Zero rupees': {
    w: [1.0, 0.4, 0.6, 0.0, 0.1, 0.5],
    depth: 4,
    filter: (c) => (c.type === 'nudge' && c.rupees === 0) || c.type === 'stagger',
    sub: 'Only the moves that cost nothing at all',
  },
  Balanced: { w: [0.8, 0.5, 0.7, 0.45, 0.1, 1.2], depth: 4, sub: 'Clear the risk without overspending' },
  Safest: { w: [1.0, 0.55, 0.9, 0.04, 0.05, 2.0], depth: 7, sub: 'Buy every minute of safety on offer' },
};

/** Plain-language worth of one lever inside a simulated plan. Numbers come from the plan's SimResult. */
export function leverWorth(scn: Scenario, c: Intervention, result: SimResult): string {
  if (c.type === 'lanes') return 'lets ' + c.n * scn.laneRate + ' more people through per minute · ' + inr(c.n * 1400 * 5) + ' in staff pay';
  if (c.type === 'nudge') {
    const n = result.nudgeInfo.find((x) => x.cohort === c.cohort);
    if (!n) return '';
    const size = scn.cohorts.find((x) => x.id === c.cohort)!.size;
    return comma(n.accepted) + ' of ' + comma(size) + ' people follow it (' + Math.round(n.p * 100) + '%) · each saves ' + n.saved + ' min · ' + (n.rupees ? inr(n.accepted * n.rupees) : 'costs nothing');
  }
  if (c.type === 'stagger') return 'the busiest arrival time moves ' + Math.abs(c.delta) + ' min earlier · free, but less convenient';
  if (c.type === 'shuttle') return 'the road carries ' + c.add + ' more people a minute · ' + inr(c.vehicles * 2600);
  if (c.type === 'food') return 'serves ' + c.n * 6 + ' more people per minute at that food zone · ' + inr(c.n * 900 * 5);
  if (c.type === 'house') return comma(scn.lateBookings - result.unhoused) + ' late bookers get a room and arrive by coach, earlier, to a quiet gate';
  return '';
}

/** which timing field a lever's start time lives in (decision window) */
export const PARAM_FOR_TYPE: Record<Intervention['type'], 'from' | 'decisionTick'> = {
  lanes: 'from',
  shuttle: 'from',
  food: 'from',
  nudge: 'decisionTick',
  stagger: 'decisionTick',
  house: 'decisionTick',
};
