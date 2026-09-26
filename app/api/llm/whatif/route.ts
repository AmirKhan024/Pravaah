import { NextResponse } from 'next/server';
import { groqJSON, llmEnabled } from '@/lib/groq';
import { describeSpec, localParse, sanitizeSpec } from '@/lib/whatifParse';

export const dynamic = 'force-dynamic';

const SYSTEM = `You convert an event organiser's what-if question into a JSON scenario patch for a crowd simulator.
Return ONLY a JSON object with exactly these keys:
{"rain": boolean, "railFailAt": "HH:MM" or null, "showDelayMin": integer 0-90, "gatesLateMin": integer 0-180, "turnoutPct": integer -30..30, "slowLanes": boolean, "understood": boolean}
Rules: only set a field if the question clearly asks for it; otherwise use false/null/0. "turnoutPct" is the change in crowd size in percent the user states (e.g. "20% more people" -> 20; "more people" without a number -> 12). Times are 24-hour; "7 pm" -> "19:00". A train/metro/local line failing or stopping -> railFailAt. Screening/gates opening late -> gatesLateMin. The show/match starting late -> showDelayMin. Bag checks/scanners/staff being slow -> slowLanes. The question may be in English, Hindi or Marathi. If it asks about anything else, set "understood": false. Do not predict outcomes. Do not add keys.`;

export async function POST(req: Request) {
  const { q } = (await req.json().catch(() => ({}))) as { q?: string };
  const question = String(q || '').slice(0, 300);
  if (!question.trim()) return NextResponse.json({ ok: false }, { status: 400 });
  let source: 'llm' | 'local' = 'local';
  let spec = null;
  if (llmEnabled()) {
    const raw = (await groqJSON(SYSTEM, question)) as Record<string, unknown> | null;
    if (raw && raw.understood !== false) {
      spec = sanitizeSpec(raw);
      if (spec) source = 'llm';
    }
  }
  if (!spec) spec = localParse(question);
  if (!spec) return NextResponse.json({ ok: false, source, message: 'Pravaah can test rain, a rail failure, gates opening late, a delayed show, a bigger or smaller crowd, or slow bag checks.' });
  return NextResponse.json({ ok: true, source, spec, ...describeSpec(spec) });
}
