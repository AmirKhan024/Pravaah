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
import { useEffect, useState } from 'react';
import { useSlice } from '@/lib/createStore';
import { actionState, approve, approveReplacement, openLeverWhy, opsLevers, orderSentAt, skipLever, store } from '@/lib/console';
import { ORDER_KIND, ordersFor, sendOrderToTelegram } from '@/components/console/OrdersPanel';
import { Button, cx, Pill } from '@/components/ui';
import type { Lever } from '@/engine';

function Countdown({ lever }: { lever: Lever }) {
  const s = useSlice(store, (s) => ({ board: s.board, t: Math.floor(s.tick), state: actionState(lever.label, s) }));
  if (s.state === 'accepted') return <Pill tone="safe">in force</Pill>;
  if (s.state === 'skipped') return <Pill tone="danger">not now</Pill>;
  if (s.state === 'expired') return <Pill tone="danger">closed</Pill>;
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
  const s = useSlice(store, (s) => ({
    approved: s.approved,
    approvedStatus: s.approvedStatus,
    scn: s.scn,
    state: actionState(lever.label, s),
    replanBusy: s.replanBusy,
    monitorBusy: s.monitorBusy,
  }));
  const accepted = s.state === 'accepted';
  const stoppedWorking = !!s.approved && s.approvedStatus === 'stopped-working' && !accepted;
  const [sending, setSending] = useState<{ busy: boolean; error?: string }>({ busy: false });

  // the order this lever produces, and whether it's already been sent — read from the same
  // shared record the Orders tab's own Telegram button writes to (lib/console.ts's sentOrders),
  // so this card and that button can never disagree about "sent" and never double-send.
  const order = accepted && s.approved ? ordersFor(s.scn, [lever], s.approved.result)[0] : null;
  const isOpsOrder = !!order && order.kind !== 'crowd';
  const sentAt = useSlice(store, () => (order ? orderSentAt(order.title) : undefined));

  const doIt = async () => {
    if (!accepted) {
      // a stopped-working plan gets replaced with the fresh one, at now, staying live — never the
      // canned first-approval replay. A plain first approval uses approve() as before.
      if (stoppedWorking) approveReplacement();
      else approve();
    }
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
      {stoppedWorking ? (
        <div className="mb-2 flex items-center gap-1.5 text-[11.5px] text-danger-soft">
          <i className="size-1.5 rounded-full bg-danger" /> stopped working — new move
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="text-[14px] font-medium leading-snug text-text">{lever.label}</div>
        <Countdown lever={lever} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {sentAt || (accepted && !isOpsOrder) ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-safe/10 px-2.5 py-1.5 text-[12.5px] text-safe">
            <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
              <path d="M3 8.5l3.2 3L13 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {sentAt ? `Done · sent to ops · ${sentAt}` : 'Done · in force'}
          </span>
        ) : (
          <Button size="sm" variant="solid" disabled={sending.busy || s.monitorBusy} onClick={doIt}>
            {sending.busy ? 'Sending…' : accepted ? 'Send to ops' : 'Do it'}
          </Button>
        )}
        {!accepted && !stoppedWorking ? (
          <Button size="sm" variant="quiet" disabled={s.state === 'skipped' || s.state === 'expired' || s.replanBusy} onClick={() => skipLever(lever.label)}>
            {s.state === 'skipped' ? 'Not now · skipped' : 'Not now'}
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

/** ONE action card at a time (brief: "Right: ONE action card at a time"). If more than one lever
 *  is due, the rest queue behind small "1 of N" paging — never more than one card shown at once. */
export default function ActionsDue() {
  const levers = useSlice(store, (s) => opsLevers(s).slice(0, 4));
  const [i, setI] = useState(0);
  useEffect(() => {
    if (i >= levers.length) setI(0);
  }, [levers.length, i]);
  if (!levers.length) return <div className="rounded-xl border border-line bg-panel-2/40 p-4 text-[13px] text-dim">Nothing due. Pravaah is still working out the recommended plan.</div>;
  const lever = levers[Math.min(i, levers.length - 1)];
  return (
    <div className="flex flex-col gap-2">
      {levers.length > 1 ? (
        <div className="flex items-center justify-between text-[11.5px] text-dimmer">
          <button disabled={i === 0} onClick={() => setI((n) => Math.max(0, n - 1))} className="rounded px-1.5 py-0.5 hover:bg-panel-2 hover:text-text disabled:opacity-30">
            ‹ prev
          </button>
          <span>
            {i + 1} of {levers.length} due
          </span>
          <button disabled={i >= levers.length - 1} onClick={() => setI((n) => Math.min(levers.length - 1, n + 1))} className="rounded px-1.5 py-0.5 hover:bg-panel-2 hover:text-text disabled:opacity-30">
            next ›
          </button>
        </div>
      ) : null}
      <ActionCard key={lever.label} lever={lever} />
    </div>
  );
}
