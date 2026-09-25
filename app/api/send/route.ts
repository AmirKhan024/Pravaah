import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Real delivery (SOURCE_OF_TRUTH §8.7): one SMS via Twilio, if configured. */
export async function POST(req: Request) {
  const { to, text } = (await req.json().catch(() => ({}))) as { to?: string; text?: string };
  const sid = process.env.TWILIO_ACCOUNT_SID,
    tok = process.env.TWILIO_AUTH_TOKEN,
    from = process.env.TWILIO_FROM;
  if (!sid || !tok || !from || process.env.NEXT_PUBLIC_DEMO_OFFLINE === '1') return NextResponse.json({ ok: false, reason: 'SMS is not configured on this machine' }, { status: 501 });
  const num = String(to || '').replace(/[^+0-9]/g, '');
  if (!/^\+?[0-9]{10,15}$/.test(num) || !text) return NextResponse.json({ ok: false, reason: 'bad number' }, { status: 400 });
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { authorization: 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: num.startsWith('+') ? num : '+91' + num, From: from, Body: String(text).slice(0, 600) }),
  });
  return NextResponse.json({ ok: r.ok }, { status: r.ok ? 200 : 502 });
}
