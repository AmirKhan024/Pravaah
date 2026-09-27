import { NextResponse } from 'next/server';
import { groqJSON, llmEnabled } from '@/lib/groq';
import type { ScanColumnMapping } from '@/lib/scans/types';

export const dynamic = 'force-dynamic';

interface Body {
  headers: string[];
  sample: Record<string, string>[];
}

function validate(raw: unknown, headers: string[]): ScanColumnMapping | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = (raw as Record<string, unknown>).mapping;
  if (!m || typeof m !== 'object') return null;
  const mm = m as Record<string, unknown>;
  const field = (k: string): string | null => {
    const v = mm[k];
    return typeof v === 'string' && headers.includes(v) ? v : null;
  };
  return { gate: field('gate'), time: field('time'), count: field('count') };
}

/** Groq maps columns only — it never sees or produces a scan count itself beyond identifying which
 *  header holds one; lib/scans/apply.ts is the only place a count is ever read or summed. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || !Array.isArray(body.headers) || !body.headers.length) return NextResponse.json({ ok: false, reason: 'bad request' }, { status: 400 });
  if (!llmEnabled()) return NextResponse.json({ ok: false, reason: 'offline' });

  const system =
    'You map messy spreadsheet columns for a stadium gate-scan log. Target fields: gate (which gate/entrance/door the scans ' +
    'happened at), time (a clock time like "18:40" or a plain elapsed-minutes/tick number), count (how many people scanned in ' +
    'during that row). Reply ONLY as JSON: {"mapping":{"gate":<one of the given headers, or null>,"time":<...>,"count":<...>}}. ' +
    'Only use header names copied exactly from the given list. Never invent a header. Never output row data, counts or sums — mapping only.';
  const user = JSON.stringify({ headers: body.headers, sampleRows: (body.sample || []).slice(0, 10) });
  const out = await groqJSON(system, user);
  const mapping = out ? validate(out, body.headers) : null;
  if (!mapping) return NextResponse.json({ ok: false, reason: 'invalid response' });
  return NextResponse.json({ ok: true, mapping, source: 'groq' });
}
