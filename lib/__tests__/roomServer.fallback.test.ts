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
    const { usingSupabase, createRoom, join, markSeen, vote, setBroadcast, snapshot, phoneView } = await import('../roomServer');
    expect(usingSupabase()).toBe(false);

    const cohorts = [{ id: 'nerul_rail', label: 'Nerul', size: 100, blurb: '' }];
    const { id } = await createRoom(cohorts, 'dyPatil');
    expect(id).toMatch(/^[A-Z]+-\d{3}$/);

    const p = await join(id, 'p1', 'en');
    expect(p?.cohort).toBe('nerul_rail');
    // deterministic per-pid group size (§12), always in range
    expect(p?.groupSize).toBeGreaterThanOrEqual(1);
    expect(p?.groupSize).toBeLessThanOrEqual(4);

    await setBroadcast(id, { planId: 'x', closesAt: Date.now() + 1000, messages: { nerul_rail: { mr: { head: 'h', body: 'b', yes: 'y', no: 'n' }, hi: { head: 'h', body: 'b', yes: 'y', no: 'n' }, en: { head: 'h', body: 'b', yes: 'y', no: 'n' } } } });

    await markSeen(id, 'p1');
    const seenOnly = await phoneView(id, 'p1');
    // a "seen" placeholder is not yet a vote — the phone shouldn't see one, and it shouldn't count
    expect(seenOnly.vote).toBeNull();
    expect(seenOnly.tally).toEqual({ yes: 0, no: 0, people: 1 });

    const ok = await vote(id, 'p1', 'accept', 'all');
    expect(ok).toBe(true);

    const snap = await snapshot(id);
    expect(snap?.votes['p1']).toEqual(expect.objectContaining({ choice: 'yes', response: 'accept', groupResponse: 'all' }));
    // seenAt (recorded by markSeen) carries through, so the response has a real, positive delay
    expect(snap?.votes['p1'].responseDelayMs).toBeGreaterThanOrEqual(0);

    const view = await phoneView(id, 'p1');
    expect(view.ok).toBe(true);
    expect(view.vote).toEqual(expect.objectContaining({ response: 'accept' }));
    expect(view.tally).toEqual({ yes: 1, no: 0, people: 1 });
  });

  it('a response after the broadcast closes is reclassified as too_late, never trusting the client', async () => {
    const { createRoom, join, vote, setBroadcast, snapshot } = await import('../roomServer');
    const cohorts = [{ id: 'nerul_rail', label: 'Nerul', size: 100, blurb: '' }];
    const { id } = await createRoom(cohorts, 'dyPatil');
    await join(id, 'p2', 'en');
    await setBroadcast(id, { planId: 'x', closesAt: Date.now() - 1, messages: { nerul_rail: { mr: { head: 'h', body: 'b', yes: 'y', no: 'n' }, hi: { head: 'h', body: 'b', yes: 'y', no: 'n' }, en: { head: 'h', body: 'b', yes: 'y', no: 'n' } } } });
    await vote(id, 'p2', 'accept');
    const snap = await snapshot(id);
    expect(snap?.votes['p2'].response).toBe('too_late');
  });
});
