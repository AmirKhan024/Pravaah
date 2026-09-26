import { NextResponse } from 'next/server';
import { groqJSON, llmEnabled } from '@/lib/groq';
import type { ColumnMapping, ExtractedRow, MappingResult, NormalizeDict } from '@/lib/registrations/types';

export const dynamic = 'force-dynamic';

interface Body {
  headers: string[] | null;
  sample: Record<string, string>[] | string[];
  gates: { id: string; name: string }[];
}

const MODE_TARGETS = new Set(['rail', 'metro', 'bus', 'car', 'walk', 'shuttle']);

function validateColumnMapping(raw: unknown, headers: string[]): { mapping: ColumnMapping; normalize: NormalizeDict } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const m = r.mapping;
  if (!m || typeof m !== 'object') return null;
  const mm = m as Record<string, unknown>;
  const field = (k: string): string | null => {
    const v = mm[k];
    return typeof v === 'string' && headers.includes(v) ? v : null;
  };
  const mapping: ColumnMapping = { origin: field('origin'), mode: field('mode'), gate: field('gate'), partySize: field('partySize') };
  const n = (r.normalize && typeof r.normalize === 'object' ? r.normalize : {}) as Record<string, unknown>;
  const asDict = (v: unknown, valid?: (s: string) => boolean): Record<string, string> => {
    if (!v || typeof v !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === 'string' && (!valid || valid(val))) out[k.toLowerCase()] = val;
    }
    return out;
  };
  // gate ids are checked again downstream against the venue's real gates (lib/registrations/fuzzyMap.ts's resolveGate) — no validity check needed here
  const normalize: NormalizeDict = { mode: asDict(n.mode, (s) => MODE_TARGETS.has(s)), gate: asDict(n.gate) };
  return { mapping, normalize };
}

function validateExtractedRows(raw: unknown, sourceLines: string[]): ExtractedRow[] | null {
  if (!raw || typeof raw !== 'object') return null;
  const rows = (raw as Record<string, unknown>).rows;
  if (!Array.isArray(rows)) return null;
  const out: ExtractedRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (typeof r.origin !== 'string' || !r.origin.trim()) continue;
    if (typeof r.sourceLine !== 'string' || !r.sourceLine.trim()) continue;
    const partySize = typeof r.partySize === 'number' ? r.partySize : Number(r.partySize);
    if (!Number.isFinite(partySize) || partySize <= 0) continue;
    // the row must actually be traceable to something in the sample, and its number must be real text
    if (!sourceLines.some((l) => l.includes(r.sourceLine as string) || (r.sourceLine as string).includes(l))) continue;
    if (!(r.sourceLine as string).includes(String(Math.round(partySize)))) continue;
    out.push({ origin: r.origin.trim(), mode: typeof r.mode === 'string' ? r.mode : '', gate: typeof r.gate === 'string' ? r.gate : null, partySize: Math.round(partySize), sourceLine: r.sourceLine });
  }
  return out;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || !Array.isArray(body.sample)) return NextResponse.json({ ok: false, reason: 'bad request' }, { status: 400 });
  if (!llmEnabled()) return NextResponse.json({ ok: false, reason: 'offline' });

  const gateList = (body.gates || []).map((g) => `${g.id}: ${g.name}`).join('; ') || '(no gates loaded yet)';

  if (body.headers && body.headers.length) {
    const system =
      'You map messy spreadsheet columns for a crowd-safety tool. Target fields: origin (where the person travels from), ' +
      'mode (how they travel), gate (which entrance/stand they prefer), partySize (how many people in the group). ' +
      'Reply ONLY as JSON: {"mapping":{"origin":<one of the given headers, or null>,"mode":<...>,"gate":<...>,"partySize":<...>},' +
      '"normalize":{"mode":{"<raw value seen in the sample>":"<one of rail|metro|bus|car|walk|shuttle>"},' +
      `"gate":{"<raw value seen in the sample>":"<one of these gate ids: ${gateList}>"}}}. ` +
      'Only use header names copied exactly from the given list. Never invent a header. Never output row data, counts or sums — mapping only.';
    const user = JSON.stringify({ headers: body.headers, sampleRows: body.sample.slice(0, 20) });
    const out = await groqJSON(system, user);
    const parsed = out ? validateColumnMapping(out, body.headers) : null;
    if (!parsed) return NextResponse.json({ ok: false, reason: 'invalid response' });
    const result: MappingResult = { kind: 'columns', mapping: parsed.mapping, normalize: parsed.normalize, source: 'groq' };
    return NextResponse.json({ ok: true, result });
  }

  const lines = (body.sample as string[]).slice(0, 20).filter((l) => typeof l === 'string');
  const system =
    'You extract crowd-registration rows from messy free text such as a pasted WhatsApp-style list. For EACH person or group ' +
    'mentioned, output one row: {"origin":string,"mode":string,"gate":string|null,"partySize":number,"sourceLine":string}. ' +
    '"sourceLine" MUST be copied verbatim from one line of the input and must contain the partySize number written as a digit. ' +
    'Reply ONLY as JSON: {"rows":[...]}. Never invent a row with no matching text. Never sum, total or count anything yourself — one row per mention, nothing more.';
  const user = JSON.stringify({ lines });
  const out = await groqJSON(system, user);
  const rows = out ? validateExtractedRows(out, lines) : null;
  if (!rows) return NextResponse.json({ ok: false, reason: 'invalid response' });
  const result: MappingResult = { kind: 'rows', rows, source: 'groq' };
  return NextResponse.json({ ok: true, result });
}
