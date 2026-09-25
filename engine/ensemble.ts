/*
 * PREDICT — 60 perturbed runs of the evening → probability + timing.
 * Port of mulberry()/jitter()/runEnsemble() in reference/prototype.html.
 */
import { CRUSH } from './constants';
import { simulate } from './simulate';
import type { Scenario } from './types';

export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

export function jitter(scn: Scenario, seed: number): Scenario {
  const rnd = mulberry32(seed),
    g = () => {
      let u = 0,
        v = 0;
      while (!u) u = rnd();
      while (!v) v = rnd();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v);
    };
  const out = clone(scn);
  const turnout = 1 + g() * 0.07,
    railShare = 1 + g() * 0.16;
  out.cohorts.forEach((c) => {
    const rail = c.id.indexOf('rail') >= 0 || c.id.indexOf('local') >= 0;
    c.size = Math.round(c.size * turnout * (rail ? railShare : 2 - railShare));
    c.mean += g() * 13;
    c.std = Math.max(13, c.std * (1 + g() * 0.18));
    if (c.pulse) c.pulse.offset = Math.floor(rnd() * c.pulse.period);
  });
  out.laneRate = scn.laneRate * (1 + g() * 0.09);
  return out;
}

export interface EnsembleResult {
  n: number;
  /** probability that the watched zone reaches crush density */
  p: number;
  tMed: number;
  tLo: number;
  tHi: number;
  peakMed: number;
  crushMed: number;
  missMed: number;
  /** first-crush tick of each run that crushed (for the histogram) */
  ticks: number[];
  zone: number;
}

export function runEnsemble(scn: Scenario, n: number, zi: number, onTick?: (f: number) => void): EnsembleResult {
  let hit = 0;
  const ticks: number[] = [],
    peaks: number[] = [],
    crush: number[] = [],
    miss: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = simulate(jitter(scn, 1000 + i * 7), [], {});
    let first = -1,
      pk = 0;
    for (let t = 0; t < scn.horizon; t++) {
      const d = r.frames[t].zoneDen[zi];
      if (d > pk) pk = d;
      if (first < 0 && d >= CRUSH) first = t;
    }
    if (first >= 0) {
      hit++;
      ticks.push(first);
    }
    peaks.push(pk);
    crush.push(r.crushMin);
    miss.push(r.missed);
    if (onTick && i % 6 === 0) onTick(i / n);
  }
  const q = (a: number[], p: number) => {
    const s = a.slice().sort((x, y) => x - y);
    return s[Math.min(s.length - 1, Math.floor(s.length * p))];
  };
  return {
    n,
    p: hit / n,
    tMed: q(ticks, 0.5),
    tLo: q(ticks, 0.1),
    tHi: q(ticks, 0.9),
    peakMed: q(peaks, 0.5),
    crushMed: q(crush, 0.5),
    missMed: q(miss, 0.5),
    ticks,
    zone: zi,
  };
}
