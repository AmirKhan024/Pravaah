/*
 * Confirms the offline fallback (Phase 2 §5): with NEXT_PUBLIC_DEMO_OFFLINE=1, the Room facade
 * must use the in-memory backend and function completely, without ever touching Supabase.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

describe('roomServer facade — offline fallback', () => {
  const prev = process.env.NEXT_PUBLIC_DEMO_OFFLINE;
  beforeAll(() => {
    process.env.NEXT_PUBLIC_DEMO_OFFLINE = '1';
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_DEMO_OFFLINE = prev;
  });

  it('a full room lifecycle works end-to-end with Supabase forced off', async () => {
    const { usingSupabase, createRoom, join, vote, setBroadcast, snapshot, phoneView } = await import('../roomServer');
    expect(usingSupabase()).toBe(false);

    const cohorts = [{ id: 'nerul_rail', label: 'Nerul', size: 100, blurb: '' }];
    const { id } = await createRoom(cohorts, 'dyPatil');
    expect(id).toMatch(/^[A-Z]+-\d{3}$/);

    const p = await join(id, 'p1', 'en');
    expect(p?.cohort).toBe('nerul_rail');

    await setBroadcast(id, { planId: 'x', closesAt: Date.now() + 1000, messages: { nerul_rail: { mr: { head: 'h', body: 'b', yes: 'y', no: 'n' }, hi: { head: 'h', body: 'b', yes: 'y', no: 'n' }, en: { head: 'h', body: 'b', yes: 'y', no: 'n' } } } });
    const ok = await vote(id, 'p1', 'yes');
    expect(ok).toBe(true);

    const snap = await snapshot(id);
    expect(snap?.votes['p1']).toEqual(expect.objectContaining({ choice: 'yes' }));

    const view = await phoneView(id, 'p1');
    expect(view.ok).toBe(true);
    expect(view.tally).toEqual({ yes: 1, no: 0, people: 1 });
  });
});
