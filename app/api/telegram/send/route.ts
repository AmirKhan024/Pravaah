import { NextResponse } from 'next/server';
import { sendTelegramMessage, telegramConfigured } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

/** Staff/transport/accommodation orders only — never crowd messages (see lib/telegram.ts). */
export async function POST(req: Request) {
  if (!telegramConfigured()) return NextResponse.json({ ok: false, reason: 'Telegram is not configured on this machine.' }, { status: 501 });
  const { kind, title, text } = (await req.json().catch(() => ({}))) as { kind?: string; title?: string; text?: string };
  if (!text || typeof text !== 'string') return NextResponse.json({ ok: false, reason: 'nothing to send' }, { status: 400 });
  const header = kind && title ? `📋 ${kind.toUpperCase()}\n${title}\n\n` : '';
  const r = await sendTelegramMessage(header + text.slice(0, 3900));
  if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason }, { status: 502 });
  return NextResponse.json({ ok: true, messageId: r.messageId, sentAt: Date.now() });
}
