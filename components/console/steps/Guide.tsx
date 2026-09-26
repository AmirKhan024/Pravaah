'use client';
/*
 * Phase 4 flagged this step as the most number-dense screen in the app (~24 numbers visible at
 * once, mostly in the delta box). Restructured here into two tabs — "What changed" (default) and
 * "Orders" — the same split proposed in docs/PROGRESS.md, and the prerequisite for Live Ops's
 * "Orders sent" panel to be a genuine reuse of this step's own orders list rather than a copy.
 */
import { useState } from 'react';
import { useSlice } from '@/lib/createStore';
import { clock, replayOutcome, runRedTeamFor, store } from '@/lib/console';
import { ordersFor, OrdersPanel } from '../OrdersPanel';
import { openRoom, roomStore } from '@/lib/room';
import { comma, inr } from '@/engine';
import { Button, Delta, Pill, cx } from '@/components/ui';
import { StepHead } from './StepHead';

type Tab = 'changed' | 'orders';

function WhatChangedTab() {
  const s = useSlice(store, (s) => ({ approved: s.approved, base: s.base, scn: s.scn, rc: s.raviCur, rg: s.raviGhost }));
  const room = useSlice(roomStore, (r) => ({ id: r.id, people: r.snap?.participants.length || 0, result: r.result }));
  const a = s.approved!;
  const r = a.result;
  const peak = (x: number[]) => Math.max(...x).toFixed(1);
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-safe/35 bg-[#122019] p-4">
        <div className="kicker mb-2 !text-safe">What changes · re-run from {clock(a.tick)}</div>
        <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-[13px]">
          <span className="text-dim">Dangerous minutes</span>
          <Delta from={s.base.crushMin} to={r.crushMin} />
          <span className="text-dim">Most crowded spot</span>
          <Delta from={peak(s.base.peakDen)} to={peak(r.peakDen)} unit="/m²" />
          <span className="text-dim">Longest gate wait</span>
          <Delta from={Math.round(s.base.maxGateWait)} to={Math.round(r.maxGateWait)} unit="min" />
          <span className="text-dim">Outside at showtime</span>
          <Delta from={comma(s.base.missed)} to={comma(r.missed)} />
          <span className="text-dim">Cost</span>
          <span className="num text-right font-semibold text-brass">{r.rupees ? inr(r.rupees) : '₹0'}</span>
        </div>
        {s.scn.id === 'dyPatil' && s.rg ? (
          <div className="mt-3 border-t border-safe/20 pt-3 text-[12.5px] leading-relaxed text-dim">
            Ravi and Aarohi get in at <b className="num text-text">{clock(s.rc.inside)}</b> instead of <span className="num">{clock(s.rg.inside)}</span>. The tightest crowd around them: <b className="num text-text">{s.rc.worst.toFixed(1)}</b> instead of <span className="num">{s.rg.worst.toFixed(1)}</span> people/m².
          </div>
        ) : null}
        {a.roomNote ? <div className="mt-2 text-[12px] text-brass">{a.roomNote} Re-run with the room&apos;s choices.</div> : null}
      </div>

      <div className="rounded-xl border border-brass-dim/60 bg-[#1d1c14] p-4">
        <div className="flex items-center justify-between">
          <span className="kicker !mb-0 !text-brass">The Room</span>
          {room.id ? <Pill tone="brass">{room.people} phones</Pill> : null}
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-dim">Send this plan&apos;s message to every phone in the audience. Their yes and no replace the model&apos;s guess, and the evening re-runs.</p>
        {room.result ? (
          <p className="mt-2 text-[13px]">
            The room said yes <b className="num text-safe">{Math.round(room.result.roomYes * 100)}%</b>; the model predicted <b className="num">{Math.round(room.result.modelYes * 100)}%</b>.
          </p>
        ) : null}
        <Button variant="solid" className="mt-3 w-full" onClick={openRoom}>
          {room.id ? 'Show the room' : 'Open the room'}
        </Button>
      </div>
    </div>
  );
}

function OrdersTab() {
  const s = useSlice(store, (s) => ({ scn: s.scn, approved: s.approved }));
  const a = s.approved!;
  const cards = ordersFor(s.scn, a.ivs, a.result);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] leading-relaxed text-dim">Everything below is ready to send. Every number in it comes from the run you just approved.</p>
      <OrdersPanel cards={cards} />
    </div>
  );
}

export default function Guide() {
  const s = useSlice(store, (s) => ({ approved: s.approved, rt: s.redTeam, rtFor: s.redTeamFor, rtBusy: s.redTeamBusy }));
  const [tab, setTab] = useState<Tab>('changed');
  const a = s.approved;
  if (!a)
    return (
      <div className="flex flex-col gap-5">
        <StepHead n={5} verb="Guide" title="Nothing approved yet">
          Approve a plan in step 4. Pravaah turns it into orders for hotels, transport, gate staff and every phone in the crowd.
        </StepHead>
      </div>
    );
  return (
    <div className="flex flex-col gap-4">
      <StepHead n={5} verb="Guide" title="Send the orders.">
        “{a.name}” approved at <span className="num text-text">{clock(a.tick)}</span>.
      </StepHead>

      <div className="flex gap-1 rounded-lg border border-line bg-ink/50 p-1">
        {(
          [
            ['changed', 'What changed'],
            ['orders', 'Orders'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={cx('flex-1 rounded-md px-2 py-1.5 text-[12.5px] font-medium transition-colors', tab === id ? 'bg-panel-2 text-brass' : 'text-dim hover:text-text')}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'changed' ? <WhatChangedTab /> : <OrdersTab />}

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={replayOutcome}>Replay the evening</Button>
        <Button onClick={() => store.setState({ drawer: 'report' })}>After-action report</Button>
        <Button className="col-span-2" disabled={s.rtBusy} onClick={() => (s.rt && s.rtFor === a.name ? store.setState({ drawer: 'redteam' }) : runRedTeamFor())}>
          {s.rt && s.rtFor === a.name ? `Red team: safe on ${s.rt.survived} of ${s.rt.total} rough nights →` : 'Red team this plan'}
        </Button>
      </div>
    </div>
  );
}
