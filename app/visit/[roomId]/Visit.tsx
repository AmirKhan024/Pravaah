'use client';
/*
 * /visit — a single visitor's own card. No login, mobile-first, at most 4 numbers on screen
 * (party size, and the HH:MM leave-by clock — everything else is words). Reuses the Room's own
 * realtime path (Supabase Realtime on the `rooms` table + a polling fallback) and its offline
 * behaviour (a lost/unreachable room reads plainly, never a blank screen) — see docs/DECISIONS.md
 * for why this rides the existing Room infrastructure instead of a new channel.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Lang } from '@/engine';
import { LANGS } from '@/lib/messages';
import type { RoomSnapshot } from '@/lib/roomTypes';
import { buildVisitCard, hotelOptions, type VisitCard } from '@/lib/visit';
import { supabaseBrowser } from '@/lib/supabase';
import { Logo } from '@/components/ui';

const T: Record<Lang, Record<string, string>> = {
  en: {
    pick: 'Choose your language',
    joining: 'Loading',
    lost: 'This room has ended or the link is wrong.',
    offline: 'Reconnecting…',
    heading: 'Plan your visit',
    comingFrom: 'Coming from',
    mode: 'Travel mode',
    staying: 'Staying overnight?',
    notStaying: 'Not staying overnight',
    partySize: 'How many in your group',
    seeCard: 'Get my card',
    gate: 'Your gate',
    leaveBy: 'Leave by',
    route: 'Route',
    tip: 'Tip',
    redirected: 'Your gate changed — the event has redirected your group.',
    updated: 'Updated just now',
    edit: 'Change my details',
  },
  hi: {
    pick: 'अपनी भाषा चुनें',
    joining: 'लोड हो रहा है',
    lost: 'यह कमरा बंद हो गया है या लिंक गलत है।',
    offline: 'फिर से जुड़ रहे हैं…',
    heading: 'अपनी यात्रा की योजना बनाएं',
    comingFrom: 'कहाँ से आ रहे हैं',
    mode: 'यात्रा का साधन',
    staying: 'रात में कहाँ ठहरेंगे?',
    notStaying: 'रात में नहीं ठहरेंगे',
    partySize: 'आपके समूह में कितने लोग',
    seeCard: 'मेरा कार्ड देखें',
    gate: 'आपका गेट',
    leaveBy: 'इस समय तक निकलें',
    route: 'रास्ता',
    tip: 'सुझाव',
    redirected: 'आपका गेट बदल गया है — आयोजकों ने आपके समूह को दूसरे रास्ते पर भेजा है।',
    updated: 'अभी अपडेट हुआ',
    edit: 'अपनी जानकारी बदलें',
  },
  mr: {
    pick: 'तुमची भाषा निवडा',
    joining: 'लोड होत आहे',
    lost: 'ही खोली बंद झाली आहे किंवा लिंक चुकीची आहे.',
    offline: 'पुन्हा जोडत आहोत…',
    heading: 'तुमच्या भेटीचं नियोजन करा',
    comingFrom: 'कुठून येत आहात',
    mode: 'प्रवासाचं साधन',
    staying: 'रात्री कुठे राहणार?',
    notStaying: 'रात्री राहणार नाही',
    partySize: 'तुमच्या गटात किती जण',
    seeCard: 'माझं कार्ड पाहा',
    gate: 'तुमचं गेट',
    leaveBy: 'या वेळेपर्यंत निघा',
    route: 'मार्ग',
    tip: 'सूचना',
    redirected: 'तुमचं गेट बदललं आहे — आयोजकांनी तुमचा गट दुसऱ्या मार्गाने पाठवला आहे.',
    updated: 'आत्ताच अपडेट झालं',
    edit: 'माझी माहिती बदला',
  },
};

export default function Visit({ roomId }: { roomId: string }) {
  const [lang, setLang] = useState<Lang | null>(null);
  const [snap, setSnap] = useState<RoomSnapshot | null>(null);
  const [lost, setLost] = useState(false);
  const [offline, setOffline] = useState(false);
  const [originId, setOriginId] = useState('');
  const [mode, setMode] = useState('');
  const [stayingHotelId, setStayingHotelId] = useState<string | null>(null);
  const [partySize, setPartySize] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const buzzed = useRef<number>(0);

  const call = useCallback(async () => {
    try {
      const r = await fetch(`/api/room/${roomId}`, { cache: 'no-store' });
      if (r.status === 404) {
        setLost(true);
        return;
      }
      const j = (await r.json()) as RoomSnapshot & { ok?: boolean };
      if (j.ok === false) {
        setLost(true);
        return;
      }
      setOffline(false);
      setSnap(j);
    } catch {
      setOffline(true);
    }
  }, [roomId]);

  useEffect(() => {
    call();
    const sb = supabaseBrowser();
    let i = setInterval(call, sb ? 5000 : 1200);
    const ch = sb
      ?.channel(`visit:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, () => call())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearInterval(i);
          i = setInterval(call, 5000);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearInterval(i);
          i = setInterval(call, 1200);
        }
      });
    return () => {
      clearInterval(i);
      ch?.unsubscribe();
    };
  }, [call, roomId]);

  const origin = snap?.origins.find((o) => o.id === originId) || null;
  const hotels = snap ? hotelOptions(snap.origins) : [];
  const card: VisitCard | null = snap && origin && lang ? buildVisitCard(snap, { lang, originId, mode: mode || origin.transportMode, stayingHotelId, partySize }) : null;

  // buzz once per new plan, once the card is actually showing
  useEffect(() => {
    const at = snap?.plan?.approvedAt || 0;
    if (submitted && at && at !== buzzed.current) {
      buzzed.current = at;
      try {
        navigator.vibrate?.([220, 90, 220, 90, 400]);
      } catch {
        /* ignore */
      }
    }
  }, [snap?.plan?.approvedAt, submitted]);

  const t = T[lang || 'en'];
  const deva = lang && lang !== 'en' ? 'font-deva' : '';

  return (
    <div className={`flex min-h-dvh flex-col bg-ink px-5 pb-8 pt-6 ${deva}`}>
      <div className="flex items-center gap-2 text-brass">
        <Logo className="size-6" />
        <span className="text-[13px] font-semibold tracking-[0.2em] text-text">PRAVAAH</span>
        <span className="num ml-auto text-[11px] text-dimmer">{roomId}</span>
      </div>

      {lost ? (
        <div className="m-auto text-center text-[15px] text-dim">{t.lost}</div>
      ) : !lang ? (
        <div className="m-auto flex w-full max-w-[360px] flex-col gap-3 rise">
          <h1 className="mb-3 text-center font-display text-[34px] leading-tight">Plan your visit</h1>
          <div className="mb-1 text-center text-[13px] text-dim">तुमची भाषा निवडा · अपनी भाषा चुनें · Choose your language</div>
          {LANGS.map((l) => (
            <button key={l.id} onClick={() => setLang(l.id)} className="h-16 rounded-2xl border border-line bg-panel-2 text-[20px] font-semibold active:scale-[.98] font-deva">
              {l.native}
            </button>
          ))}
        </div>
      ) : !snap ? (
        <div className="m-auto text-[14px] text-dim">{offline ? t.offline : t.joining + '…'}</div>
      ) : !submitted ? (
        <div className="m-auto flex w-full max-w-[380px] flex-col gap-4 rise">
          <h1 className="text-center font-display text-[30px] leading-tight">{t.heading}</h1>
          <label className="flex flex-col gap-1.5 text-[13px] text-dim">
            {t.comingFrom}
            <select
              className="h-12 rounded-xl border border-line bg-panel-2 px-3 text-[15px] text-text"
              value={originId}
              onChange={(e) => {
                setOriginId(e.target.value);
                setMode('');
              }}
            >
              <option value="">—</option>
              {snap.origins.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.originLabel}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] text-dim">
            {t.mode}
            <input
              className="h-12 rounded-xl border border-line bg-panel-2 px-3 text-[15px] text-text"
              value={mode || origin?.transportMode || ''}
              onChange={(e) => setMode(e.target.value)}
              placeholder={origin?.transportMode || ''}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] text-dim">
            {t.staying}
            <select className="h-12 rounded-xl border border-line bg-panel-2 px-3 text-[15px] text-text" value={stayingHotelId || ''} onChange={(e) => setStayingHotelId(e.target.value || null)}>
              <option value="">{t.notStaying}</option>
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.originLabel}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] text-dim">
            {t.partySize}
            <input
              type="number"
              min={1}
              max={12}
              className="num h-12 rounded-xl border border-line bg-panel-2 px-3 text-[15px] text-text"
              value={partySize}
              onChange={(e) => setPartySize(Math.max(1, Math.min(12, Math.round(Number(e.target.value) || 1))))}
            />
          </label>
          <button
            onClick={() => setSubmitted(true)}
            disabled={!originId}
            className="h-16 rounded-2xl bg-brass text-[18px] font-semibold text-ink active:scale-[.98] disabled:opacity-40"
          >
            {t.seeCard}
          </button>
        </div>
      ) : card ? (
        <div className="m-auto flex w-full max-w-[380px] flex-col gap-4 rise">
          {card.redirected ? <div className="rounded-xl border border-brass-dim/60 bg-[#1d1c14] p-3 text-center text-[13.5px] text-brass">{t.redirected}</div> : null}
          <div className="flex flex-col rounded-2xl border border-line bg-panel-2 p-5">
            <div className="flex items-baseline justify-between border-b border-line-soft/60 py-3">
              <span className="text-dim">{t.gate}</span>
              <span className="num text-[22px] font-semibold">{card.gateName}</span>
            </div>
            <div className="flex items-baseline justify-between border-b border-line-soft/60 py-3">
              <span className="text-dim">{t.leaveBy}</span>
              <span className="num text-[22px] font-semibold text-brass">{card.leaveBy}</span>
            </div>
            <div className="flex flex-col gap-1 border-b border-line-soft/60 py-3">
              <span className="text-[12px] text-dimmer">{t.route}</span>
              <span className="text-[14px]">{card.route}</span>
            </div>
            <div className="flex flex-col gap-1 pt-3">
              <span className="text-[12px] text-dimmer">{t.tip}</span>
              <span className="text-[14px]">{card.tip}</span>
            </div>
          </div>
          <p className="text-center text-[11px] text-dimmer">{snap.plan?.approvedAt ? t.updated : ''}</p>
          <button onClick={() => setSubmitted(false)} className="h-11 rounded-xl border border-line text-[13px] text-dim">
            {t.edit}
          </button>
        </div>
      ) : (
        <div className="m-auto text-[14px] text-dim">{t.joining}…</div>
      )}
    </div>
  );
}
