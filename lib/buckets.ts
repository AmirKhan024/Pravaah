/*
 * Six-bucket coverage map for Live Ops's status dots (bottom row: Crowd & gates, Getting there,
 * Hotels, Weather & delays, VIP, Money & refunds). Every number here is read off a SimResult or
 * Scenario — nothing is invented. Each bucket also carries a `coverage` tag, "simulated" (the
 * engine actually models this) or "playbook" (a rule/template stands in for it) — the same
 * honesty rule SOURCE_OF_TRUTH §13 applies to guessed data, applied here to coverage itself, so
 * the UI never implies more simulation than exists (§ "Coverage" in the live-ops brief).
 */
import { CRUSH, comma, inr, type Scenario, type SimResult } from '@/engine';
import { scenarioFacts } from './facts';

export type BucketId = 'crowd' | 'transport' | 'hotels' | 'weather' | 'vip' | 'money';
export type BucketStatus = 'safe' | 'watch' | 'act';
export type Coverage = 'simulated' | 'playbook';

export interface BucketInfo {
  id: BucketId;
  label: string;
  status: BucketStatus;
  coverage: Coverage;
  headline: string;
  risks: string[];
}

/** The one slice of ConsoleState this module reads. Kept local (not imported from lib/console)
 *  so console.ts can import this file without a cycle — it just passes itself in structurally. */
export interface BucketSourceState {
  scn: Scenario;
  cur: SimResult;
  base: SimResult;
  whatIf: { label: string } | null;
  /** a free-text staff report about VIP movement, if one has been logged — no number, just a flag */
  vipNote?: string | null;
}

const clampTick = (r: SimResult, t: number) => Math.max(0, Math.min(r.frames.length - 1, Math.floor(t)));

function worstZoneDen(scn: Scenario, r: SimResult, t: number, types: string[]): number {
  const f = r.frames[clampTick(r, t)];
  if (!f) return 0;
  let worst = 0;
  scn.zones.forEach((z, i) => {
    if (types.indexOf(z.type) >= 0) worst = Math.max(worst, f.zoneDen[i]);
  });
  return worst;
}
function worstLinkDen(scn: Scenario, r: SimResult, t: number, modes: string[]): number {
  const f = r.frames[clampTick(r, t)];
  if (!f) return 0;
  let worst = 0;
  scn.links.forEach((l, i) => {
    if (modes.indexOf(l.mode) >= 0) worst = Math.max(worst, f.linkDen[i]);
  });
  return worst;
}
function worstGateWait(r: SimResult, t: number): number {
  const f = r.frames[clampTick(r, t)];
  if (!f) return 0;
  const vals = Object.values(f.gateWait);
  return vals.length ? Math.max(...vals) : 0;
}
const denStatus = (d: number): BucketStatus => (d >= CRUSH ? 'act' : d >= CRUSH * 0.75 ? 'watch' : 'safe');
const worse = (a: BucketStatus, b: BucketStatus): BucketStatus => (a === 'act' || b === 'act' ? 'act' : a === 'watch' || b === 'watch' ? 'watch' : 'safe');

function crowdBucket(s: BucketSourceState, t: number): BucketInfo {
  const den = worstZoneDen(s.scn, s.cur, t, ['gate', 'plaza', 'venue']);
  const wait = worstGateWait(s.cur, t);
  const status = worse(denStatus(den), wait >= 25 ? 'act' : wait >= 12 ? 'watch' : 'safe');
  return {
    id: 'crowd',
    label: 'Crowd & gates',
    status,
    coverage: 'simulated',
    headline: status === 'safe' ? 'Gates and forecourts are moving.' : `Worst spot right now is ${den.toFixed(1)} people/m², longest gate wait ${Math.round(wait)} min.`,
    risks: [`Densest gate/forecourt zone: ${den.toFixed(1)} people/m² (dangerous at ${CRUSH}).`, `Longest current gate wait: ${Math.round(wait)} min.`, `Dangerous minutes so far this run: ${s.cur.crushMin}.`],
  };
}

