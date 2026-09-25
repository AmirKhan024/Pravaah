'use client';
/*
 * DECISION CLOCK — the hero (SOURCE_OF_TRUTH §8.2). The deadline comes from the decision window
 * board (stress-tested across 12 rough nights, most cautious answer). The countdown itself is
 * arithmetic: deadline − current simulated time. No re-simulation per frame.
 */
import { useEffect, useRef } from 'react';
import { useSlice } from '@/lib/createStore';
import { clock, decisionDeadline, recommended, store } from '@/lib/console';
import { crushIfStartedAt } from './CostOfWaiting';
import { cx } from '@/components/ui';

const fmt = (mins: number) => {
  const m = Math.max(0, mins);
  const mm = Math.floor(m);
  const ss = Math.floor((m - mm) * 60);
  return String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
};

export default function DecisionClock() {
  const s = useSlice(store, (s) => ({
    mode: s.mode,
    board: !!s.board,
    approved: s.approved,
    replan: s.replan,
    replanBusy: s.replanBusy,
    expired: s.expired.length,
    ready: !!s.plans['Zero rupees'],
  }));
  const digits = useRef<HTMLSpanElement>(null);
  const box = useRef<HTMLButtonElement>(null);
  const deadline = useSlice(store, (st) => decisionDeadline(st));
  const actNow = useSlice(store, (st) => {
    const p = recommended(st);
    if (!p || st.mode !== 'live' || st.approved) return null;
    return crushIfStartedAt(st.scn, p.chosen, st.waits, Math.max(st.scn.gatesOpenTick, Math.floor(st.tick)));
  });

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const st = store.getState();
      const d = decisionDeadline(st);
      if (d && digits.current) {
        const left = d.tick - st.tick;
        digits.current.textContent = fmt(left);
        box.current?.classList.toggle('urgent', left <= 15);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const open = () => store.setState({ drawer: 'board' });

  if (s.mode === 'intro' || s.mode === 'story')
    return (
      <div className="flex flex-col items-center leading-none">
        <span className="kicker !text-[9.5px]">Decision clock</span>
        <span className="num mt-1 text-[13px] text-dimmer">starts when Pravaah sees trouble</span>
      </div>
    );

  if (s.approved)
    return (
      <button onClick={open} className="group flex items-center gap-3 rounded-xl border border-safe/30 bg-[#112019] px-4 py-1.5 text-left">
        <span className="grid size-7 place-items-center rounded-full border border-safe/60 text-safe">
          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
            <path d="M3 8.5l3.2 3L13 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-[13.5px] font-semibold text-safe">You acted at {clock(s.approved.tick)}</span>
          <span className="text-[11.5px] text-dim">{s.approved.name} is in force</span>
        </span>
      </button>
    );

  if (s.replan || s.replanBusy)
    return (
      <button onClick={open} className="flex items-center gap-4 rounded-xl border border-danger/40 bg-[#221512] px-4 py-1.5 text-left">
        <span className="num text-[30px] font-semibold leading-none text-danger-soft line-through decoration-2">00:00</span>
        <span className="flex max-w-[230px] flex-col leading-tight">
          <span className="text-[12.5px] font-semibold text-danger-soft">The window closed</span>
          <span className="text-[11.5px] text-dim">
            {s.replan ? `Waiting cost ${s.replan.lostMin} more dangerous minute${s.replan.lostMin === 1 ? '' : 's'}` : 'Re-planning from now…'}
          </span>
        </span>
      </button>
    );

  if (!s.ready || !s.board || !deadline)
    return (
      <div className="flex min-w-[260px] flex-col items-center gap-1.5 leading-none">
        <span className="kicker !text-[9.5px]">Decision clock</span>
        <span className="text-[12px] text-dim">testing every plan against 12 rough nights…</span>
        <span className="busy-bar h-0.5 w-40 rounded-full bg-line" />
      </div>
    );

  return (
    <button
      ref={box}
      onClick={open}
      title="How this deadline was worked out"
      className={cx(
        'group flex items-center gap-4 rounded-xl border border-brass-dim/70 bg-[#1b1a12] px-4 py-1.5 text-left transition-colors hover:border-brass',
        '[&.urgent]:animate-[pulse-danger_1.6s_ease-in-out_infinite] [&.urgent]:border-danger/60 [&.urgent]:bg-[#231612]',
      )}
    >
      <span className="flex flex-col leading-none">
        <span className="kicker !mb-1 !text-[9.5px] !text-brass-dim group-[.urgent]:!text-danger-soft">This plan works if you start in</span>
        <span ref={digits} className="num text-[38px] font-semibold leading-none text-brass group-[.urgent]:text-danger-soft">
          --:--
        </span>
      </span>
      <span className="flex max-w-[210px] flex-col gap-0.5 leading-tight">
        <span className="text-[12px] font-medium text-text">left to act · closes {clock(deadline.tick)}</span>
        {actNow != null ? (
          <span className="text-[11.5px] text-dim">
            act now: <b className={actNow === 0 ? 'num text-safe' : 'num text-danger-soft'}>{actNow}</b> dangerous min
          </span>
        ) : null}
        <span className="line-clamp-1 text-[11px] text-dimmer">{deadline.label}</span>
      </span>
    </button>
  );
}
