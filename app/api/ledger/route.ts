import { NextResponse } from 'next/server';
import { supabaseAdmin, supabaseConfigured } from '@/lib/supabase';
import type { LedgerEntry } from '@/lib/ledger';

export const dynamic = 'force-dynamic';

/*
 * Black Box persistence (Phase 2). The hash-chain itself (canonicalJSON/sha256/appendLedger/
 * verifyLedger) is computed client-side in lib/ledger.ts, unchanged — this route only stores and
 * returns already-hashed entries, keyed by a client-generated session id. When Supabase isn't
 * configured this returns a clear "not configured" response rather than a crash; lib/ledger.ts
 * treats any non-ok response the same as a network failure and falls back to localStorage.
 */

function row(sessionId: string, e: LedgerEntry) {
  return { session_id: sessionId, seq: e.seq, ts: e.ts, sim_clock: e.simClock, type: e.type, summary: e.summary, payload: e.payload ?? {}, prev_hash: e.prevHash, hash: e.hash };
}
function fromRow(r: { seq: number; ts: string; sim_clock: string; type: string; summary: string; payload: unknown; prev_hash: string; hash: string }): LedgerEntry {
  return { seq: r.seq, ts: r.ts, simClock: r.sim_clock, type: r.type as LedgerEntry['type'], summary: r.summary, payload: r.payload, prevHash: r.prev_hash, hash: r.hash };
}

export async function GET(req: Request) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, reason: 'Supabase not configured' }, { status: 501 });
  const session = new URL(req.url).searchParams.get('session');
  if (!session) return NextResponse.json({ ok: false, reason: 'missing session' }, { status: 400 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, reason: 'Supabase admin client unavailable' }, { status: 501 });
  const { data, error } = await db.from('ledger_entries').select('seq, ts, sim_clock, type, summary, payload, prev_hash, hash').eq('session_id', session).order('seq', { ascending: true });
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, entries: (data || []).map(fromRow) }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(req: Request) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, reason: 'Supabase not configured' }, { status: 501 });
  const body = (await req.json().catch(() => ({}))) as { sessionId?: string; entry?: LedgerEntry };
  if (!body.sessionId || !body.entry || typeof body.entry.seq !== 'number' || !body.entry.hash) return NextResponse.json({ ok: false, reason: 'bad entry' }, { status: 400 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, reason: 'Supabase admin client unavailable' }, { status: 501 });
  const { error } = await db.from('ledger_entries').upsert(row(body.sessionId, body.entry), { onConflict: 'session_id,seq' });
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, reason: 'Supabase not configured' }, { status: 501 });
  const session = new URL(req.url).searchParams.get('session');
  if (!session) return NextResponse.json({ ok: false, reason: 'missing session' }, { status: 400 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, reason: 'Supabase admin client unavailable' }, { status: 501 });
  const { error } = await db.from('ledger_entries').delete().eq('session_id', session);
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
