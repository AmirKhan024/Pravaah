import { NextResponse } from 'next/server';
import { createRoom } from '@/lib/roomServer';
import type { RoomCohort } from '@/lib/roomTypes';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { cohorts?: RoomCohort[]; scenarioId?: string };
  const cohorts = (body.cohorts || []).filter((c) => c && c.id && c.size > 0).slice(0, 12);
  if (!cohorts.length) return NextResponse.json({ error: 'no cohorts' }, { status: 400 });
  try {
    const r = await createRoom(cohorts, String(body.scenarioId || 'unknown'));
    return NextResponse.json({ id: r.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'createRoom failed' }, { status: 500 });
  }
}
