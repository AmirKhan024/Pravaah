'use client';
/*
 * The order cards themselves (crowd message + staff/transport/accommodation/food), extracted from
 * the Guide step so the exact same component — same buttons, same Telegram/SMS/PA logic — can be
 * reused verbatim in Guide's own "Orders" tab and in Live Ops's "Orders sent" panel. Nothing here
 * is duplicated between those two call sites; there is exactly one implementation.
 */
import { useState } from 'react';
import { useSlice } from '@/lib/createStore';
import { log, markOrderSent, orderSentAt, store, toast } from '@/lib/console';
import { buildOrders, LANGS, nudgeVars, paText, type OrderCard } from '@/lib/messages';
import { speak } from '@/lib/speak';
import type { Intervention, Lang, Scenario, SimResult } from '@/engine';
import { Button, cx } from '@/components/ui';

export const ORDER_KIND: Record<OrderCard['kind'], string> = { crowd: 'Message to the crowd', staff: 'Staff order', transport: 'Transport order', accommodation: 'Accommodation order', food: 'Food & services' };

export function copyText(text: string) {
  navigator.clipboard?.writeText(text).then(
    () => toast('Copied. Ready to send.'),
    () => toast('Could not copy. Select the text by hand.'),
  );
}

function CrowdCard({ card }: { card: OrderCard }) {
  const s = useSlice(store, (s) => ({ scn: s.scn, res: s.approved?.result, ivs: s.approved?.ivs }));
  const [lang, setLang] = useState<Lang>('mr');
  const [polished, setPolished] = useState<Partial<Record<Lang, string>>>({});
  const [busy, setBusy] = useState(false);
  const base = card.langs!.find((l) => l.lang === lang)!.text;
  const text = polished[lang] || base;
  const iv = s.ivs?.find((x) => x.type === 'nudge' && x.cohort === card.cohort) as { rupees: number; delta?: number } | undefined;
  const v = s.res && card.cohort ? nudgeVars(s.scn, card.cohort, s.res, iv?.rupees || 0, iv?.delta) : null;
  const polish = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/llm/polish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: base, lang }) }).then((x) => x.json());
      if (r.ok) {
        setPolished((p) => ({ ...p, [lang]: r.text }));
        toast('Re-worded. Every number is still the engine’s.');
      } else toast(r.reason === 'offline' ? 'Offline: using the fixed template.' : 'Kept the template: ' + (r.reason || 'no change'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-xl border border-line bg-panel-2/60 p-4">
      <div className="kicker mb-1">{ORDER_KIND.crowd}</div>
      <div className="text-[14px] font-semibold leading-snug">{card.title}</div>
      {card.sub ? <div className="mt-1 text-[12px] text-dim">{card.sub}</div> : null}
      <div className="mt-3 flex gap-1">
        {LANGS.map((l) => (
          <button key={l.id} onClick={() => setLang(l.id)} className={cx('rounded-md px-2.5 py-1 text-[12px]', lang === l.id ? 'bg-ink text-brass' : 'text-dim hover:text-text')}>
            {l.native}
          </button>
        ))}
      </div>
      <div className={cx('mt-2 rounded-lg border border-line-soft bg-ink/70 px-3 py-2.5 text-[15px] leading-relaxed', lang !== 'en' && 'font-deva')}>{text}</div>
      {polished[lang] ? <div className="mt-1 text-[10.5px] text-dimmer">re-worded by the language model · numbers locked and re-inserted from the simulation</div> : null}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button
          size="sm"
          onClick={() => {
            if (!v) return;
            const r = speak(paText(lang, v), lang);
            toast(r.ok ? `Playing on the PA${r.voice ? ' · ' + r.voice : ''}` : 'This browser has no speech engine.');
          }}
        >
          ▶ Play on the PA
        </Button>
        <Button size="sm" onClick={() => copyText(text)}>
          Copy
        </Button>
        <Button size="sm" variant="quiet" disabled={busy} onClick={polish}>
          {busy ? 'Re-wording…' : 'Re-word for the PA'}
        </Button>
        <SmsButton text={text} />
      </div>
    </div>
  );
}

export interface TelegramSendOutcome {
  ok: boolean;
  at?: string;
  reason?: string;
}

/**
 * The one place an order actually gets sent to Telegram. Used by the button below (Guide/Orders
 * tab) and by Live Ops's one-click Approve (which sends automatically, no separate button) — both
 * call this, so there is exactly one fetch/log implementation, not two.
 */
