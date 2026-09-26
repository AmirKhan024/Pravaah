import { NextResponse } from 'next/server';
import { createRoom } from '@/lib/roomServer';
import type { RoomCohort, VisitOrigin } from '@/lib/roomTypes';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { cohorts?: RoomCohort[]; scenarioId?: string; t0Min?: number; origins?: VisitOrigin[]; baseGateWaitPeak?: Record<string, number> };
  const cohorts = (body.cohorts || []).filter((c) => c && c.id && c.size > 0).slice(0, 12);
  if (!cohorts.length) return NextResponse.json({ error: 'no cohorts' }, { status: 400 });
  const origins = (body.origins || []).filter((o) => o && o.id).slice(0, 20);
  try {
    const r = await createRoom(cohorts, String(body.scenarioId || 'unknown'), Number(body.t0Min) || 0, origins, body.baseGateWaitPeak || {});
    return NextResponse.json({ id: r.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'createRoom failed' }, { status: 500 });
  }
}
