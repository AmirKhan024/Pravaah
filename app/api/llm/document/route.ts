import { NextResponse } from 'next/server';
import { groqJSON, llmEnabled } from '@/lib/groq';
import { DOC_CHECK_FIELDS, type ClaimedFigure, type DocCheckField } from '@/engine';

export const dynamic = 'force-dynamic';

interface Body {
  text: string;
}

const FIELD_SET = new Set<DocCheckField>(DOC_CHECK_FIELDS.map((f) => f.field));

/** Step B only: Groq proposes a figure + the exact quote it claims to have found it in, for each of
 *  the 4 fields that exist on the owner venue screen. It never gets the owner's own values, and its
 *  output is never trusted here — engine/docCheck.ts's verifyClaimedFigures (Step C) re-checks every
 *  snippet against the real text before anything reaches the UI. */
function validate(raw: unknown, text: string): ClaimedFigure[] | null {
  if (!raw || typeof raw !== 'object') return null;
  const claims = (raw as Record<string, unknown>).claims;
  if (!Array.isArray(claims)) return null;
  const out: ClaimedFigure[] = [];
  for (const c of claims) {
    if (!c || typeof c !== 'object') continue;
    const r = c as Record<string, unknown>;
    if (typeof r.field !== 'string' || !FIELD_SET.has(r.field as DocCheckField)) continue;
    const value = typeof r.value === 'number' ? r.value : Number(r.value);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (typeof r.snippet !== 'string' || !r.snippet.trim()) continue;
    if (!text.includes(r.snippet.trim()) && !text.replace(/\s+/g, ' ').includes(r.snippet.replace(/\s+/g, ' ').trim())) continue; // cheap pre-check; the real check is Step C downstream
    out.push({ field: r.field as DocCheckField, value, snippet: r.snippet.trim() });
  }
  return out;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || typeof body.text !== 'string' || !body.text.trim()) return NextResponse.json({ ok: false, reason: 'bad request' }, { status: 400 });
  if (!llmEnabled()) return NextResponse.json({ ok: false, reason: 'offline' });

  const fieldList = DOC_CHECK_FIELDS.map((f) => `${f.field} (${f.label})`).join('; ');
  const system =
    'You read an excerpt of a venue safety/fire-NOC document and find CLAIMED figures for these fields, if present: ' +
    `${fieldList}. For each field you can actually find, quote the EXACT sentence or clause it appears in, copied ` +
    'verbatim from the input, and the number itself. Reply ONLY as JSON: {"claims":[{"field":"capacity|gateLanes|exits|parkingSpaces",' +
    '"value":<number>,"snippet":"<verbatim quote from the input containing that number>"}]}. Only include a field if the ' +
    'document actually states a number for it — never guess or invent a figure. Never output anything about any other field.';
  const user = JSON.stringify({ text: body.text.slice(0, 8000) });
  const out = await groqJSON(system, user);
  const claims = out ? validate(out, body.text) : null;
  if (!claims) return NextResponse.json({ ok: false, reason: 'invalid response' });
  return NextResponse.json({ ok: true, claims, source: 'groq' });
}
