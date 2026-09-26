/* Offline/Groq-failure fallback: fuzzy header matching + a fixed synonym table. Deterministic, no
 * network — used whenever Groq is disabled (DEMO_OFFLINE), unreachable, or returns something the
 * validator rejects, so the feature never just breaks. The UI says "offline mode" honestly. */
import type { ColumnMapping, ExtractedRow, GateInfo } from './types';

const HEADER_SYNONYMS: Record<keyof ColumnMapping, RegExp> = {
  origin: /origin|city|from|address|location|area|home/i,
  mode: /mode|travel|transport|vehicle|how.*(arriv|reach|com)/i,
  gate: /gate|stand|entrance|block/i,
  partySize: /group|party|size|pax|people|members|persons|no\.?\s*of|headcount/i,
};

export function fuzzyColumnMapping(headers: string[]): ColumnMapping {
  const pick = (re: RegExp) => headers.find((h) => re.test(h)) ?? null;
  return { origin: pick(HEADER_SYNONYMS.origin), mode: pick(HEADER_SYNONYMS.mode), gate: pick(HEADER_SYNONYMS.gate), partySize: pick(HEADER_SYNONYMS.partySize) };
}

const MODE_SYNONYMS: [RegExp, string][] = [
  [/train|rail/i, 'rail'],
  [/metro/i, 'metro'],
  [/bus/i, 'bus'],
  [/cab|taxi|uber|ola|car|self.?drive/i, 'car'],
  [/walk/i, 'walk'],
  [/shuttle|coach/i, 'shuttle'],
];
/** Free-text travel mode → the engine's own mode vocabulary (dataLoader.ts's MODE_FF keys). Blank
 *  input is a real "we don't know" (returns null, feeds `keptRows` bookkeeping upstream is not
 *  affected — a missing mode still defaults, see apply.ts); non-blank but unrecognised text (a
 *  typo, a local term) defaults to 'bus', a generic road vehicle, rather than dropping the row. */
export function normalizeMode(raw: string): string | null {
  const s = (raw || '').trim();
  if (!s) return null;
  for (const [re, val] of MODE_SYNONYMS) if (re.test(s)) return val;
  return 'bus';
}

/** Best-effort gate match against the venue's real gates — exact id, exact name, or a loose
 *  substring either way. Returns null (not an error) when nothing matches; apply.ts treats "no
 *  gate hint" as normal, not a failure — most real registration lists never mention a gate at all. */
export function resolveGate(raw: string, dict: Record<string, string>, gates: GateInfo[]): string | null {
  const s = (raw || '').trim();
  if (!s) return null;
  const viaDict = dict[s] ?? dict[s.toLowerCase()];
  if (viaDict && gates.some((g) => g.id === viaDict)) return viaDict;
  const low = s.toLowerCase();
  const hit = gates.find((g) => g.id.toLowerCase() === low || g.name.toLowerCase() === low || g.name.toLowerCase().includes(low) || low.includes(g.name.toLowerCase()));
  return hit?.id ?? null;
}

const GROUP_SIZE_PATTERNS = [/(\d+)\s*(?:of us|people|members|total)/i, /(?:party|group)\s*of\s*(\d+)/i, /(?:\+|plus)\s*(\d+)/i];
/** Offline fallback for free text with no Groq available: one row per non-empty line, matched by
 *  plain patterns only (a number-word for group size, a mode keyword, a literal gate name) — never
 *  as smart as Groq's extraction, and honestly labelled "offline mode" in the UI. Origin is the
 *  line itself (no city-name guessing), so two different phrasings of the same place will not
 *  merge into one group the way a real extraction would; that's a known, disclosed limitation. */
export function fuzzyExtractRows(lines: string[], gates: GateInfo[]): ExtractedRow[] {
  return lines.map((line) => {
    let size = 1;
    for (const re of GROUP_SIZE_PATTERNS) {
      const m = re.exec(line);
      if (m) {
        size = Math.max(1, parseInt(m[1], 10));
        break;
      }
    }
    if (size === 1) {
      const bare = /\b(\d{1,3})\b/.exec(line);
      if (bare) size = Math.max(1, parseInt(bare[1], 10));
    }
    return { origin: line.trim(), mode: normalizeMode(line) ?? '', gate: resolveGate(line, {}, gates), partySize: size, sourceLine: line };
  });
}