export async function sendOrderToTelegram(kind: string, title: string, text: string): Promise<TelegramSendOutcome> {
  try {
    const r = await fetch('/api/telegram/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, title, text }) }).then((x) => x.json());
    if (r.ok) {
      const d = new Date(r.sentAt);
      const at = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); // 24h, matching the app's clock everywhere else
      log('orders_sent', `Sent "${title}" to the ops Telegram channel.`, { kind, chars: text.length });
      markOrderSent(title, at); // one shared record — every surface showing this order now knows it's sent
      return { ok: true, at };
    }
    return { ok: false, reason: r.reason || 'Telegram send failed' };
  } catch {
    return { ok: false, reason: 'Could not reach the server' };
  }
}

/** Staff/transport/accommodation/food orders only — never the crowd message card, which keeps its own Copy/PA/SMS buttons. */
export function TelegramButton({ kind, title, text, onSent }: { kind: string; title: string; text: string; onSent?: () => void }) {
  // "already sent" is read from the shared store (lib/console.ts's sentOrders), not local state —
  // so a send that happened elsewhere (e.g. Live Ops's one-click Approve) is reflected here too,
  // and this button can never fire a second, duplicate send for the same order.
  const alreadySentAt = useSlice(store, (s) => s.sentOrders[title]);
  const [state, setState] = useState<{ s: 'idle' | 'sending' | 'error'; detail?: string }>({ s: 'idle' });
  const send = async () => {
    setState({ s: 'sending' });
    const r = await sendOrderToTelegram(kind, title, text);
    if (r.ok) onSent?.();
    else setState({ s: 'error', detail: r.reason });
  };
  if (alreadySentAt)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-safe/10 px-2.5 py-1.5 text-[12.5px] text-safe">
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
          <path d="M3 8.5l3.2 3L13 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Sent to ops · {alreadySentAt}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5">
      <Button size="sm" variant="quiet" disabled={state.s === 'sending'} onClick={send}>
        {state.s === 'sending' ? 'Sending…' : 'Send to Telegram'}
      </Button>
      {state.s === 'error' ? <span className="text-[11.5px] text-danger-soft">{state.detail}</span> : null}
    </span>
  );
}

export function SmsButton({ text }: { text: string }) {
  const send = async () => {
    const to = window.prompt('Send this as an SMS to (a volunteer’s number, e.g. +91…):');
    if (!to) return;
    const r = await fetch('/api/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to, text }) })
      .then((x) => x.json())
      .catch(() => ({ ok: false }));
    if (r.ok) {
      toast('Sent.');
      log('orders_sent', 'Sent one SMS to a volunteer’s phone.', { chars: text.length });
    } else {
      copyText(text);
      toast((r.reason || 'SMS failed') + '. Copied instead.');
    }
  };
  return (
    <Button size="sm" variant="quiet" onClick={send}>
      Send SMS
    </Button>
  );
}

/** One order card, staff/transport/accommodation/food — the non-crowd render path, reusable on its own. */
export function OrderCardView({ card, onSent }: { card: OrderCard; onSent?: () => void }) {
  return (
    <div className="rounded-xl border border-line bg-panel-2/60 p-4">
      <div className="kicker mb-1">{ORDER_KIND[card.kind]}</div>
      <div className="text-[14px] font-semibold leading-snug">{card.title}</div>
      <div className="mt-1.5 text-[13px] leading-relaxed text-dim">{card.body}</div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Button size="sm" onClick={() => copyText(card.body || '')}>
          Copy
        </Button>
        <SmsButton text={card.body || ''} />
        <TelegramButton kind={ORDER_KIND[card.kind]} title={card.title} text={card.body || ''} onSent={onSent} />
      </div>
    </div>
  );
}

/** The full list, exactly as the Guide step's Orders tab and Live Ops's "Orders sent" panel both show it. */
export function OrdersPanel({ cards }: { cards: OrderCard[] }) {
  if (!cards.length) return <div className="text-[13px] text-dim">This plan sends no orders.</div>;
  return (
    <div className="flex flex-col gap-3">
      {cards.map((c, i) => (c.kind === 'crowd' ? <CrowdCard key={i} card={c} /> : <OrderCardView key={i} card={c} />))}
    </div>
  );
}

/** buildOrders() re-exported from here too, so call sites only need one import for cards + rendering. */
export function ordersFor(scn: Scenario, ivs: Intervention[], r: SimResult) {
  return buildOrders(scn, ivs, r);
}
