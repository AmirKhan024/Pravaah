import { describe, expect, it } from 'vitest';
import { applyColumnMapping, cleanGroupsToArrivalRows, verifyExtractedRows } from '../apply';
import type { ColumnMapping, ExtractedRow, GateInfo, NormalizeDict, ParsedInput } from '../types';

const GATES: GateInfo[] = [
  { id: 'G1', name: 'Gate 1', lanes: 6 },
  { id: 'G2', name: 'Gate 2', lanes: 4 },
];
const MAPPING: ColumnMapping = { origin: 'Coming From', mode: 'How Arriving', gate: 'Preferred Stand', partySize: 'Total Members' };
const NORMALIZE: NormalizeDict = { mode: {}, gate: {} };

function parsedFrom(rows: Record<string, string>[]): ParsedInput {
  return { kind: 'csv', headers: Object.keys(rows[0]), rows, lines: [], totalRows: rows.length };
}

describe('applyColumnMapping — deterministic grouping (Step C)', () => {
  it('groups matching origin/mode/gate and sums party sizes', () => {
    const parsed = parsedFrom([
      { 'Coming From': 'Kharghar', 'How Arriving': 'car', 'Preferred Stand': 'Gate 1', 'Total Members': '4' },
      { 'Coming From': 'kharghar', 'How Arriving': 'CAR', 'Preferred Stand': 'Gate 1', 'Total Members': '2' },
    ]);
    const res = applyColumnMapping(parsed, MAPPING, NORMALIZE, GATES);
    expect(res.groups.length).toBe(1);
    expect(res.groups[0].size).toBe(6);
    expect(res.groups[0].rows).toBe(2);
    expect(res.groups[0].gateId).toBe('G1');
    expect(res.keptPeople).toBe(6);
  });

  it('sends rows with no usable origin or group size to needs-review, never invents a number', () => {
    const parsed = parsedFrom([
      { 'Coming From': '', 'How Arriving': 'car', 'Preferred Stand': '', 'Total Members': '4' },
      { 'Coming From': 'Vashi', 'How Arriving': 'metro', 'Preferred Stand': '', 'Total Members': '' },
      { 'Coming From': 'Nerul', 'How Arriving': 'walk', 'Preferred Stand': '', 'Total Members': '3' },
    ]);
    const res = applyColumnMapping(parsed, MAPPING, NORMALIZE, GATES);
    expect(res.totalRows).toBe(3);
    expect(res.keptRows).toBe(1);
    expect(res.needsReview.find((r) => r.reason === 'missing origin')?.count).toBe(1);
    expect(res.needsReview.find((r) => r.reason === 'missing or invalid group size')?.count).toBe(1);
  });

  it('rows with no gate hint are distributed proportionally across the real gates, summing back exactly', () => {
    const parsed = parsedFrom([{ 'Coming From': 'Thane', 'How Arriving': 'bus', 'Preferred Stand': '', 'Total Members': '100' }]);
    const res = applyColumnMapping(parsed, MAPPING, NORMALIZE, GATES);
    const total = res.groups.reduce((a, g) => a + g.size, 0);
    expect(total).toBe(100); // largest-remainder split must never lose or invent people
    const g1 = res.groups.find((g) => g.gateId === 'G1')!.size;
    const g2 = res.groups.find((g) => g.gateId === 'G2')!.size;
    expect(g1).toBeGreaterThan(g2); // Gate 1 has more lanes (6 vs 4), so it gets the bigger share
    expect(g1 + g2).toBe(100);
  });

  it('unrecognised mode text defaults to a generic mode rather than dropping the row', () => {
    const parsed = parsedFrom([{ 'Coming From': 'Pune', 'How Arriving': 'jetpack', 'Preferred Stand': '', 'Total Members': '2' }]);
    const res = applyColumnMapping(parsed, MAPPING, NORMALIZE, GATES);
    expect(res.keptRows).toBe(1);
    expect(res.groups[0].mode).toBe('bus');
  });
});

describe('cleanGroupsToArrivalRows', () => {
  it('produces a valid ArrivalRow per group, tagged real (this is provided data, not a guess)', () => {
    const rows = cleanGroupsToArrivalRows([{ key: 'k', origin: 'Kharghar', mode: 'car', gateId: 'G1', gateName: 'Gate 1', size: 6, rows: 2 }], '16:00', '19:00');
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('real');
    expect(rows[0].size).toBe('6');
    expect(rows[0].ticket_gate).toBe('G1');
    expect(/^\d{2}:\d{2}$/.test(rows[0].mean_arrival_time)).toBe(true);
  });
});

describe('verifyExtractedRows — the LLM-cited-row safety check', () => {
  it('keeps a row whose party size genuinely appears in its cited source line', () => {
    const rows: ExtractedRow[] = [{ origin: 'Kharghar', mode: 'car', gate: null, partySize: 4, sourceLine: 'Rohan from Kharghar, 4 of us, taking a cab' }];
    const { valid, rejected } = verifyExtractedRows(rows);
    expect(valid.length).toBe(1);
    expect(rejected).toBe(0);
  });

  it('rejects a row whose number was never actually in the text (a hallucinated count)', () => {
    const rows: ExtractedRow[] = [{ origin: 'Kharghar', mode: 'car', gate: null, partySize: 40, sourceLine: 'Rohan from Kharghar, 4 of us, taking a cab' }];
    const { valid, rejected } = verifyExtractedRows(rows);
    expect(valid.length).toBe(0);
    expect(rejected).toBe(1);
  });
});