function transportBucket(s: BucketSourceState, t: number): BucketInfo {
  const den = worstLinkDen(s.scn, s.cur, t, ['road', 'shuttle', 'walk']);
  const status = denStatus(den);
  return {
    id: 'transport',
    label: 'Getting there',
    status,
    coverage: 'simulated',
    headline: status === 'safe' ? 'Roads, shuttles and walking routes are clear.' : `A route in is at ${den.toFixed(1)} people/m² — that backs up onto the road behind it.`,
    risks: [`Busiest road/shuttle/walking link: ${den.toFixed(1)} people/m².`, 'Rail and cab arrivals are simulated cohorts on real paths into each gate; rickshaw drop-off is folded into the same road links, not modelled as its own mode.'],
  };
}

function hotelsBucket(s: BucketSourceState): BucketInfo {
  const facts = scenarioFacts(s.scn);
  const unhoused = s.cur.unhoused;
  const status: BucketStatus = unhoused > 0 ? 'act' : s.scn.lateBookings > 0 && !s.cur.housed ? 'watch' : 'safe';
  return {
    id: 'hotels',
    label: 'Hotels',
    status,
    coverage: 'simulated',
    headline: unhoused > 0 ? `${comma(unhoused)} late bookers still have nowhere to stay.` : `${comma(facts.freeFar)} rooms free further out; ${comma(s.scn.lateBookings)} late bookers to place.`,
    risks: [`Rooms free in the far clusters: ${comma(facts.freeFar)}.`, `Late bookers with no room nearby: ${comma(s.scn.lateBookings)}.`, `Left unhoused by the current plan: ${comma(unhoused)}.`],
  };
}

function weatherBucket(s: BucketSourceState): BucketInfo {
  const delta = s.cur.crushMin - s.base.crushMin;
  const active = !!s.whatIf;
  const status: BucketStatus = active && delta > 5 ? 'act' : active ? 'watch' : 'safe';
  return {
    id: 'weather',
    label: 'Weather & delays',
    status,
    coverage: 'simulated',
    headline: active ? `${s.whatIf!.label} — ${delta > 0 ? `+${delta} dangerous min vs. plain evening` : 'no worse than the plain evening yet'}.` : 'No rain, rail failure or delay observed right now.',
    risks: active ? [`${s.whatIf!.label} is applied to the rest of the evening.`, `Dangerous minutes vs. the plain evening: ${delta >= 0 ? '+' : ''}${delta}.`] : ['Nothing observed. Log a rain, rail-delay or gate-delay report to test it.'],
  };
}

function vipBucket(s: BucketSourceState): BucketInfo {
  const flagged = !!s.vipNote;
  return {
    id: 'vip',
    label: 'VIP',
    status: flagged ? 'watch' : 'safe',
    coverage: 'playbook',
    headline: flagged ? s.vipNote! : 'Not modelled as its own cohort or gate yet.',
    risks: ['VIP arrivals share the ordinary cohorts and gates in this scenario — there is no separate VIP path to simulate.', 'Tracked here by staff report only, as a flag, never a simulated number.'],
  };
}

function moneyBucket(s: BucketSourceState): BucketInfo {
  const missed = s.cur.missed;
  const status: BucketStatus = missed > 500 ? 'act' : missed > 0 ? 'watch' : 'safe';
  return {
    id: 'money',
    label: 'Money & refunds',
    status,
    coverage: 'playbook',
    headline: `${s.cur.rupees ? inr(s.cur.rupees) : '₹0'} spent on the current plan · ${comma(missed)} still outside at showtime.`,
    risks: [`Plan cost so far: ${s.cur.rupees ? inr(s.cur.rupees) : '₹0'} (simulated).`, `Still outside at showtime: ${comma(missed)} (simulated).`, 'Refunds, hotel-extension and comms decisions themselves are playbooks, not modelled — only the cost and missed-arrival figures above come from the engine.'],
  };
}

export function bucketStatuses(s: BucketSourceState, t: number): BucketInfo[] {
  return [crowdBucket(s, t), transportBucket(s, t), hotelsBucket(s), weatherBucket(s), vipBucket(s), moneyBucket(s)];
}
