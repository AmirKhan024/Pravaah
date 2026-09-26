/*
 * Step C (deterministic code, never the LLM): apply a mapping to ALL rows, count, group, sum
 * party sizes, and route to gates. Pure — no fetch, no DOM. Groq (Step B) only ever hands this
 * module a MAPPING or a set of CITED rows; every count/sum/group here is plain arithmetic.
 */
import type { ArrivalRow } from '@/engine';
import { normalizeMode, resolveGate } from './fuzzyMap';
import type { ApplyResult, CleanGroup, ColumnMapping, ExtractedRow, GateInfo, NormalizeDict, ParsedInput } from './types';

interface RawTuple {
  origin: string;
  modeRaw: string;
  gateRaw: string;
  sizeRaw: string;
}

export function tuplesFromColumnMapping(parsed: ParsedInput, mapping: ColumnMapping): RawTuple[] {
  return parsed.rows.map((row) => ({
    origin: mapping.origin ? (row[mapping.origin] ?? '') : '',
    modeRaw: mapping.mode ? (row[mapping.mode] ?? '') : '',
    gateRaw: mapping.gate ? (row[mapping.gate] ?? '') : '',
    sizeRaw: mapping.partySize ? (row[mapping.partySize] ?? '') : '',
  }));
}
export function tuplesFromExtractedRows(rows: ExtractedRow[]): RawTuple[] {
  return rows.map((r) => ({ origin: r.origin, modeRaw: r.mode, gateRaw: r.gate ?? '', sizeRaw: String(r.partySize) }));
}

