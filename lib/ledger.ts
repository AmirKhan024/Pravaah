/*
 * Black Box ledger (SOURCE_OF_TRUTH §8.8): append-only, hash-chained, tamper-evident.
 * hash = SHA-256(prevHash + canonicalJSON(payload)). "What did we know, and when?"
 */
export type LedgerType = 'forecast_issued' | 'warning_raised' | 'plan_recommended' | 'plan_rejected' | 'plan_approved' | 'orders_sent' | 'room_result' | 'outcome' | 'redteam' | 'clock_expired';

export interface LedgerEntry {
  seq: number;
  ts: string;
  simClock: string;
  type: LedgerType;
  summary: string;
  payload: unknown;
  prevHash: string;
  hash: string;
}

const KEY = 'pravaah_ledger_v1';
const GENESIS = '0'.repeat(64);

export function canonicalJSON(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return '[' + v.map(canonicalJSON).join(',') + ']';
  const o = v as Record<string, unknown>;
  return (
    '{' +
    Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + canonicalJSON(o[k]))
      .join(',') +
    '}'
  );
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const entryBody = (e: Pick<LedgerEntry, 'seq' | 'ts' | 'simClock' | 'type' | 'summary' | 'payload'>) => ({ seq: e.seq, ts: e.ts, simClock: e.simClock, type: e.type, summary: e.summary, payload: e.payload });

export function loadLedger(): LedgerEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LedgerEntry[]) : [];
  } catch {
    return [];
  }
}
function saveLedger(list: LedgerEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* in-memory only */
  }
}

export async function appendLedger(list: LedgerEntry[], type: LedgerType, summary: string, payload: unknown, simClock: string): Promise<LedgerEntry[]> {
  const prevHash = list.length ? list[list.length - 1].hash : GENESIS;
  const body = entryBody({ seq: list.length + 1, ts: new Date().toISOString(), simClock, type, summary, payload: JSON.parse(JSON.stringify(payload ?? null)) });
  const hash = await sha256(prevHash + canonicalJSON(body));
  const next = [...list, { ...body, prevHash, hash }];
  saveLedger(next);
  return next;
}

export async function verifyLedger(list: LedgerEntry[]): Promise<{ ok: true } | { ok: false; seq: number }> {
  let prev = GENESIS;
  for (const e of list) {
    if (e.prevHash !== prev) return { ok: false, seq: e.seq };
    const h = await sha256(prev + canonicalJSON(entryBody(e)));
    if (h !== e.hash) return { ok: false, seq: e.seq };
    prev = e.hash;
  }
  return { ok: true };
}

export function clearLedger() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
