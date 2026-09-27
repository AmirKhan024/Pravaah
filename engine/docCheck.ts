/*
 * Slice 4 (Safety-document check). Pure TS, no fs/DOM — callers extract text (Step A, an API route
 * using pdf-parse or a plain .txt decode) and get a Groq-proposed figure list (Step B) themselves;
 * this file is Steps C and D: verify each claim is actually IN the text (never trust the model's
 * say-so about its own quote), then compare against the owner's entered values. "Pravaah checks
 * that your numbers match your papers. It does not certify safety."
 */
export type DocCheckField = 'capacity' | 'gateLanes' | 'exits' | 'parkingSpaces';

export const DOC_CHECK_FIELDS: { field: DocCheckField; label: string }[] = [
  { field: 'capacity', label: 'Capacity' },
  { field: 'gateLanes', label: 'Total gate/screening lanes' },
  { field: 'exits', label: 'Number of exits' },
  { field: 'parkingSpaces', label: 'Total parking spaces' },
];

/** What Groq (Step B) is asked to propose — a figure it claims to have found, plus the exact
 *  snippet it claims to have found it in. Never trusted until verifyClaimedFigures (Step C). */
export interface ClaimedFigure {
  field: DocCheckField;
  value: number;
  snippet: string;
}

const normalizeText = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
const digitsOnly = (s: string) => s.replace(/[^\d]/g, '');

/** Step C (code, never the model): a claim survives only if its snippet appears verbatim in the
 *  document text (whitespace-normalized, case-insensitive) AND the claimed number's digits appear
 *  literally within that snippet — catches a model that quotes real text but attaches the wrong
 *  number to it, not just a model that invents a quote outright. */
export function verifyClaimedFigures(text: string, claims: ClaimedFigure[]): ClaimedFigure[] {
  const hay = normalizeText(text);
  return claims.filter((c) => {
    if (!c.snippet?.trim() || !Number.isFinite(c.value)) return false;
    const needle = normalizeText(c.snippet);
    if (!needle || !hay.includes(needle)) return false;
    const claimDigits = digitsOnly(String(Math.round(c.value)));
    return claimDigits.length > 0 && digitsOnly(c.snippet).includes(claimDigits);
  });
}

export interface DocCheckRow {
  field: DocCheckField;
  label: string;
  ownerValue: number;
  documentValue: number | null;
  snippet: string | null;
  status: 'match' | 'mismatch' | 'not-found';
}

/** Step D: compare each verified figure against what the owner actually entered. A field with no
 *  surviving claim stays 'not-found' (never presented as a mismatch it can't back up). */
export function compareToOwnerValues(verified: ClaimedFigure[], ownerValues: Record<DocCheckField, number>): DocCheckRow[] {
  return DOC_CHECK_FIELDS.map(({ field, label }) => {
    const claim = verified.find((c) => c.field === field);
    const ownerValue = ownerValues[field];
    if (!claim) return { field, label, ownerValue, documentValue: null, snippet: null, status: 'not-found' as const };
    return { field, label, ownerValue, documentValue: claim.value, snippet: claim.snippet, status: claim.value === ownerValue ? ('match' as const) : ('mismatch' as const) };
  });
}

/** Offline/Groq-failure fallback (DEMO_OFFLINE, or Groq unreachable/disabled) — plain regex
 *  patterns against the bundled sample document's own phrasing. Deliberately narrow (this is a
 *  fallback, not a general document parser) and honestly labelled "offline mode" in the UI. */
const FALLBACK_PATTERNS: Record<DocCheckField, RegExp[]> = {
  capacity: [/capacity of\s*([\d,]+)\s*persons/i, /seating capacity[^\d]{0,20}([\d,]+)/i],
  gateLanes: [/([\d,]+)\s*security screening lanes/i, /([\d,]+)\s*(?:screening|entry)\s*lanes/i],
  exits: [/([\d,]+)\s*(?:emergency\s*)?exits?\b/i],
  parkingSpaces: [/parking is provided for\s*([\d,]+)\s*vehicles/i, /parking for\s*([\d,]+)\s*vehicles/i],
};

export function fuzzyExtractClaims(text: string): ClaimedFigure[] {
  const claims: ClaimedFigure[] = [];
  for (const { field } of DOC_CHECK_FIELDS) {
    for (const re of FALLBACK_PATTERNS[field]) {
      const m = re.exec(text);
      if (!m) continue;
      const value = Number(m[1].replace(/,/g, ''));
      if (!Number.isFinite(value)) continue;
      const idx = m.index;
      const start = Math.max(0, text.lastIndexOf('.', idx) + 1, text.lastIndexOf('\n', idx) + 1);
      const dot = text.indexOf('.', idx);
      const end = dot >= 0 ? dot + 1 : Math.min(text.length, idx + m[0].length + 40);
      claims.push({ field, value, snippet: text.slice(start, end).trim() });
      break;
    }
  }
  return claims;
}
