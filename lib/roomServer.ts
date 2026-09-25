import 'server-only';
/*
 * The Room — server facade (Phase 2). Dispatches to the Supabase backend when configured, else
 * falls back to the original in-memory backend automatically (SOURCE_OF_TRUTH §14.7 / this pass's
 * brief §Phase 2.5) — the demo must never fully break because Supabase is unreachable.
 *
 * Every function here is async (Supabase is network I/O); callers pass a room id string, not a
 * long-lived handle, so there's nothing to go stale across awaits or serverless instances.
 */
import type { Lang } from '@/engine';
import { supabaseConfigured } from './supabase';
import * as mem from './roomServer.memory';
import * as sb from './roomServer.supabase';
import type { Participant, PhoneView, RoomBroadcast, RoomCohort, RoomOutcome, RoomSnapshot } from './roomTypes';

function backend() {
  return supabaseConfigured() ? sb : mem;
}

export function usingSupabase(): boolean {
  return supabaseConfigured();
}

export const createRoom = (cohorts: RoomCohort[], scenarioId: string): Promise<{ id: string }> => backend().createRoom(cohorts, scenarioId);
export const roomExists = (id: string): Promise<boolean> => backend().roomExists(id);
export const join = (id: string, pid: string, lang: Lang, simulated = false): Promise<Participant | null> => backend().join(id, pid, lang, simulated);
export const vote = (id: string, pid: string, choice: 'yes' | 'no'): Promise<boolean> => backend().vote(id, pid, choice);
export const setBroadcast = (id: string, b: Omit<RoomBroadcast, 'sentAt'>): Promise<void> => backend().setBroadcast(id, b);
export const setOutcome = (id: string, o: RoomOutcome): Promise<void> => backend().setOutcome(id, o);
export const reset = (id: string): Promise<void> => backend().reset(id);
export const snapshot = (id: string): Promise<RoomSnapshot | null> => backend().snapshot(id);
export const phoneView = (id: string, pid: string): Promise<PhoneView> => backend().phoneView(id, pid);
