/*
 * Slice 4 (Safety-document check): Step C (verify a claim is actually IN the text) and Step D
 * (compare against the owner's values), plus the offline fallback extractor — all against the real
 * bundled sample document.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compareToOwnerValues, fuzzyExtractClaims, verifyClaimedFigures, type ClaimedFigure } from '../docCheck';

const SAMPLE_DOC = readFileSync(join(__dirname, '../../data/sample/safety-doc.txt'), 'utf8');

describe('verifyClaimedFigures (Step C)', () => {
  it('keeps a claim whose snippet is verbatim in the text and whose number appears in that snippet', () => {
    const claims: ClaimedFigure[] = [{ field: 'capacity', value: 20000, snippet: 'an approved seating capacity of 20,000 persons' }];
    expect(verifyClaimedFigures(SAMPLE_DOC, claims)).toHaveLength(1);
  });

  it('discards a claim whose snippet is not actually in the document (an invented quote)', () => {
    const claims: ClaimedFigure[] = [{ field: 'capacity', value: 99999, snippet: 'an approved seating capacity of 99,999 persons' }];
    expect(verifyClaimedFigures(SAMPLE_DOC, claims)).toHaveLength(0);
  });

  it('discards a claim whose snippet IS real text but whose number does not appear in it (a real quote, wrong number attached)', () => {
    const claims: ClaimedFigure[] = [{ field: 'capacity', value: 99999, snippet: 'an approved seating capacity of 20,000 persons' }];
    expect(verifyClaimedFigures(SAMPLE_DOC, claims)).toHaveLength(0);
  });

  it('is whitespace/case tolerant (a model may normalise line breaks or casing when quoting)', () => {
    const claims: ClaimedFigure[] = [{ field: 'parkingSpaces', value: 550, snippet: 'Designated PARKING is provided for   550 vehicles' }];
    expect(verifyClaimedFigures(SAMPLE_DOC, claims)).toHaveLength(1);
  });
});

describe('compareToOwnerValues (Step D)', () => {
  it('matches, mismatches, and marks a missing field not-found — never invents a number for it', () => {
    const verified: ClaimedFigure[] = [
      { field: 'capacity', value: 20000, snippet: 'approved seating capacity of 20,000 persons' },
      { field: 'gateLanes', value: 14, snippet: '14 security screening lanes' },
    ];
    const rows = compareToOwnerValues(verified, { capacity: 20000, gateLanes: 13, exits: 8, parkingSpaces: 600 });
    expect(rows.find((r) => r.field === 'capacity')).toMatchObject({ status: 'match', documentValue: 20000 });
    expect(rows.find((r) => r.field === 'gateLanes')).toMatchObject({ status: 'mismatch', documentValue: 14, ownerValue: 13 });
    expect(rows.find((r) => r.field === 'exits')).toMatchObject({ status: 'not-found', documentValue: null, snippet: null });
    expect(rows.find((r) => r.field === 'parkingSpaces')).toMatchObject({ status: 'not-found' });
  });
});

describe('fuzzyExtractClaims (offline fallback, against the real bundled sample)', () => {
  const claims = fuzzyExtractClaims(SAMPLE_DOC);

  it('finds capacity, gateLanes and parkingSpaces, but not exits (the sample document never mentions exits)', () => {
    const byField = new Map(claims.map((c) => [c.field, c]));
    expect(byField.get('capacity')?.value).toBe(20000);
    expect(byField.get('gateLanes')?.value).toBe(14);
    expect(byField.get('parkingSpaces')?.value).toBe(550);
    expect(byField.has('exits')).toBe(false);
  });

  it('every fallback claim survives its own Step C verification (it quotes real text by construction)', () => {
    expect(verifyClaimedFigures(SAMPLE_DOC, claims)).toHaveLength(claims.length);
  });

  it('end-to-end against the sample owner venue: capacity matches, gate lanes and parking mismatch, exits not found', () => {
    const rows = compareToOwnerValues(verifyClaimedFigures(SAMPLE_DOC, claims), { capacity: 20000, gateLanes: 13, exits: 8, parkingSpaces: 600 });
    expect(rows.find((r) => r.field === 'capacity')!.status).toBe('match');
    expect(rows.find((r) => r.field === 'gateLanes')!.status).toBe('mismatch');
    expect(rows.find((r) => r.field === 'parkingSpaces')!.status).toBe('mismatch');
    expect(rows.find((r) => r.field === 'exits')!.status).toBe('not-found');
  });
});
