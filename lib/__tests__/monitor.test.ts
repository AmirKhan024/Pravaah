/*
 * The monitor loop's pure logic: merging observed reports without losing an earlier, more severe
 * one, and matching a fired tripwire against Red Team's own "breaks when" factors — never a new
 * threshold invented here, only what Red Team already computed.
 */
import { describe, expect, it } from 'vitest';
import { EMPTY_SPEC } from '../whatifParse';
import { firedTripwires, isObservedEmpty, mergeObserved } from '../monitor';
import type { RedTeamResult } from '@/engine';

describe('mergeObserved()', () => {
  it('starts empty and stays empty with no reports', () => {
    expect(isObservedEmpty(mergeObserved(EMPTY_SPEC, {}))).toBe(true);
  });
  it('a later, milder report never un-reports an earlier, more severe one', () => {
    const afterRain = mergeObserved(EMPTY_SPEC, { rain: true });
    const afterMilderGate = mergeObserved({ ...afterRain, gatesLateMin: 30 }, { gatesLateMin: 10 });
    expect(afterMilderGate.rain).toBe(true);
    expect(afterMilderGate.gatesLateMin).toBe(30); // the worse of the two, not overwritten by the milder one
  });
  it('rail failure keeps the earliest reported time', () => {
    const first = mergeObserved(EMPTY_SPEC, { railFailAt: 19 * 60 });
    const second = mergeObserved(first, { railFailAt: 18 * 60 + 30 });
    expect(second.railFailAt).toBe(18 * 60 + 30);
  });
  it('turnout accumulates across reports and stays clamped to ±30', () => {
    const s = mergeObserved(mergeObserved(EMPTY_SPEC, { turnoutPct: 20 }), { turnoutPct: 20 });
    expect(s.turnoutPct).toBe(30);
  });
});

describe('firedTripwires()', () => {
  const rt = (over: Partial<RedTeamResult> = {}): RedTeamResult =>
    ({
      nights: [],
      survived: 8,
      total: 12,
      worst: {} as never,
      breaksWhen: [
        { label: 'heavy rain', failRate: 0.6, n: 4, key: 'rain', value: true },
        { label: 'gates open 60 min late', failRate: 0.55, n: 4, key: 'gatesLate', value: 60 },
        { label: '20% more people', failRate: 0.7, n: 4, key: 'turnout', value: 1.2 },
      ],
      backup: { chosen: [], crush: 4, missed: 0, rupees: 0 },
      headline: { survived: 8, total: 12 },
      tiers: { safe: 8, better: 0, same: 0, worse: 4 },
      ...over,
    }) as RedTeamResult;

  it('nothing fires with no observed conditions', () => {
    expect(firedTripwires(rt(), EMPTY_SPEC)).toEqual([]);
  });
  it('nothing fires without a computed backup, even if conditions match', () => {
    expect(firedTripwires(rt({ backup: null }), { ...EMPTY_SPEC, rain: true })).toEqual([]);
  });
  it('rain observed fires the rain tripwire only', () => {
    const fired = firedTripwires(rt(), { ...EMPTY_SPEC, rain: true });
    expect(fired.map((t) => t.key)).toEqual(['rain']);
  });
  it('a gate delay below the tested threshold does not fire; at or above it does', () => {
    expect(firedTripwires(rt(), { ...EMPTY_SPEC, gatesLateMin: 30 }).map((t) => t.key)).toEqual([]);
    expect(firedTripwires(rt(), { ...EMPTY_SPEC, gatesLateMin: 60 }).map((t) => t.key)).toEqual(['gatesLate']);
  });
  it('turnout direction matters: fewer people does not fire a "more people" tripwire', () => {
    expect(firedTripwires(rt(), { ...EMPTY_SPEC, turnoutPct: -20 }).map((t) => t.key)).toEqual([]);
    expect(firedTripwires(rt(), { ...EMPTY_SPEC, turnoutPct: 20 }).map((t) => t.key)).toEqual(['turnout']);
  });
  it('multiple observed conditions can fire multiple tripwires at once', () => {
    const fired = firedTripwires(rt(), { ...EMPTY_SPEC, rain: true, gatesLateMin: 60 });
    expect(fired.map((t) => t.key).sort()).toEqual(['gatesLate', 'rain']);
  });
});
