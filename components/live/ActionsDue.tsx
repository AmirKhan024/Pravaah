'use client';
/*
 * Zone 3 — one card per recommended-plan lever (never more than 4: the optimiser's own search
 * depth for the free/default plan already caps it there, and this slices defensively to match).
 * Approve reuses the exact approve() the five-step console's sticky button calls, then — for
 * staff/transport/accommodation/food levers only, never crowd messages — automatically sends that
 * lever's order to Telegram via the same sendOrderToTelegram() the Orders tab's button calls.
 * Skip and Why? are new here, but both are thin wrappers over existing engine-backed logic
 * (skipLever() reuses the exact same expire-and-replan path a missed deadline uses; Why? opens
 * the same per-lever detail the Timing tab's drawer already renders).
 */
import { useState } from 'react';
import { useSlice } from '@/lib/createStore';
import { approve, openLeverWhy, opsLevers, orderSentAt, skipLever, store } from '@/lib/console';
import { ORDER_KIND, ordersFor, sendOrderToTelegram } from '@/components/console/OrdersPanel';
import { Button, cx, Pill } from '@/components/ui';
import type { Lever } from '@/engine';

function Countdown({ lever }: { lever: Lever }) {
  const s = useSlice(store, (s) => ({ board: s.board, t: Math.floor(s.tick), expired: s.expired.indexOf(lever.label) >= 0, approved: !!s.approved }));
  if (s.approved) return <Pill tone="safe">in force</Pill>;
  if (s.expired) return <Pill tone="danger">closed</Pill>;
  const o = s.board?.find((x) => x.label === lever.label);
  if (!o || o.useless) return <Pill>no deadline</Pill>;
  const left = o.deadlineTick - s.t;
  if (left <= 0) return <Pill tone="danger">closed</Pill>;
  return (
    <Pill tone={left <= 15 ? 'danger' : 'brass'}>
      <span className="num">{left}</span> min
    </Pill>
  );
}

function ActionCard({ lever }: { lever: Lever }) {
  const s = useSlice(store, (s) => ({ approved: s.approved, scn: s.scn, expired: s.expired.indexOf(lever.label) >= 0, replanBusy: s.replanBusy }));
  const [sending, setSending] = useState<{ busy: boolean; error?: string }>({ busy: false });

  // the order this lever produces, and whether it's already been sent — read from the same
  // shared record the Orders tab's own Telegram button writes to (lib/console.ts's sentOrders),
  // so this card and that button can never disagree about "sent" and never double-send.
  const order = s.approved ? ordersFor(s.scn, [lever], s.approved.result)[0] : null;
  const isOpsOrder = !!order && order.kind !== 'crowd';
  const sentAt = useSlice(store, () => (order ? orderSentAt(order.title) : undefined));

  const doApprove = async () => {
    if (!store.getState().approved) approve();
    const app = store.getState().approved;
    if (!app) return; // approve() can no-op if there's nothing selected to approve
    const ord = ordersFor(store.getState().scn, [lever], app.result)[0];
    if (!ord || ord.kind === 'crowd' || orderSentAt(ord.title)) return;
    setSending({ busy: true });
    const r = await sendOrderToTelegram(ORDER_KIND[ord.kind], ord.title, ord.body || '');
    setSending({ busy: false, error: r.ok ? undefined : r.reason });
  };

  return (
    <div className="rounded-xl border border-line bg-panel-2/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[14px] font-medium leading-snug text-text">{lever.label}</div>
        <Countdown lever={lever} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {sentAt || (s.approved && !isOpsOrder) ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-safe/10 px-2.5 py-1.5 text-[12.5px] text-safe">
            <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
              <path d="M3 8.5l3.2 3L13 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {sentAt ? `Approved · sent to ops · ${sentAt}` : 'Approved · in force'}
          </span>
        ) : (
          <Button size="sm" variant="solid" disabled={sending.busy} onClick={doApprove}>
            {sending.busy ? 'Sending…' : s.approved ? 'Send to ops' : 'Approve'}
          </Button>
        )}
        {!s.approved ? (
          <Button size="sm" variant="quiet" disabled={s.expired || s.replanBusy} onClick={() => skipLever(lever.label)}>
            {s.expired ? 'Skipped' : 'Skip'}
          </Button>
        ) : null}
        <Button size="sm" variant="quiet" onClick={() => openLeverWhy(lever.label)}>
          Why?
        </Button>
        {sending.error ? <span className={cx('text-[11.5px] text-danger-soft')}>{sending.error}</span> : null}
      </div>
    </div>
  );
}

export default function ActionsDue() {
  const levers = useSlice(store, (s) => opsLevers(s).slice(0, 4));
  if (!levers.length) return <div className="rounded-xl border border-line bg-panel-2/40 p-4 text-[13px] text-dim">Nothing due. Pravaah is still working out the recommended plan.</div>;
  return (
    <div className="flex flex-col gap-2">
      {levers.map((l) => (
        <ActionCard key={l.label} lever={l} />
      ))}
    </div>
  );
}
