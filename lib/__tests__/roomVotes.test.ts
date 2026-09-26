import { describe, expect, it } from 'vitest';
import { observedAcceptance, responseBreakdown, responseTiming, sumResponseCounts, tallyByCohort, tallyVotes, votableParticipantIds } from '../roomVotes';
import type { RoomSnapshot, Vote } from '../roomTypes';

const MSG = { head: 'h', body: 'b', yes: 'y', no: 'n' };

function snap(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    id: 'TEST-1',
    cohorts: [
      { id: 'nerul_rail', label: 'Nerul', size: 100, blurb: '' },
      { id: 'late_book', label: 'Late bookings', size: 10, blurb: '' },
    ],
    participants: [],
    votes: {},
    broadcast: null,
    outcome: null,
    now: 0,
    ...overrides,
  };
}

describe('vote tallying — the invariant that broke in the demo', () => {
  it('total displayed votes always equals yes + no', () => {
    const s = snap({
      participants: [
        { id: 'a', cohort: 'nerul_rail', lang: 'en', joinedAt: 0 },
        { id: 'b', cohort: 'nerul_rail', lang: 'en', joinedAt: 0 },
        { id: 'c', cohort: 'late_book', lang: 'en', joinedAt: 0 },
      ],
      broadcast: { planId: 'p', sentAt: 0, closesAt: 0, messages: { nerul_rail: { mr: MSG, hi: MSG, en: MSG } } },
      votes: { a: { choice: 'yes', at: 0 }, b: { choice: 'no', at: 0 }, c: { choice: 'yes', at: 0 } },
    });
    const t = tallyVotes(s);
    expect(t.total).toBe(t.yes + t.no);
  });

  it('a vote from a cohort with no broadcast message never counts (the reproduced bug)', () => {
    // late_book has no message this broadcast, but somehow has a vote recorded (e.g. a stray
    // simulated phone, or a direct API call) — it must not inflate the tally.
    const s = snap({
      participants: [
        { id: 'a', cohort: 'nerul_rail', lang: 'en', joinedAt: 0 },
        { id: 'ghost', cohort: 'late_book', lang: 'en', joinedAt: 0 },
      ],
      broadcast: { planId: 'p', sentAt: 0, closesAt: 0, messages: { nerul_rail: { mr: MSG, hi: MSG, en: MSG } } },
      votes: { a: { choice: 'yes', at: 0 }, ghost: { choice: 'no', at: 0 } },
    });
    const t = tallyVotes(s);
    expect(t.total).toBe(1);
    expect(t.yes).toBe(1);
    expect(t.no).toBe(0);
    expect(votableParticipantIds(s).has('ghost')).toBe(false);
  });

  it('no broadcast yet -> nobody is votable and the tally is zero', () => {
    const s = snap({ participants: [{ id: 'a', cohort: 'nerul_rail', lang: 'en', joinedAt: 0 }] });
    expect(tallyVotes(s)).toEqual({ yes: 0, no: 0, total: 0, eligible: 0 });
  });

  it('tallyByCohort sums to the same total as tallyVotes, for any mix of eligible and ineligible votes', () => {
    const s = snap({
      participants: [
        { id: 'a', cohort: 'nerul_rail', lang: 'en', joinedAt: 0 },
        { id: 'b', cohort: 'nerul_rail', lang: 'en', joinedAt: 0 },
        { id: 'c', cohort: 'late_book', lang: 'en', joinedAt: 0 },
      ],
      broadcast: { planId: 'p', sentAt: 0, closesAt: 0, messages: { nerul_rail: { mr: MSG, hi: MSG, en: MSG } } },
      votes: { a: { choice: 'yes', at: 0 }, b: { choice: 'yes', at: 0 }, c: { choice: 'no', at: 0 } },
    });
    const byCohort = tallyByCohort(s);
    const sum = Object.values(byCohort).reduce((n, c) => n + c.yes + c.no, 0);
    expect(sum).toBe(tallyVotes(s).total);
    expect(byCohort.late_book).toBeUndefined();
  });
});

