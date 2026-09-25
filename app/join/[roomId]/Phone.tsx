'use client';
/*
 * The Room, phone side. No login: an anonymous id in localStorage. The phone becomes one of the
 * people in a cohort. When the control room acts, it buzzes; the choice made here is sent back
 * and replaces the model's guess for that cohort.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Lang } from '@/engine';
import type { PhoneView } from '@/lib/roomTypes';
import { devaDigits } from '@/lib/messages';
import { supabaseBrowser } from '@/lib/supabase';
import { Logo } from '@/components/ui';

const T: Record<Lang, Record<string, string>> = {
  en: {
    pick: 'Choose your language',
    joining: 'Joining room',
    youAre: 'You are one of',
    people: 'people',
    tonight: 'tonight.',
    waiting: 'Waiting for the control room…',
    phones: 'phones in the crowd',
    from: 'Event control',
    closes: 'closes in',
    thanks: 'Sent. Your answer is now part of the simulation.',
    tally: 'said yes so far',
    none: 'No message for your group tonight. Your route is fine.',
    happened: 'What happened to people like you',
    lost: 'This room has ended or the link is wrong.',
    offline: 'Reconnecting…',
  },
  hi: {
    pick: 'अपनी भाषा चुनें',
    joining: 'कमरे से जुड़ रहे हैं',
    youAre: 'आज रात आप',
    people: 'लोगों में से एक हैं',
    tonight: '',
    waiting: 'कंट्रोल रूम का इंतज़ार…',
    phones: 'फ़ोन भीड़ में',
    from: 'इवेंट कंट्रोल',
    closes: 'बंद होगा',
    thanks: 'भेज दिया। आपका जवाब अब सिमुलेशन का हिस्सा है।',
    tally: 'ने अब तक हाँ कहा',
    none: 'आज आपके समूह के लिए कोई संदेश नहीं। आपका रास्ता ठीक है।',
    happened: 'आप जैसे लोगों के साथ क्या हुआ',
    lost: 'यह कमरा बंद हो गया है या लिंक गलत है।',
    offline: 'फिर से जुड़ रहे हैं…',
  },
  mr: {
    pick: 'तुमची भाषा निवडा',
    joining: 'खोलीत सामील होत आहात',
    youAre: 'आज रात्री तुम्ही',
    people: 'लोकांपैकी एक आहात',
    tonight: '',
    waiting: 'कंट्रोल रूमची वाट पाहत आहोत…',
    phones: 'फोन गर्दीत',
    from: 'इव्हेंट कंट्रोल',
    closes: 'बंद होईल',
    thanks: 'पाठवलं. तुमचं उत्तर आता सिम्युलेशनचा भाग आहे.',
    tally: 'जणांनी आतापर्यंत हो म्हटलं',
    none: 'आज तुमच्या गटासाठी संदेश नाही. तुमचा मार्ग ठीक आहे.',
    happened: 'तुमच्यासारख्या लोकांचं काय झालं',
    lost: 'ही खोली बंद झाली आहे किंवा लिंक चुकीची आहे.',
    offline: 'पुन्हा जोडत आहोत…',
  },
};

const BLURB: Record<string, Record<Lang, string>> = {
  nerul_rail: { en: 'on the harbour line into Nerul', hi: 'हार्बर लाइन से नेरुल आ रहे', mr: 'हार्बर लाइनने नेरुळला येणाऱ्या' },
  seawoods_rail: { en: 'on the harbour line into Seawoods', hi: 'हार्बर लाइन से सीवुड्स आ रहे', mr: 'हार्बर लाइनने सीवूड्सला येणाऱ्या' },
  taxi_drop: { en: 'coming by cab to Palm Beach Road', hi: 'कैब से पाम बीच रोड आ रहे', mr: 'कॅबने पाम बीच रोडला येणाऱ्या' },
  late_book: { en: 'who booked late, with no room nearby', hi: 'जिन्होंने देर से बुक किया, पास में कमरा नहीं', mr: 'उशिरा बुकिंग केलेल्या, जवळ खोली नसलेल्या' },
};

function getPid() {
  try {
    let id = localStorage.getItem('pravaah_pid');
    if (!id) {
      id = 'p-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      localStorage.setItem('pravaah_pid', id);
    }
    return id;
  } catch {
    return 'p-' + Math.random().toString(36).slice(2, 12);
  }
}

export default function Phone({ roomId }: { roomId: string }) {
  const [lang, setLang] = useState<Lang | null>(null);
  const [v, setV] = useState<PhoneView | null>(null);
  const [lost, setLost] = useState(false);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const pid = useRef<string>('');
  const buzzed = useRef<number>(0);

  useEffect(() => {
    pid.current = getPid();
    try {
      const l = localStorage.getItem('pravaah_lang') as Lang | null;
      if (l) setLang(l);
    } catch {
      /* ignore */
    }
  }, []);

  const call = useCallback(
    async (body?: Record<string, unknown>) => {
      try {
        const r = body
          ? await fetch(`/api/room/${roomId}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, pid: pid.current }) })
          : await fetch(`/api/room/${roomId}?pid=${encodeURIComponent(pid.current)}`, { cache: 'no-store' });
        if (r.status === 404) {
          setLost(true);
          return;
        }
        const j = (await r.json()) as PhoneView;
        setOffline(false);
        if (j.ok) setV(j);
        else if (!body && lang) call({ action: 'join', lang });
      } catch {
        setOffline(true);
      }
    },
    [roomId, lang],
  );

  useEffect(() => {
    if (!lang) return;
    call({ action: 'join', lang });
    // Realtime, so the buzz and the outcome arrive within tens of milliseconds of the control
    // room acting, not up to a second of polling lag; the poll stays on underneath as a safety
    // net (slower once Realtime is confirmed connected) in case the socket silently drops.
    const sb = supabaseBrowser();
    let i = setInterval(() => call(), sb ? 5000 : 1200);
    // only the room row matters here (the broadcast/outcome arriving) — a phone's own vote is
    // already reflected immediately by the POST response, and it never needs to know about
    // anyone else's vote, so there is no reason to subscribe to the votes table per-phone.
    const ch = sb
      ?.channel(`phone:${roomId}:${pid.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, () => call())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearInterval(i);
          i = setInterval(() => call(), 5000);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearInterval(i);
          i = setInterval(() => call(), 1200);
        }
      });
    const c = setInterval(() => setNow(Date.now()), 250);
    return () => {
      clearInterval(i);
      clearInterval(c);
      ch?.unsubscribe();
    };
  }, [lang, call, roomId]);

  // buzz once per new message
  useEffect(() => {
    const sent = v?.broadcast?.sentAt || 0;
    if (sent && sent !== buzzed.current && v?.broadcast?.message) {
      buzzed.current = sent;
      try {
        navigator.vibrate?.([220, 90, 220, 90, 400]);
      } catch {
        /* ignore */
      }
    }
  }, [v?.broadcast?.sentAt, v?.broadcast?.message]);

  const choose = (l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem('pravaah_lang', l);
    } catch {
      /* ignore */
    }
  };

  const t = T[lang || 'en'];
  const num = (n: number) => (lang === 'mr' ? devaDigits(n.toLocaleString('en-IN')) : n.toLocaleString('en-IN'));
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
          <h1 className="mb-3 text-center font-display text-[38px] leading-tight">You are in the crowd tonight.</h1>
          <div className="mb-1 text-center text-[13px] text-dim">तुमची भाषा निवडा · अपनी भाषा चुनें · Choose your language</div>
          {(
            [
              ['mr', 'मराठी'],
              ['hi', 'हिंदी'],
              ['en', 'English'],
            ] as [Lang, string][]
          ).map(([l, name]) => (
            <button key={l} onClick={() => choose(l)} className="h-16 rounded-2xl border border-line bg-panel-2 text-[20px] font-semibold active:scale-[.98] font-deva">
              {name}
            </button>
          ))}
        </div>
      ) : !v ? (
        <div className="m-auto text-[14px] text-dim">{offline ? t.offline : t.joining + ' ' + roomId + '…'}</div>
      ) : (
        <div className="mt-8 flex flex-1 flex-col gap-5">
          {v.cohort ? (
            <div className="rise">
              <div className="text-[15px] text-dim">{t.youAre}</div>
              <div className="num mt-1 text-[54px] font-semibold leading-none text-brass">{num(v.cohort.size)}</div>
              <div className="mt-2 text-[19px] leading-snug">
                {lang === 'en' ? `${t.people} ${BLURB[v.cohort.id]?.en || v.cohort.blurb} ${t.tonight}` : `${BLURB[v.cohort.id]?.[lang] || v.cohort.label} ${t.people}`}
              </div>
            </div>
          ) : null}

          {v.outcome ? (
            <div className="mt-2 rounded-2xl border border-safe/40 bg-[#112019] p-5 rise">
              <div className="kicker !text-safe">{t.happened}</div>
              <p className="mt-2 text-[17px] leading-relaxed">{v.outcome.text}</p>
              <p className="mt-4 border-t border-safe/20 pt-3 text-[13px] leading-relaxed text-dim">{v.outcome.headline}</p>
            </div>
          ) : v.broadcast ? (
            v.broadcast.message ? (
              <div className="mt-2 rounded-2xl border border-brass bg-[#1d1c14] p-5 rise">
                <div className="flex items-center justify-between">
                  <span className="kicker !mb-0 !text-brass">{t.from}</span>
                  {!v.vote ? (
                    <span className="num text-[13px] text-brass">
                      {t.closes} {num(Math.max(0, Math.ceil((v.broadcast.closesAt - now) / 1000)))}s
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 text-[28px] font-semibold leading-tight">{v.broadcast.message.head}</div>
                <p className="mt-2 text-[17px] leading-relaxed text-dim">{v.broadcast.message.body}</p>
                {!v.vote ? (
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <button onClick={() => call({ action: 'vote', choice: 'yes' })} className="h-16 rounded-xl bg-brass text-[18px] font-semibold text-ink active:scale-[.98]">
                      {v.broadcast.message.yes}
                    </button>
                    <button onClick={() => call({ action: 'vote', choice: 'no' })} className="h-16 rounded-xl border border-line text-[18px] text-text active:scale-[.98]">
                      {v.broadcast.message.no}
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl bg-ink/60 p-4 text-[15px] leading-relaxed">
                    {t.thanks}
                    {v.tally ? (
                      <div className="mt-2 text-[13px] text-dim">
                        {num(v.tally.yes)} / {num(v.tally.yes + v.tally.no)} {t.tally}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-2 rounded-2xl border border-line p-5 text-[16px] leading-relaxed text-dim">{t.none}</div>
            )
          ) : (
            <div className="mt-auto flex flex-col items-center gap-4 pb-10">
              <span className="relative flex size-16 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-brass/20" />
                <span className="size-4 rounded-full bg-brass" />
              </span>
              <div className="text-[15px] text-dim">{t.waiting}</div>
              {v.tally ? (
                <div className="text-[12.5px] text-dimmer">
                  {num(v.tally.people)} {t.phones}
                </div>
              ) : null}
            </div>
          )}
          <div className="mt-auto flex justify-center gap-4 pt-6 text-[12px] text-dimmer">
            {(['mr', 'hi', 'en'] as Lang[]).map((l) => (
              <button key={l} onClick={() => choose(l)} className={l === lang ? 'text-brass' : ''}>
                {l === 'mr' ? 'मराठी' : l === 'hi' ? 'हिंदी' : 'English'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
