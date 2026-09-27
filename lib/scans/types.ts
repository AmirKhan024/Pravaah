/*
 * Slice 3's "actuals from a paste/upload box." Mirrors lib/registrations/'s shape (Groq maps
 * columns; code counts) but for gate scan logs, which are always tabular (gate, timestamp or
 * minute, scanned count) — no free-text extraction path, unlike registrations' WhatsApp-style
 * messy lists.
 */
export interface ScanColumnMapping {
  gate: string | null;
  time: string | null;
  count: string | null;
}
export interface ScanRow {
  gateId: string;
  tick: number;
  count: number;
  sourceLine: string;
}
export type ScanMappingResult = { ok: true; mapping: ScanColumnMapping; source: 'groq' | 'fuzzy' } | { ok: false; reason: string };