describe('responseBreakdown — richer response states, ignore only after the deadline', () => {
  it('silence before the deadline is "pending", not "ignored"', () => {
    const s = snap({
      participants: [{ id: 'a', cohort: 'nerul_rail', lang: 'en', joinedAt: 0 }],
      broadcast: { planId: 'p', sentAt: 0, closesAt: 1000, messages: { nerul_rail: { mr: MSG, hi: MSG, en: MSG } } },
      votes: {},
    });
    const b = responseBreakdown(s, 500);
    expect(b.nerul_rail).toEqual(expect.objectContaining({ joined: 1, pending: 1, ignored: 0 }));
  });

  it('silence after the deadline is counted as ignored', () => {
    const s = snap({
      participants: [{ id: 'a', cohort: 'nerul_rail', lang: 'en', joinedAt: 0 }],
      broadcast: { planId: 'p', sentAt: 0, closesAt: 1000, messages: { nerul_rail: { mr: MSG, hi: MSG, en: MSG } } },
      votes: {},
    });
    const b = responseBreakdown(s, 1500);
    expect(b.nerul_rail).toEqual(expect.objectContaining({ joined: 1, pending: 0, ignored: 1 }));
  });

  it('explicit responses are counted in their own bucket, and a "seen only" placeholder (no response yet) is still pending', () => {
    const votes: Record<string, Vote> = {
      a: { choice: 'yes', at: 0, response: 'accept' },
      b: { choice: 'no', at: 0, response: 'decline' },
      c: { choice: 'yes', at: 0, response: 'already_moved' },
      d: { at: 0, seenAt: 100 }, // seen, not yet responded
    };
    const s = snap({
      participants: [
        { id: 'a', cohort: 'nerul_rail', lang: 'en', joinedAt: 0 },
        { id: 'b', cohort: 'nerul_rail', lang: 'en', joinedAt: 0 },
        { id: 'c', cohort: 'nerul_rail', lang: 'en', joinedAt: 0 },
        { id: 'd', cohort: 'nerul_rail', lang: 'en', joinedAt: 0 },
      ],
      broadcast: { planId: 'p', sentAt: 0, closesAt: 1000, messages: { nerul_rail: { mr: MSG, hi: MSG, en: MSG } } },
      votes,
    });
    const b = responseBreakdown(s, 500);
    expect(b.nerul_rail).toEqual(expect.objectContaining({ joined: 4, accepted: 1, declined: 1, alreadyMoved: 1, pending: 1, ignored: 0 }));
  });

  it('sumResponseCounts adds every cohort together', () => {
    const s = snap({
      participants: [
        { id: 'a', cohort: 'nerul_rail', lang: 'en', joinedAt: 0 },
        { id: 'b', cohort: 'late_book', lang: 'en', joinedAt: 0 },
      ],
      broadcast: { planId: 'p', sentAt: 0, closesAt: 1000, messages: { nerul_rail: { mr: MSG, hi: MSG, en: MSG }, late_book: { mr: MSG, hi: MSG, en: MSG } } },
      votes: { a: { choice: 'yes', at: 0, response: 'accept' }, b: { choice: 'no', at: 0, response: 'decline' } },
    });
    const b = responseBreakdown(s, 500);
    expect(sumResponseCounts(b)).toEqual(expect.objectContaining({ joined: 2, accepted: 1, declined: 1 }));
  });
});

describe('observedAcceptance — weighted compliance over settled responses only (§11/§17)', () => {
  it('accept and already_moved count as compliant; decline/ignore/too_late do not', () => {
    const votes: Record<string, Vote> = {
      a: { choice: 'yes', at: 0, response: 'accept' },
      b: { choice: 'yes', at: 0, response: 'already_moved' },
      c: { choice: 'no', at: 0, response: 'decline' },
      d: { choice: 'no', at: 0, response: 'too_late' },
    };
    const s = snap({
      participants: ['a', 'b', 'c', 'd'].map((id) => ({ id, cohort: 'nerul_rail', lang: 'en', joinedAt: 0 })),
      broadcast: { planId: 'p', sentAt: 0, closesAt: 1000, messages: { nerul_rail: { mr: MSG, hi: MSG, en: MSG } } },
      votes,
    });
    const b = responseBreakdown(s, 500);
    const { n, rate } = observedAcceptance(b, 'nerul_rail');
    expect(n).toBe(4);
    expect(rate).toBeCloseTo(0.5, 5);
  });

  it('a participant still pending (deadline not reached, no answer) is never counted in n', () => {
    const s = snap({
      participants: [
        { id: 'a', cohort: 'nerul_rail', lang: 'en', joinedAt: 0 },
        { id: 'b', cohort: 'nerul_rail', lang: 'en', joinedAt: 0 },
      ],
      broadcast: { planId: 'p', sentAt: 0, closesAt: 1000, messages: { nerul_rail: { mr: MSG, hi: MSG, en: MSG } } },
      votes: { a: { choice: 'yes', at: 0, response: 'accept' } },
    });
    const b = responseBreakdown(s, 500); // before the deadline, so b (silent) is pending
    const { n } = observedAcceptance(b, 'nerul_rail');
    expect(n).toBe(1);
  });

  it('an unknown cohort returns n=0, rate=0', () => {
    expect(observedAcceptance({}, 'nobody')).toEqual({ n: 0, rate: 0 });
  });
});

describe('responseTiming — median response delay, only over votes with a recorded delay', () => {
  it('computes the median over an odd count', () => {
    const s = snap({ votes: { a: { at: 0, responseDelayMs: 1000 }, b: { at: 0, responseDelayMs: 3000 }, c: { at: 0, responseDelayMs: 2000 } } });
    expect(responseTiming(s)).toEqual({ medianMs: 2000, n: 3 });
  });
  it('ignores votes with no recorded delay', () => {
    const s = snap({ votes: { a: { at: 0 }, b: { at: 0, responseDelayMs: 5000 } } });
    expect(responseTiming(s)).toEqual({ medianMs: 5000, n: 1 });
  });
  it('no timed votes at all -> null', () => {
    expect(responseTiming(snap())).toEqual({ medianMs: null, n: 0 });
  });
});
