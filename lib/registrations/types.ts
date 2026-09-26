/*
 * Slice 2 — "AI registration upload": accept data in any shape and turn it into the arrivals
 * groups the engine already uses (origin, mode, gate, party size). Step A (parse) and Step C
 * (group/apply) are pure, deterministic and tested; Step B (Groq) only ever proposes a MAPPING or
 * CITES a row — it never counts, sums or produces a number that reaches the UI unvalidated
 * (SOURCE_OF_TRUTH §3.2).
 */

export type SourceKind = 'csv' | 'json' | 'text';

export interface ParsedInput {
  kind: SourceKind;
  /** column headers for csv/json; null for freeform text (paste, WhatsApp-style lists) */
  headers: string[] | null;
  rows: Record<string, string>[];
  /** raw lines — the preview for `text`, and the "cite the source line" ground truth for both */
  lines: string[];
  totalRows: number;
}

export interface ColumnMapping {
  origin: string | null;
  mode: string | null;
  gate: string | null;
  partySize: string | null;
}
export interface NormalizeDict {
  mode: Record<string, string>;
  gate: Record<string, string>;
}
export interface ExtractedRow {
  origin: string;
  mode: string;
  gate: string | null;
  partySize: number;
  /** copied verbatim from the source text — code re-checks this before trusting the row */
  sourceLine: string;
}

export type MappingResult =
  | { kind: 'columns'; mapping: ColumnMapping; normalize: NormalizeDict; source: 'groq' | 'fuzzy' }
  | { kind: 'rows'; rows: ExtractedRow[]; source: 'groq' | 'fuzzy'; rejected?: number };

export interface GateInfo {
  id: string;
  name: string;
  lanes: number;
}

export interface CleanGroup {
  key: string;
  origin: string;
  mode: string;
  gateId: string;
  gateName: string;
  size: number;
  rows: number;
}
export interface NeedsReviewReason {
  reason: string;
  count: number;
}
export interface ApplyResult {
  groups: CleanGroup[];
  needsReview: NeedsReviewReason[];
  totalRows: number;
  keptRows: number;
  keptPeople: number;
}
