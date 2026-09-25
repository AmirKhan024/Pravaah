/*
 * Following one person — port of tracePerson()/raviPath()/raviAt() in reference/prototype.html.
 * Ravi is not scripted: he queues behind whoever is already there and moves when the flow
 * ahead of him clears. Change the plan and his night changes.
 */
import type { Scenario, SimResult } from './types';

export const RAVI = { name: 'Ravi Sharma', with: 'Aarohi, 9', from: 'Dombivli', cohort: 'nerul_rail', release: 300 };

export type TraceSeg =
  | { type: 'wait'; zone: string; zi: number; from: number; to: number; inLink: number | null; link: string }
  | { type: 'move'; link: string; li: number; from: number; to: number; a: string; b: string }
  | { type: 'inside'; from: number; to: number };

export interface Trace {
  segs: TraceSeg[];
  inside: number;
  waited: number;
  worst: number;
  path: string[];
}

export function personPath(scn: Scenario, res: SimResult, cohortId = RAVI.cohort): string[] {
  const c = scn.cohorts.find((x) => x.id === cohortId)!;
  const n = (res.nudgeInfo || []).find((x) => x.cohort === cohortId && x.ask === 'reroute');
  return n && c.alt ? c.alt : c.path;
}

export function tracePerson(scn: Scenario, res: SimResult, path: string[], release: number): Trace {
  const H = scn.horizon;
  const li: Record<string, number> = {};
  scn.links.forEach((l, i) => (li[l.id] = i));
  const zi: Record<string, number> = {};
  scn.zones.forEach((z, i) => (zi[z.id] = i));
  const segs: TraceSeg[] = [];
  let t = release,
    inLink: number | null = null;
  for (let k = 0; k < path.length; k++) {
    const l = scn.links.find((x) => x.id === path[k])!,
      idx = li[l.id],
      fz = zi[l.from];
    const fr = res.frames[Math.min(H - 1, t)];
    let ahead = fr.zoneOcc[fz];
    scn.links.forEach((x, j) => {
      if (x.to === l.from) ahead += fr.linkOcc[j];
    });
    let cum = 0,
      dep = t;
    while (dep < H - 1 && cum < ahead) {
      cum += res.frames[dep].linkFlow[idx];
      dep++;
    }
    segs.push({ type: 'wait', zone: l.from, zi: fz, from: t, to: dep, inLink, link: l.id });
    const tt = Math.max(1, Math.round(res.frames[Math.min(H - 1, dep)].linkTT[idx] || l.ff || 1));
    segs.push({ type: 'move', link: l.id, li: idx, from: dep, to: Math.min(H - 1, dep + tt), a: l.from, b: l.to });
    t = Math.min(H - 1, dep + tt);
    inLink = idx;
  }
  segs.push({ type: 'inside', from: t, to: H - 1 });
  let waited = 0,
    worst = 0;
  segs.forEach((s) => {
    if (s.type === 'wait') {
      waited += s.to - s.from;
      for (let u = s.from; u < s.to; u++) worst = Math.max(worst, res.frames[u].zoneDen[s.zi]);
    }
  });
  return { segs, inside: t, waited, worst, path };
}

export interface PersonAt {
  seg: TraceSeg;
  stage: number;
  waited?: number;
  den?: number;
  prog?: number;
}

export function personAt(tr: Trace, res: SimResult, t: number): PersonAt {
  for (let i = 0; i < tr.segs.length; i++) {
    const s = tr.segs[i];
    if (t < s.from) continue;
    if (s.type === 'inside') return { seg: s, stage: 3 };
    if (t < s.to) {
      if (s.type === 'wait') return { seg: s, stage: i === 0 ? 0 : 2, waited: t - s.from, den: res.frames[t].zoneDen[s.zi] };
      return { seg: s, stage: 1, prog: (t - s.from) / Math.max(1, s.to - s.from) };
    }
  }
  return { seg: tr.segs[0], stage: 0 };
}
