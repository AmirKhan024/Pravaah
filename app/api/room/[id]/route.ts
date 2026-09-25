import { NextResponse } from 'next/server';
import { getRoom, join, phoneView, reset, setBroadcast, setOutcome, snapshot, vote } from '@/lib/roomServer';
import type { Lang } from '@/engine';
import type { RoomBroadcast, RoomOutcome } from '@/lib/roomTypes';

export const dynamic = 'force-dynamic';

const LANGS: Lang[] = ['mr', 'hi', 'en'];
const lang = (l: unknown): Lang => (LANGS.includes(l as Lang) ? (l as Lang) : 'en');

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = getRoom(id);
  if (!r) return NextResponse.json({ ok: false, error: 'no such room' }, { status: 404 });
  const pid = new URL(req.url).searchParams.get('pid');
  return NextResponse.json(pid ? phoneView(r, pid) : snapshot(r), { headers: { 'cache-control': 'no-store' } });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = getRoom(id);
  if (!r) return NextResponse.json({ ok: false, error: 'no such room' }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  switch (b.action) {
    case 'join': {
      if (typeof b.pid !== 'string' || b.pid.length > 64) return NextResponse.json({ ok: false }, { status: 400 });
      join(r, b.pid, lang(b.lang), !!b.simulated);
      return NextResponse.json(phoneView(r, b.pid));
    }
    case 'vote': {
      if (typeof b.pid !== 'string') return NextResponse.json({ ok: false }, { status: 400 });
      const ok = vote(r, b.pid, b.choice === 'yes' ? 'yes' : 'no');
      return NextResponse.json({ ...phoneView(r, b.pid), ok });
    }
    case 'broadcast': {
      const bc = b.broadcast as Omit<RoomBroadcast, 'sentAt'>;
      if (!bc || !bc.messages) return NextResponse.json({ ok: false }, { status: 400 });
      setBroadcast(r, bc);
      return NextResponse.json(snapshot(r));
    }
    case 'outcome': {
      setOutcome(r, b.outcome as RoomOutcome);
      return NextResponse.json(snapshot(r));
    }
    case 'reset': {
      reset(r);
      return NextResponse.json(snapshot(r));
    }
  }
  return NextResponse.json({ ok: false, error: 'unknown action' }, { status: 400 });
}
