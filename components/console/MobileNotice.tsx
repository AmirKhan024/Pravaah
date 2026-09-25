'use client';
/*
 * Phase 6: replaces the bare "built for a big screen" dead end. The console still never attempts
 * to render at phone width (that part is unchanged and correct — it's a real control room, not a
 * responsive layout problem to solve) — this just gives a phone-holding visitor somewhere useful
 * to go: a QR code for the console's own URL (scan it from a laptop, or forward the link), a
 * one-line preview of what they'd see there, and a way into The Room if one is already open.
 */
import QRCode from 'qrcode';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSlice } from '@/lib/createStore';
import { roomStore } from '@/lib/room';
import { Logo } from '@/components/ui';

export default function MobileNotice() {
  const [qr, setQr] = useState('');
  const [href, setHref] = useState('');
  const room = useSlice(roomStore, (r) => ({ id: r.id, url: r.url, offline: r.offline }));
  const joinable = room.id && !room.offline && room.url;

  useEffect(() => {
    const url = window.location.href;
    setHref(url);
    QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: '#101715', light: '#DCE5E1' } }).then(setQr);
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center gap-5 overflow-y-auto bg-ink px-6 py-10 text-center min-[900px]:hidden">
      <div className="flex items-center gap-2 text-brass">
        <Logo className="size-6" />
        <span className="text-[13px] font-semibold tracking-[0.2em] text-text">PRAVAAH</span>
      </div>

      <div className="mt-2 font-display text-[26px] leading-tight">The console is built for a big screen.</div>
      <p className="max-w-[360px] text-[13.5px] leading-relaxed text-dim">
        It&apos;s the organiser&apos;s control room: a live map, a five-step rehearsal, the Decision Clock, Red Team, the Black Box. Scan this on a laptop to open it there, or send the link to whoever&apos;s running the console.
      </p>

      {qr ? <img src={qr} alt="QR code for this console's URL" className="size-44 rounded-2xl" /> : <div className="size-44 animate-pulse rounded-2xl bg-panel-2" />}
      {href ? <div className="num max-w-[300px] truncate text-[11px] text-dimmer">{href}</div> : null}

      <div className="mt-2 flex w-full max-w-[300px] flex-col gap-2">
        {joinable ? (
          <Link href={`/join/${room.id}`} className="rounded-lg bg-brass px-4 py-2.5 text-[14px] font-semibold text-ink">
            Join The Room instead →
          </Link>
        ) : null}
        <Link href="/" className="rounded-lg border border-brass-dim px-4 py-2.5 text-[14px] text-brass">
          Back to the start
        </Link>
      </div>

      {joinable ? <p className="max-w-[300px] text-[11.5px] leading-relaxed text-dimmer">There&apos;s a room open right now — join it to become part of the crowd, from this phone.</p> : null}
    </div>
  );
}
