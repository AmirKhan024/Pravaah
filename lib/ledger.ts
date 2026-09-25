/*
 * Black Box ledger (SOURCE_OF_TRUTH §8.8): append-only, hash-chained, tamper-evident.
 * hash = SHA-256(prevHash + canonicalJSON(payload)). "What did we know, and when?"
 *
 * Phase 2: persistence moved to Supabase's ledger_entries table (via /api/ledger), keyed by a
 * per-browser session id so a refresh keeps the same ledger but different laptops/sessions never
 * collide. The hash-chain math below (canonicalJSON, sha256, entryBody, appendLedger,
 * verifyLedger) is UNCHANGED from before Phase 2 — only where entries are read from and written to
 * changed. If Supabase is unreachable or unconfigured, every function here falls back to
 * localStorage automatically, exactly as it worked before this phase.
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
const SESSION_KEY = 'pravaah_session_id';
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

/** stable per-browser id (localStorage), so the ledger survives a refresh without colliding with anyone else's */
export function sessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() as string) || 'sess-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'anon-' + Math.random().toString(36).slice(2);
  }
}

function loadLocal(): LedgerEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LedgerEntry[]) : [];
  } catch {
    return [];
  }
}
function saveLocal(list: LedgerEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* in-memory only */
  }
}

/** GET the persisted ledger for this session — Supabase first, localStorage if that fails */
export async function loadLedger(): Promise<LedgerEntry[]> {
  try {
    const r = await fetch(`/api/ledger?session=${encodeURIComponent(sessionId())}`, { cache: 'no-store' });
    if (r.ok) {
      const j = (await r.json()) as { entries?: LedgerEntry[] };
      if (Array.isArray(j.entries)) {
        saveLocal(j.entries); // mirror locally too, so a later Supabase outage still shows the same history
        return j.entries;
      }
    }
  } catch {
    /* fall through to local */
  }
  return loadLocal();
}

export async function appendLedger(list: LedgerEntry[], type: LedgerType, summary: string, payload: unknown, simClock: string): Promise<LedgerEntry[]> {
  const prevHash = list.length ? list[list.length - 1].hash : GENESIS;
  const body = entryBody({ seq: list.length + 1, ts: new Date().toISOString(), simClock, type, summary, payload: JSON.parse(JSON.stringify(payload ?? null)) });
  const hash = await sha256(prevHash + canonicalJSON(body));
  const entry: LedgerEntry = { ...body, prevHash, hash };
  const next = [...list, entry];
  saveLocal(next);
  try {
    await fetch('/api/ledger', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: sessionId(), entry }) });
  } catch {
    /* Supabase unreachable — the entry still lives in localStorage and in memory (`next`) */
  }
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

export async function clearLedger() {
  saveLocal([]);
  try {
    await fetch(`/api/ledger?session=${encodeURIComponent(sessionId())}`, { method: 'DELETE' });
  } catch {
    /* local clear already happened */
  }
}
