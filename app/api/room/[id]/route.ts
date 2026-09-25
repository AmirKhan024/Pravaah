import { NextResponse } from 'next/server';
import { join, phoneView, reset, roomExists, setBroadcast, setOutcome, snapshot, vote } from '@/lib/roomServer';
import type { Lang } from '@/engine';
import type { RoomBroadcast, RoomOutcome } from '@/lib/roomTypes';

export const dynamic = 'force-dynamic';

const LANGS: Lang[] = ['mr', 'hi', 'en'];
const lang = (l: unknown): Lang => (LANGS.includes(l as Lang) ? (l as Lang) : 'en');

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const pid = new URL(req.url).searchParams.get('pid');
  try {
    if (pid) {
      const v = await phoneView(id, pid);
      return NextResponse.json(v, { headers: { 'cache-control': 'no-store' } });
    }
    const s = await snapshot(id);
    if (!s) return NextResponse.json({ ok: false, error: 'no such room' }, { status: 404 });
    return NextResponse.json(s, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'room lookup failed' }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    switch (b.action) {
      case 'join': {
        if (typeof b.pid !== 'string' || b.pid.length > 64) return NextResponse.json({ ok: false }, { status: 400 });
        const p = await join(id, b.pid, lang(b.lang), !!b.simulated);
        if (!p) return NextResponse.json({ ok: false, error: 'no such room' }, { status: 404 });
        return NextResponse.json(await phoneView(id, b.pid));
      }
      case 'vote': {
        if (typeof b.pid !== 'string') return NextResponse.json({ ok: false }, { status: 400 });
        const ok = await vote(id, b.pid, b.choice === 'yes' ? 'yes' : 'no');
        return NextResponse.json({ ...(await phoneView(id, b.pid)), ok });
      }
      case 'broadcast': {
        const bc = b.broadcast as Omit<RoomBroadcast, 'sentAt'>;
        if (!bc || !bc.messages) return NextResponse.json({ ok: false }, { status: 400 });
        if (!(await roomExists(id))) return NextResponse.json({ ok: false, error: 'no such room' }, { status: 404 });
        await setBroadcast(id, bc);
        return NextResponse.json(await snapshot(id));
      }
      case 'outcome': {
        if (!(await roomExists(id))) return NextResponse.json({ ok: false, error: 'no such room' }, { status: 404 });
        await setOutcome(id, b.outcome as RoomOutcome);
        return NextResponse.json(await snapshot(id));
      }
      case 'reset': {
        if (!(await roomExists(id))) return NextResponse.json({ ok: false, error: 'no such room' }, { status: 404 });
        await reset(id);
        return NextResponse.json(await snapshot(id));
      }
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'room action failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: false, error: 'unknown action' }, { status: 400 });
}
