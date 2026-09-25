import { NextResponse } from 'next/server';
import { createRoom } from '@/lib/roomServer';
import type { RoomCohort } from '@/lib/roomTypes';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { cohorts?: RoomCohort[] };
  const cohorts = (body.cohorts || []).filter((c) => c && c.id && c.size > 0).slice(0, 12);
  if (!cohorts.length) return NextResponse.json({ error: 'no cohorts' }, { status: 400 });
  const r = createRoom(cohorts);
  return NextResponse.json({ id: r.id });
}