function normalizeOrigin(raw: string): string {
  const s = (raw || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.replace(/\w\S*/g, (t) => t[0].toUpperCase() + t.slice(1).toLowerCase());
}
function parseSize(raw: string): number | null {
  const n = parseInt(String(raw ?? '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Splits `total` across `gates` proportional to lane count (largest-remainder method, so the
 *  parts sum back to exactly `total`) — used for registrations that gave no gate hint at all. See
 *  docs/DECISIONS.md: distributing by capacity beats a "needs review" pile, since most real
 *  registration lists never mention a gate. */
function allocateProportional(total: number, gates: GateInfo[]): Record<string, number> {
  const totalLanes = gates.reduce((a, g) => a + g.lanes, 0) || 1;
  const raw = gates.map((g) => (total * g.lanes) / totalLanes);
  const floors = raw.map(Math.floor);
  const allocated = floors.reduce((a, b) => a + b, 0);
  const remainder = total - allocated;
  const fracOrder = raw.map((v, i) => ({ i, frac: v - floors[i] })).sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (let k = 0; k < remainder && fracOrder.length; k++) out[fracOrder[k % fracOrder.length].i]++;
  const rec: Record<string, number> = {};
  gates.forEach((g, i) => (rec[g.id] = out[i]));
  return rec;
}

function groupRegistrations(tuples: RawTuple[], gates: GateInfo[], normalize: NormalizeDict): ApplyResult {
  const needsReview: Record<string, number> = {};
  const bump = (reason: string) => (needsReview[reason] = (needsReview[reason] ?? 0) + 1);

  const withGate = new Map<string, { origin: string; mode: string; gateId: string; size: number; rows: number }>();
  const pending: { origin: string; mode: string; size: number; rows: number }[] = [];
  let keptRows = 0;
  let keptPeople = 0;

  for (const r of tuples) {
    const origin = normalizeOrigin(r.origin);
    if (!origin) {
      bump('missing origin');
      continue;
    }
    const size = parseSize(r.sizeRaw);
    if (size == null) {
      bump('missing or invalid group size');
      continue;
    }
    const mode = normalize.mode[r.modeRaw.trim().toLowerCase()] ?? normalizeMode(r.modeRaw) ?? 'bus';
    const gateId = resolveGate(r.gateRaw, normalize.gate, gates);
    keptRows++;
    keptPeople += size;
    if (gateId) {
      const key = origin + '|' + mode + '|' + gateId;
      const g = withGate.get(key) ?? { origin, mode, gateId, size: 0, rows: 0 };
      g.size += size;
      g.rows++;
      withGate.set(key, g);
    } else {
      const existing = pending.find((p) => p.origin === origin && p.mode === mode);
      if (existing) {
        existing.size += size;
        existing.rows++;
      } else pending.push({ origin, mode, size, rows: 1 });
    }
  }

  // no gate hint at all: split proportionally across the venue's real gates by lane share
  for (const p of pending) {
    if (!gates.length) continue;
    const sizeAlloc = allocateProportional(p.size, gates);
    const rowsAlloc = allocateProportional(p.rows, gates);
    for (const g of gates) {
      const size = sizeAlloc[g.id];
      if (!size) continue;
      const key = p.origin + '|' + p.mode + '|' + g.id;
      const existing = withGate.get(key) ?? { origin: p.origin, mode: p.mode, gateId: g.id, size: 0, rows: 0 };
      existing.size += size;
      existing.rows += rowsAlloc[g.id] ?? 0;
      withGate.set(key, existing);
    }
  }

  const groups: CleanGroup[] = Array.from(withGate.values())
    .filter((g) => g.size > 0)
    .map((g) => ({ key: g.origin + '|' + g.mode + '|' + g.gateId, origin: g.origin, mode: g.mode, gateId: g.gateId, gateName: gates.find((x) => x.id === g.gateId)?.name ?? g.gateId, size: g.size, rows: g.rows }))
    .sort((a, b) => b.size - a.size);

  return {
    groups,
    needsReview: Object.entries(needsReview).map(([reason, count]) => ({ reason, count })),
    totalRows: tuples.length,
    keptRows,
    keptPeople,
  };
}

export function applyColumnMapping(parsed: ParsedInput, mapping: ColumnMapping, normalize: NormalizeDict, gates: GateInfo[]): ApplyResult {
  return groupRegistrations(tuplesFromColumnMapping(parsed, mapping), gates, normalize);
}
export function applyExtractedRows(rows: ExtractedRow[], gates: GateInfo[]): ApplyResult {
  return groupRegistrations(tuplesFromExtractedRows(rows), gates, { mode: {}, gate: {} });
}

/** The safety check the brief asks for on free-text extraction: an LLM-cited row is only trusted
 *  once code confirms its party-size number really appears in the line it claims to be quoting. */
export function verifyExtractedRows(rows: ExtractedRow[]): { valid: ExtractedRow[]; rejected: number } {
  let rejected = 0;
  const valid = rows.filter((r) => {
    const ok = typeof r.sourceLine === 'string' && r.sourceLine.includes(String(r.partySize)) && Number.isFinite(r.partySize) && r.partySize > 0 && !!r.origin?.trim();
    if (!ok) rejected++;
    return ok;
  });
  return { valid, rejected };
}

function toMin(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim());
  return m ? +m[1] * 60 + +m[2] : 16 * 60;
}

/** Clean groups → the exact ArrivalRow shape engine/dataLoader.ts already validates and simulates.
 *  Bigger groups are spread a little earlier in the gates-open→show-start window (a rough but
 *  honest default; there's no per-group timing in the source data to do better than that). */
export function cleanGroupsToArrivalRows(groups: CleanGroup[], gatesOpen: string, showStart: string): ArrivalRow[] {
  const gOpen = toMin(gatesOpen);
  const show = toMin(showStart);
  const sorted = [...groups].sort((a, b) => b.size - a.size);
  return sorted.map((g, i) => {
    const frac = sorted.length > 1 ? i / (sorted.length - 1) : 0.5;
    const t = Math.round(gOpen + (show - gOpen) * (0.3 + 0.5 * frac));
    const hh = String(Math.floor(t / 60) % 24).padStart(2, '0');
    const mm = String(t % 60).padStart(2, '0');
    return {
      group: `${g.origin} · ${g.mode}`,
      size: String(g.size),
      share_pct: '',
      mode: g.mode,
      origin: g.origin,
      preferred_gate: g.gateId,
      ticket_gate: g.gateId,
      mean_arrival_time: `${hh}:${mm}`,
      spread_min: '25',
      pulse_period_min: g.mode === 'rail' || g.mode === 'metro' ? '6' : '',
      status: 'real',
      source_note: `from ${g.rows} uploaded registration${g.rows === 1 ? '' : 's'}`,
    };
  });
}
