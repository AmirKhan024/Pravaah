/*
 * Live Ops's one-word status band is derived entirely from state that already exists
 * (decisionDeadline(), the same ≤15min "urgent" threshold DecisionClock.tsx uses). This pins the
 * branching so the word and the full console's countdown can never silently start disagreeing.
 */
import { describe, expect, it } from 'vitest';
import { opsStatus } from '../console';
import type { BoardOption } from '@/engine';

// a minimal fake of the one slice of ConsoleState opsStatus()/decisionDeadline() actually read
function state(overrides: Record<string, unknown>) {
  return {
    board: null as BoardOption[] | null,
    approved: null,
    replan: null,
    replanBusy: false,
    expired: [] as string[],
    tick: 0,
    ...overrides,
  } as never; // ConsoleState is large; opsStatus only touches these fields
}

const option = (over: Partial<BoardOption> = {}): BoardOption => ({ id: 'brd_0', label: 'Tell Nerul arrivals that Gate 5 is empty', iv: {} as never, deadlineTick: 300, useless: false, tested: 12, worstLabels: [], curves: [], ...over });

describe('opsStatus()', () => {
  it('calm before any board exists', () => {
    expect(opsStatus(state({ board: null }))).toBe('calm');
  });
  it('calm once approved, regardless of anything else', () => {
    expect(opsStatus(state({ approved: { tick: 100 }, board: [option({ deadlineTick: 50 })], tick: 200 }))).toBe('calm');
  });
  it('act now while re-planning after a window closed', () => {
    expect(opsStatus(state({ replanBusy: true, board: [option()] }))).toBe('act');
    expect(opsStatus(state({ replan: { chosen: [] }, board: [option()] }))).toBe('act');
  });
  it('watch when the earliest open deadline is more than 15 minutes away', () => {
    expect(opsStatus(state({ board: [option({ deadlineTick: 220 })], tick: 200 }))).toBe('watch');
  });
  it('act now when the earliest open deadline is 15 minutes or less away', () => {
    expect(opsStatus(state({ board: [option({ deadlineTick: 210 })], tick: 200 }))).toBe('act');
    expect(opsStatus(state({ board: [option({ deadlineTick: 200 })], tick: 200 }))).toBe('act');
  });
  it('calm when every board option is useless (nothing time-sensitive)', () => {
    expect(opsStatus(state({ board: [option({ useless: true })], tick: 200 }))).toBe('calm');
  });
  it('ignores an already-expired option when picking the earliest deadline', () => {
    const s = state({
      board: [option({ id: 'a', label: 'X', deadlineTick: 205 }), option({ id: 'b', label: 'Y', deadlineTick: 400 })],
      expired: ['X'],
      tick: 200,
    });
    expect(opsStatus(s)).toBe('watch'); // only Y's (far) deadline is still open
  });
});
