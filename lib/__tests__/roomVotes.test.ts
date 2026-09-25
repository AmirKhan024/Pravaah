import { describe, expect, it } from 'vitest';
import { tallyByCohort, tallyVotes, votableParticipantIds } from '../roomVotes';
import type { RoomSnapshot } from '../roomTypes';

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
