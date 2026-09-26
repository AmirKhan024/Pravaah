/*
 * Short-horizon trend warning — port of trailingSlope()/trendRender() in reference/prototype.html.
 * OLS slope over the last 8 PLAYED minutes, projected 8 ahead. It never reads a frame beyond `tick`.
 */
import { CRUSH } from './constants';
import type { Scenario, SimResult } from './types';

export const TREND_WINDOW = 8,
  TREND_AHEAD = 8;

export function trailingSlope(res: SimResult, zoneIdx: number, tick: number) {
  const t0 = Math.max(0, tick - TREND_WINDOW + 1),
    n = tick - t0 + 1;
  if (n < 3) return null;
  let sx = 0,
    sy = 0,
    sxy = 0,
    sxx = 0;
  for (let t = t0; t <= tick; t++) {
    const x = t - t0,
      y = res.frames[t].zoneDen[zoneIdx];
    sx += x;
    sy += y;
    sxy += x * y;
    sxx += x * x;
  }
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-9) return null;
  return { slope: (n * sxy - sx * sy) / denom, cur: res.frames[tick].zoneDen[zoneIdx] };
}

export function trendWarning(scn: Scenario, res: SimResult, tick: number): { zone: string; name: string; mins: number } | null {
  if (!res.frames[tick]) return null;
  let worst: { zone: string; name: string; mins: number } | null = null;
  scn.zones.forEach((z, i) => {
    if (!z.areaM2 || z.type === 'venue') return;
    if (res.frames[tick].zoneDen[i] >= CRUSH) return;
    const tr = trailingSlope(res, i, tick);
    if (!tr || tr.slope <= 1e-4) return;
    const mins = (CRUSH - tr.cur) / tr.slope;
    if (mins > 0 && mins <= TREND_AHEAD && (!worst || mins < worst.mins)) worst = { zone: z.id, name: z.name, mins };
  });
  return worst;
}
