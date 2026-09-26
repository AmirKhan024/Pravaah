/*
 * The simulation. A faithful port of simulate() in reference/prototype.html.
 * Deterministic: the same inputs give the same evening, every time.
 * Every number Pravaah shows traces back to this function.
 *
 * Deliberate differences from the prototype (golden test unaffected):
 *  - waiting person-minutes sum over every zone with type 'plaza' (prototype hardcoded
 *    fc_west/fc_north/fc_east — identical for DY Patil, and no longer NaN for other venues);
 *  - new, opt-in options: acceptOverride (The Room), linkCapMult (Red Team).
 */
import { arrivalCurve, fracRemaining } from './arrivals';
import { CRUSH, FOOD_VISIT_RATE, JAM, TYPICAL_SPEND } from './constants';
import type { Cohort, Frame, Intervention, NudgeInfo, Scenario, SimOptions, SimResult } from './types';

export const sig = (x: number) => 1 / (1 + Math.exp(-x));

interface Stream {
  cohort: Cohort;
  path: string[];
  curve: Float64Array;
  size: number;
  isAlt?: boolean;
}
interface Bucket {
  n: number;
  arrive: number;
  link: number;
  dur: number;
}

export function simulate(scn: Scenario, interventions?: Intervention[] | null, opts?: SimOptions): SimResult {
  opts = opts || {};
  const H = scn.horizon,
    Z = scn.zones,
    L = scn.links;
  const zi: Record<string, number> = {},
    li: Record<string, number> = {};
  Z.forEach((z, i) => (zi[z.id] = i));
  L.forEach((l, i) => (li[l.id] = i));
  const nZ = Z.length,
    nL = L.length;
  const mult: Record<string, number | undefined> = opts.patch ? (opts.patch.capMult as Record<string, number>) || {} : {};
  const lcm = opts.linkCapMult || {};

  const laneAdd: Record<string, { from: number; n: number }> = {};
  const capBoost: Record<string, { from: number; ramp: number; add: number }> = {};
  const shift: Record<string, number> = {};
  const divert: Record<string, number> = {};
  const foodAdd: Record<string, { from: number; n: number }> = {};
  const nudgeInfo: NudgeInfo[] = [];
  let housedFrac = 0;
  let rupees = 0,
    inconvenience = 0;
  const W = opts.waits || {};
  const AO = opts.acceptOverride || {};
  const gateOf = (pth: string[]) => {
    const l = scn.links.find((x) => x.id === pth[pth.length - 2]);
    return l ? l.gate : undefined;
  };

  for (const iv of interventions || []) {
    if (iv.type === 'lanes') {
      laneAdd[iv.gate] = { from: iv.from, n: (laneAdd[iv.gate] ? laneAdd[iv.gate].n : 0) + iv.n };
      rupees += iv.n * 1400 * Math.min((H - iv.from) / 60, 5);
    } else if (iv.type === 'shuttle') {
      capBoost[iv.link] = { from: iv.from, ramp: 15, add: iv.add };
      rupees += iv.vehicles * 2600;
    } else if (iv.type === 'stagger') {
      const c = scn.cohorts.find((c) => c.id === iv.cohort)!;
      const remFrac = iv.decisionTick != null ? fracRemaining(c, iv.decisionTick, H) : 1;
      shift[iv.cohort] = (shift[iv.cohort] || 0) + iv.delta * remFrac;
      inconvenience += c.size * Math.abs(iv.delta) * 0.35 * remFrac;
    } else if (iv.type === 'food') {
      foodAdd[iv.zone] = { from: iv.from, n: (foodAdd[iv.zone] ? foodAdd[iv.zone].n : 0) + iv.n };
      rupees += iv.n * 900 * Math.min((H - iv.from) / 60, 5);
    } else if (iv.type === 'house') {
      const lb = scn.cohorts.find((c) => c.housed);
      const remFrac = iv.decisionTick != null && lb ? fracRemaining(lb, iv.decisionTick, H) : 1;
      housedFrac = Math.max(housedFrac, remFrac);
      rupees += Math.ceil(scn.lateBookings / 50) * 2600 * remFrac;
      inconvenience += 1400 * 28 * remFrac;
    } else if (iv.type === 'nudge') {
      const c = scn.cohorts.find((c) => c.id === iv.cohort)!;
      const inc = iv.ask === 'reroute' ? c.altExtraMin || 8 : Math.abs(iv.delta || 40);
      let saved: number;
      if (iv.ask === 'reroute' && c.alt) saved = (W[gateOf(c.path)!] || 0) - (W[gateOf(c.alt)!] || 0) - (c.altExtraMin || 8);
      else saved = (W[gateOf(c.path)!] || 0) * 0.6;
      const modelP = sig(-1.9 + 3.0 * c.ps * (iv.rupees / TYPICAL_SPEND) + 0.045 * Math.max(0, saved) - 0.06 * inc);
      const fromRoom = AO[c.id] != null;
      const p = fromRoom ? Math.max(0, Math.min(1, AO[c.id])) : modelP;
      const remFrac = iv.decisionTick != null ? fracRemaining(c, iv.decisionTick, H) : 1;
      const accepted = Math.round(c.size * p * remFrac);
      rupees += accepted * iv.rupees;
      inconvenience += accepted * inc;
      if (iv.ask === 'reroute') divert[c.id] = (divert[c.id] || 0) + p * remFrac;
      else shift[c.id] = (shift[c.id] || 0) + (iv.delta || -40) * p * remFrac;
      const info: NudgeInfo = { cohort: c.id, label: c.label, rupees: iv.rupees, p, accepted, ask: iv.ask, lang: c.lang, saved: Math.max(0, Math.round(saved)) };
      if (fromRoom) {
        info.fromRoom = true;
        info.modelP = modelP;
      }
      nudgeInfo.push(info);
    }
  }

  const streams: Stream[] = [];
  const FD = opts.forceDivert || {};
  for (const c of scn.cohorts) {
    if (c.housed && housedFrac > 0) {
      streams.push({ cohort: c, path: c.housed, curve: arrivalCurve(286, 34, H, null), size: c.size * housedFrac });
      if (housedFrac < 0.999) {
        const f = Math.min(0.95, (FD[c.id] !== undefined ? FD[c.id] : 0) + (divert[c.id] || 0));
        const curve = arrivalCurve(c.mean + (shift[c.id] || 0), c.std, H, opts.noPulse ? null : c.pulse);
        streams.push({ cohort: c, path: c.path, curve, size: c.size * (1 - housedFrac) * (1 - f) });
        if (f > 0 && c.alt) streams.push({ cohort: c, path: c.alt, curve, size: c.size * (1 - housedFrac) * f, isAlt: true });
      }
      continue;
    }
    const f = Math.min(0.95, (FD[c.id] !== undefined ? FD[c.id] : 0) + (divert[c.id] || 0));
    const curve = arrivalCurve(c.mean + (shift[c.id] || 0), c.std, H, opts.noPulse ? null : c.pulse);
    if (f < 1) streams.push({ cohort: c, path: c.path, curve, size: c.size * (1 - f) });
    if (f > 0 && c.alt) streams.push({ cohort: c, path: c.alt, curve, size: c.size * f, isAlt: true });
  }
  const nS = streams.length;
  const waiting = streams.map((s) => new Float64Array(s.path.length + 1));
  const transit: Bucket[][][] = streams.map((s) => s.path.map(() => []));
  const zoneOcc = new Float64Array(nZ),
    linkOcc = new Float64Array(nL),
    zoneNow = new Float64Array(nZ);
  const holdCap = new Float64Array(nZ);
  for (let i = 0; i < nZ; i++) {
    const z = Z[i];
    holdCap[i] = z.type === 'venue' ? 1e9 : z.areaM2 ? z.areaM2 * JAM : 1e9;
  }
  const VCAP = (Z.find((z) => z.type === 'venue') || ({} as { capacity?: number })).capacity || 0;

  // precomputed index lookups (pure speed; same arithmetic)
  const streamLinkIdx = streams.map((s) => s.path.map((id) => li[id]));
  const streamFromZone = streams.map((s) => zi[L[li[s.path[0]]].from]);
  const streamToZone = streams.map((s) => s.path.map((id) => zi[L[li[id]].to]));

  const frames: Frame[] = new Array(H);
  const gateIds = Z.filter((z) => z.type === 'gate').map((z) => z.id);
  const gw: Record<string, Float64Array> = {};
  gateIds.forEach((g) => (gw[g] = new Float64Array(H)));
  const gateLinkIdx: Record<string, number> = {};
  const gateFeeders: Record<string, number[]> = {};
  const gateFromZone: Record<string, number> = {};
  for (const g of gateIds) {
    const l = L.find((x) => x.gate === g)!;
    gateLinkIdx[g] = li[l.id];
    gateFromZone[g] = zi[l.from];
    gateFeeders[g] = [];
    for (let j = 0; j < nL; j++) if (L[j].to === l.from) gateFeeders[g].push(j);
  }
  const plazaIdx: number[] = [];
  Z.forEach((z, i) => {
    if (z.type === 'plaza') plazaIdx.push(i);
  });
  const foodIds = Z.filter((z) => z.type === 'food').map((z) => z.id);
  const foodQ: Record<string, number> = {};
  foodIds.forEach((g) => (foodQ[g] = 0));
  const fw: Record<string, Float64Array> = {};
  foodIds.forEach((g) => (fw[g] = new Float64Array(H)));
  const peakDen = new Float64Array(nZ),
    peakLinkDen = new Float64Array(nL);
  const maxDenSeries = new Float32Array(H),
    crushSeries = new Float32Array(H);
  const zDen = new Float64Array(nZ),
    lDen = new Float64Array(nL);
  let crushMin = 0,
    waitPersonMin = 0,
    missed = 0,
    arrived = 0,
    worstZone = -1,
    worstDen = 0,
    worstTick = 0;
  const patchFrom = opts.patch ? opts.patch.fromTick || 0 : 0;

  for (let t = 0; t < H; t++) {
    for (let s = 0; s < nS; s++) waiting[s][0] += streams[s].size * streams[s].curve[t];

    const demand = new Float64Array(nL);
    for (let s = 0; s < nS; s++) {
      const p = streamLinkIdx[s];
      for (let k = 0; k < p.length; k++) demand[p[k]] += waiting[s][k];
    }

    const capNow = new Float64Array(nL);
    const flowNow = new Float32Array(nL),
      ttNow = new Float32Array(nL);
    for (let i = 0; i < nL; i++) {
      const l = L[i];
      if (l.mode === 'gate') {
        if (t < scn.gatesOpenTick) {
          capNow[i] = 0;
          continue;
        }
        let lanes = Z[zi[l.gate!]].lanes!;
        const a = laneAdd[l.gate!];
        if (a && t >= a.from) lanes += a.n;
        capNow[i] = lanes * scn.laneRate;
      } else {
        let c = l.cap!;
        const b = capBoost[l.id];
        if (b && t >= b.from) c += b.add * Math.min(1, (t - b.from) / b.ramp);
        if (mult[l.mode] !== undefined && t >= patchFrom) c *= mult[l.mode]!;
        const lm = lcm[l.id];
        if (lm && t >= lm.fromTick) c *= lm.mult;
        capNow[i] = c;
      }
    }

    for (let s = 0; s < nS; s++) {
      const p = streamLinkIdx[s];
      for (let k = p.length - 1; k >= 0; k--) {
        const idx = p[k],
          w = waiting[s][k];
        if (w <= 0) continue;
        const move = Math.min(w, demand[idx] > 0 ? capNow[idx] * (w / demand[idx]) : 0);
        if (move <= 0) continue;
        waiting[s][k] -= move;
        const l = L[idx];
        let tt = 1;
        if (l.mode !== 'gate') {
          const v = Math.min(demand[idx], capNow[idx]);
          tt = Math.max(1, Math.round(l.ff! * (1 + 0.15 * Math.pow(v / Math.max(1, capNow[idx]), 4))));
        }
        flowNow[idx] += move;
        ttNow[idx] = tt;
        const bk = transit[s][k],
          last = bk[bk.length - 1];
        if (last && last.arrive === t + tt) last.n += move;
        else bk.push({ n: move, arrive: t + tt, link: idx, dur: tt });
      }
    }

    linkOcc.fill(0);
    zoneNow.fill(0);
    for (let s = 0; s < nS; s++) {
      const to = streamToZone[s];
      zoneNow[streamFromZone[s]] += waiting[s][0];
      for (let k = 0; k < to.length; k++) zoneNow[to[k]] += waiting[s][k + 1];
    }
    for (let s = 0; s < nS; s++) {
      const to = streamToZone[s];
      for (let k = 0; k < to.length; k++) {
        const dest = to[k],
          bk = transit[s][k];
        for (let b = bk.length - 1; b >= 0; b--) {
          if (bk[b].arrive <= t) {
            const space = Math.max(0, holdCap[dest] - zoneNow[dest]);
            const inn = Math.min(bk[b].n, space);
            waiting[s][k + 1] += inn;
            zoneNow[dest] += inn;
            bk[b].n -= inn;
            if (bk[b].n <= 1e-6) bk.splice(b, 1);
            else linkOcc[bk[b].link] += bk[b].n;
          } else linkOcc[bk[b].link] += bk[b].n;
        }
      }
    }

    zoneOcc.fill(0);
    for (let s = 0; s < nS; s++) {
      const to = streamToZone[s];
      zoneOcc[streamFromZone[s]] += waiting[s][0];
      for (let k = 0; k < to.length; k++) zoneOcc[to[k]] += waiting[s][k + 1];
    }
    let md = 0;
    for (let i = 0; i < nZ; i++) {
      const z = Z[i];
      zDen[i] = 0;
      if (!z.areaM2 || z.type === 'venue') continue;
      zDen[i] = zoneOcc[i] / z.areaM2;
      if (zDen[i] > peakDen[i]) peakDen[i] = zDen[i];
      if (zDen[i] >= CRUSH) crushMin++;
      if (zDen[i] > md) md = zDen[i];
      if (zDen[i] > worstDen) {
        worstDen = zDen[i];
        worstZone = i;
        worstTick = t;
      }
    }
    const sat = new Float32Array(nL);
    for (let i = 0; i < nL; i++) {
      sat[i] = capNow[i] > 0 ? Math.min(2, demand[i] / capNow[i]) : 0;
      lDen[i] = 0;
      const l = L[i];
      if (!l.areaM2) continue;
      lDen[i] = linkOcc[i] / l.areaM2;
      if (lDen[i] > peakLinkDen[i]) peakLinkDen[i] = lDen[i];
      if (lDen[i] >= CRUSH) crushMin++;
      if (lDen[i] > md) md = lDen[i];
    }
    maxDenSeries[t] = md;
    crushSeries[t] = crushMin;

    for (const g of gateIds) {
      const idx = gateLinkIdx[g];
      let q = zoneOcc[gateFromZone[g]];
      const feeders = gateFeeders[g];
      for (let j = 0; j < feeders.length; j++) q += linkOcc[feeders[j]];
      gw[g][t] = t < scn.gatesOpenTick ? 0 : capNow[idx] > 0 ? Math.min(150, q / capNow[idx]) : 0;
    }
    let pz = 0;
    for (let j = 0; j < plazaIdx.length; j++) pz += zoneOcc[plazaIdx[j]];
    waitPersonMin += pz;

    for (const g of foodIds) {
      const z = Z[zi[g]];
      const nearIdx = z.near != null ? zi[z.near] : -1;
      const nearOcc = nearIdx >= 0 ? zoneOcc[nearIdx] : 0;
      const fDemand = nearOcc * FOOD_VISIT_RATE;
      let stalls = z.stalls || 0;
      const a = foodAdd[g];
      if (a && t >= a.from) stalls += a.n;
      const capFood = stalls * (z.serviceRate || 0);
      const served = Math.min(foodQ[g] + fDemand, capFood);
      foodQ[g] = Math.max(0, foodQ[g] + fDemand - served);
      fw[g][t] = capFood > 0 ? foodQ[g] / capFood : 0;
      waitPersonMin += foodQ[g];
    }

    arrived = 0;
    for (let s = 0; s < nS; s++) arrived += waiting[s][streams[s].path.length];
    if (t === scn.showStartTick) missed = VCAP - arrived;

    if (!opts.lite) {
      const gwT: Record<string, number> = {};
      gateIds.forEach((g) => (gwT[g] = gw[g][t]));
      const fwT: Record<string, number> = {};
      foodIds.forEach((g) => (fwT[g] = fw[g][t]));
      frames[t] = {
        zoneOcc: Float32Array.from(zoneOcc),
        zoneDen: Float32Array.from(zDen),
        linkOcc: Float32Array.from(linkOcc),
        linkDen: Float32Array.from(lDen),
        linkSat: sat,
        linkFlow: flowNow,
        linkTT: ttNow,
        arrived,
        gateWait: gwT,
        foodWait: fwT,
        crush: crushMin,
      };
    }
  }

  const peakOf = (a: Float64Array) => {
    let m = -Infinity;
    for (let i = 0; i < a.length; i++) if (a[i] > m) m = a[i];
    return m;
  };
  const gateWaitPeak: Record<string, number> = {};
  gateIds.forEach((g) => (gateWaitPeak[g] = peakOf(gw[g])));
  const foodWaitPeak: Record<string, number> = {};
  foodIds.forEach((g) => (foodWaitPeak[g] = peakOf(fw[g])));
  return {
    crushMin,
    missed: Math.max(0, Math.round(missed)),
    waitHours: waitPersonMin / 60,
    unhoused: Math.round(scn.lateBookings * (1 - housedFrac)),
    housed: housedFrac >= 0.999,
    rupees: Math.round(rupees),
    inconvenience: Math.round(inconvenience),
    peakDen: Array.from(peakDen),
    peakLinkDen: Array.from(peakLinkDen),
    frames: opts.lite ? [] : frames,
    nudgeInfo,
    maxDenSeries,
    crushSeries,
    gateWaitPeak,
    foodWaitPeak,
    maxGateWait: gateIds.length ? Math.max(...gateIds.map((g) => gateWaitPeak[g])) : 0,
    worst: { zone: worstZone, den: worstDen, tick: worstTick },
    interventions: interventions || [],
  };
}

/** peak gate waits of a do-nothing probe — the `waits` every nudge is priced against */
export function probeWaits(scn: Scenario, opts?: SimOptions): Record<string, number> {
  const probe = simulate(scn, [], { ...(opts || {}), lite: true, waits: undefined });
  return { ...probe.gateWaitPeak };
}
