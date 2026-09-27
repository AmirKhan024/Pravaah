/*
 * Deterministic Step C for a pasted/uploaded gate-scan log (Groq or the fuzzy fallback only ever
 * proposes which COLUMN is which — this file is the only place that reads a count or does
 * arithmetic on one, per SOURCE_OF_TRUTH's "no LLM ever produces a number" rule).
 */
import type { GateInfo } from '@/lib/registrations/types';
import { resolveGate } from '@/lib/registrations/fuzzyMap';
import type { ScanColumnMapping, ScanRow } from './types';

/** Accepts either a clock time ("18:40") or a bare elapsed-minutes/tick number ("160"). Wraps a
 *  clock time past midnight forward (a scan log spanning midnight is not expected for this
 *  product's evening events, but wrapping is cheap and never wrong for the case it's not needed). */
function parseTick(raw: string, t0Min: number, horizon: number): number | null {
  const s = (raw || '').trim();
  const hm = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (hm) {
    let tick = (+hm[1] * 60 + +hm[2]) - t0Min;
    while (tick < 0) tick += 1440;
    return Math.max(0, Math.min(horizon, Math.round(tick)));
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.max(0, Math.min(horizon, Math.round(n))) : null;
}

export function applyScanMapping(rows: Record<string, string>[], mapping: ScanColumnMapping, gates: GateInfo[], t0Min: number, horizon: number): { rows: ScanRow[]; rejected: number } {
  if (!mapping.gate || !mapping.time || !mapping.count) return { rows: [], rejected: rows.length };
  const out: ScanRow[] = [];
  let rejected = 0;
  for (const r of rows) {
    const gateId = resolveGate(r[mapping.gate], {}, gates);
    const tick = parseTick(r[mapping.time], t0Min, horizon);
    const count = Number(r[mapping.count]);
    if (!gateId || tick == null || !Number.isFinite(count) || count < 0) {
      rejected++;
      continue;
    }
    out.push({ gateId, tick, count: Math.round(count), sourceLine: JSON.stringify(r) });
  }
  return { rows: out, rejected };
}

export function bucketizeScanRows(rows: ScanRow[], gateIds: string[], bucketMin: number, nBuckets: number): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const g of gateIds) out[g] = new Array(nBuckets).fill(0);
  for (const r of rows) {
    if (!out[r.gateId]) continue;
    out[r.gateId][Math.min(nBuckets - 1, Math.floor(r.tick / bucketMin))] += r.count;
  }
  return out;
}
