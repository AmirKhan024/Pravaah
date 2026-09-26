/* Step A (deterministic): turn whatever text came in — CSV, JSON, TXT, or a pasted list — into raw
 * rows/lines. Pure, no fetch, no DOM beyond what the caller already read as text. */
import { parseCsv } from '@/engine';
import type { ParsedInput } from './types';

export function detectAndParse(text: string): ParsedInput {
  const trimmed = text.trim();
  if (!trimmed) return { kind: 'text', headers: null, rows: [], lines: [], totalRows: 0 };

  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.every((r) => r && typeof r === 'object' && !Array.isArray(r))) {
        const rows = (parsed as Record<string, unknown>[]).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v == null ? '' : String(v)])));
        const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
        return { kind: 'json', headers, rows, lines: trimmed.split(/\r?\n/).filter((l) => l.trim()), totalRows: rows.length };
      }
    } catch {
      /* not JSON — fall through to CSV/text */
    }
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length);
  const headerCommas = (lines[0]?.match(/,/g) || []).length;
  if (headerCommas >= 1 && lines.length > 1) {
    const rows = parseCsv(trimmed);
    if (rows.length && Object.keys(rows[0]).length > 1) {
      return { kind: 'csv', headers: Object.keys(rows[0]), rows, lines, totalRows: rows.length };
    }
  }

  // freeform text — one entry per non-empty line (a pasted WhatsApp-style list, free text, etc.)
  return { kind: 'text', headers: null, rows: [], lines, totalRows: lines.length };
}

/** the sample Groq sees (and the preview the UI shows) — first ~20 rows/lines, never the whole file */
export function firstSample(p: ParsedInput, n = 20): Record<string, string>[] | string[] {
  return p.kind === 'text' ? p.lines.slice(0, n) : p.rows.slice(0, n);
}
