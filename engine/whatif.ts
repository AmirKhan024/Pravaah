/*
 * What-if patches — port of WHATIFS/applyWhatIf() in reference/prototype.html,
 * generalised: "rail" = pulsed cohorts, "cab" = cohorts whose id mentions taxi/cab,
 * rail links = the first link of each rail cohort's path. Identical for DY Patil.
 */
import { clone } from './ensemble';
import type { CapPatch, Scenario } from './types';

export type WhatIfId = 'rain' | 'train' | 'late' | 'gatedelay';

export interface WhatIfPatch {
  capMult: CapPatch['capMult'];
  fromTick: number;
  rain?: boolean;
  railFail?: boolean;
  showShift?: number;
  gateDelay?: number;
}

export interface WhatIf {
  id: WhatIfId;
  label: string;
  patch: WhatIfPatch;
  say: string;
}

export const WHATIFS: WhatIf[] = [
  {
    id: 'rain',
    label: 'Heavy rain from 18:00',
    patch: { capMult: { walk: 0.74, road: 0.85 }, fromTick: 240, rain: true },
    say: 'Bag checks slow under cover, walking slows on wet ground, and people abandon the walk for a cab.',
  },
  {
    id: 'train',
    label: 'Harbour line fails at 18:30',
    patch: { capMult: { walk: 1, road: 1 }, fromTick: 270, railFail: true },
    say: 'The line stops. Rail arrivals divert to road, late and all at once.',
  },
  { id: 'late', label: 'Show pushed back 30 min', patch: { capMult: {}, fromTick: 0, showShift: 30 }, say: 'More time to get people in, but arrivals drift later too.' },
  {
    id: 'gatedelay',
    label: 'Screening opens 2.5 hrs late',
    patch: { capMult: {}, fromTick: 0, gateDelay: 150 },
    say: 'A screening equipment fault means gates do not open until 18:30 instead of 16:00. The same crowd has far less time to get in.',
  },
];

export const isRail = (c: { id: string; pulse?: unknown }) => !!c.pulse;
export const isCab = (c: { id: string }) => /taxi|cab/.test(c.id);

export function railLinks(scn: Scenario): string[] {
  const s = new Set<string>();
  scn.cohorts.filter(isRail).forEach((c) => s.add(c.path[0]));
  return [...s];
}

export function applyRain(scn: Scenario) {
  scn.laneRate = 24 * (scn.laneRate / 28);
  scn.cohorts.forEach((c) => {
    if (isCab(c)) c.size = Math.round(c.size * 1.5);
    if (isRail(c)) c.size = Math.round(c.size * 0.88);
    c.mean += 5;
  });
}

export function applyRailFail(scn: Scenario) {
  scn.cohorts.forEach((c) => {
    if (isRail(c)) {
      c.mean += 26;
      c.std = Math.max(16, c.std - 9);
    }
  });
  const rl = railLinks(scn);
  scn.links.forEach((l) => {
    if (rl.indexOf(l.id) >= 0) l.cap = Math.round(l.cap! * 0.42);
  });
}

export function applyWhatIf(base: Scenario, w: WhatIf | { patch: WhatIfPatch }) {
  const scn = clone(base);
  if (w.patch.rain) applyRain(scn);
  if (w.patch.railFail) applyRailFail(scn);
  if (w.patch.showShift) {
    scn.showStartTick += w.patch.showShift;
    scn.cohorts.forEach((c) => (c.mean += 18));
  }
  if (w.patch.gateDelay) scn.gatesOpenTick += w.patch.gateDelay;
  return { scn, opts: { patch: { capMult: w.patch.capMult || {}, fromTick: w.patch.fromTick || 0 } } };
}
