import { NextResponse } from 'next/server';
import { groqJSON, llmEnabled } from '@/lib/groq';
import { describeSpec, localParse, sanitizeSpec } from '@/lib/whatifParse';

export const dynamic = 'force-dynamic';

/*
 * A typed staff report ("Gate 3 scanners are down", "rain just started") -> the same clamped
 * WhatIfSpec a what-if question produces (lib/whatifParse.ts), same pattern: the model only picks
 * which fields to set, every value is clamped server-side regardless of source, and the offline
 * fallback is the same keyword parser. The difference from /api/llm/whatif is only the system
 * prompt — a report describes something that is happening right now, not a hypothetical to test —
 * and the caller (lib/console.ts's reportObserved()) merges the result into the running observed
 * state and feeds the monitor loop, instead of previewing a one-off "what if".
 */
const SYSTEM = `You convert an event-ground staff report into a JSON scenario patch for a crowd simulator. The report describes something happening right now, not a hypothetical.
Return ONLY a JSON object with exactly these keys:
{"rain": boolean, "railFailAt": "HH:MM" or null, "showDelayMin": integer 0-90, "gatesLateMin": integer 0-180, "turnoutPct": integer -30..30, "slowLanes": boolean, "understood": boolean}
Rules: only set a field the report clearly reports; otherwise use false/null/0. Scanners/lanes down, broken or short-staffed -> slowLanes true. A train/metro/local line stopped or badly delayed -> railFailAt (the time it happened, or now if unstated). Screening/gates opening late or reopening late -> gatesLateMin. The show/match pushed back -> showDelayMin. More/fewer people than expected arriving, or a gate scan count running ahead/behind plan -> turnoutPct (a number if given, otherwise a modest 10-15). Times are 24-hour; "7 pm" -> "19:00". The report may be in English, Hindi or Marathi. If it isn't a factual ground report, set "understood": false. Do not predict outcomes. Do not add keys.`;

export async function POST(req: Request) {
  const { q } = (await req.json().catch(() => ({}))) as { q?: string };
  const report = String(q || '').slice(0, 300);
  if (!report.trim()) return NextResponse.json({ ok: false }, { status: 400 });
  let source: 'llm' | 'local' = 'local';
  let spec = null;
  if (llmEnabled()) {
    const raw = (await groqJSON(SYSTEM, report)) as Record<string, unknown> | null;
    if (raw && raw.understood !== false) {
      spec = sanitizeSpec(raw);
      if (spec) source = 'llm';
    }
  }
  if (!spec) spec = localParse(report);
  if (!spec) return NextResponse.json({ ok: false, source, message: 'Pravaah understands reports about rain, a rail delay, gates opening late, a delayed show, more or fewer people than expected, or slow/failed lanes.' });
  return NextResponse.json({ ok: true, source, spec, ...describeSpec(spec) });
}
