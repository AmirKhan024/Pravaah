'use client';
/*
 * DECISION CLOCK — the hero (SOURCE_OF_TRUTH §8.2). The deadline comes from the decision window
 * board (stress-tested across 12 rough nights, most cautious answer). The countdown itself is
 * arithmetic: deadline − current simulated time. No re-simulation per frame.
 *
 * Phase 5: visual-weight fix only — logic below is unchanged from before this pass. This is now a
 * full-width band of its own (below the slim top nav, above the map), not a small pill competing
 * with the nav for attention, and its numerals are the single largest thing on the page in every
 * state (counting down, approved, or the window having just closed).
 */
import { useEffect, useRef, useState } from 'react';
import { useSlice } from '@/lib/createStore';
import { clock, decisionDeadline, recommended, store, waitingCost } from '@/lib/console';
import { crushIfStartedAt } from './CostOfWaiting';
import { cx } from '@/components/ui';

const fmt = (mins: number) => {
  const m = Math.max(0, mins);
  const mm = Math.floor(m);
  const ss = Math.floor((m - mm) * 60);
  return String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
};

/** the consistent shell every state below renders into — always full-width, always the hero band */
function Band({ tone, onClick, children }: { tone: 'idle' | 'brass' | 'safe' | 'danger'; onClick?: () => void; children: React.ReactNode }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={cx(
        'no-print flex w-full items-center gap-6 border-b px-6 py-3 text-left transition-colors',
        onClick && 'cursor-pointer',
        tone === 'idle' && 'border-line bg-panel/60',
        tone === 'brass' && 'border-brass-dim/70 bg-[#1b1a12] hover:bg-[#211f16]',
        tone === 'safe' && 'border-safe/30 bg-[#0f1c16]',
        tone === 'danger' && 'border-danger/50 bg-[#211310]',
      )}
    >
      {children}
    </Tag>
  );
}

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
  const [urgent, setUrgent] = useState(false);
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
        setUrgent((u) => (u === left <= 15 ? u : left <= 15));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const open = () => store.setState({ drawer: 'board' });

  if (s.mode === 'intro' || s.mode === 'story')
    return (
      <Band tone="idle">
        <span className="kicker !mb-0">Decision clock</span>
        <span className="num text-[13px] text-dimmer">starts as soon as Pravaah sees trouble ahead</span>
      </Band>
    );

  if (s.approved)
    return (
      <Band tone="safe" onClick={open}>
        <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-safe/60 text-safe">
          <svg viewBox="0 0 16 16" className="size-5" aria-hidden>
            <path d="M3 8.5l3.2 3L13 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="flex flex-col leading-tight">
          <span className="font-display text-[26px] leading-tight text-safe">You acted at {clock(s.approved.tick)}</span>
          <span className="text-[12.5px] text-dim">{s.approved.name} is in force · click to see how the deadline was worked out</span>
        </span>
      </Band>
    );

  if (s.replan || s.replanBusy)
    return (
      <Band tone="danger" onClick={open}>
        <span className="num shrink-0 text-[56px] font-semibold leading-none text-danger-soft line-through decoration-4 sm:text-[64px]">00:00</span>
        <span className="flex flex-col leading-tight">
          <span className="text-[17px] font-semibold text-danger-soft">The window closed</span>
          <span className="text-[13px] text-dim">{s.replan ? waitingCost(s.replan.lostMin, s.replan.lostRupees) : 'Re-planning from now…'}</span>
        </span>
      </Band>
    );

  if (!s.ready || !s.board || !deadline)
    return (
      <Band tone="idle">
        <span className="kicker !mb-0">Decision clock</span>
        <span className="text-[13px] text-dim">testing every plan against 12 rough nights…</span>
        <span className="busy-bar h-1 w-48 rounded-full bg-line" />
      </Band>
    );

  return (
    <button
      onClick={open}
      title="How this deadline was worked out"
      className={cx(
        'flex w-full items-center gap-6 border-b px-6 py-3 text-left transition-colors',
        urgent ? 'animate-[pulse-danger_1.6s_ease-in-out_infinite] border-danger/60 bg-[#241612]' : 'border-brass-dim/70 bg-[#1b1a12] hover:bg-[#211f16]',
      )}
    >
      <span className="flex shrink-0 flex-col leading-none">
        <span className={cx('kicker !mb-1.5', urgent ? '!text-danger-soft' : '!text-brass-dim')}>This plan works if you start in</span>
        <span ref={digits} className={cx('num text-[56px] font-semibold leading-none tracking-tight sm:text-[64px]', urgent ? 'text-danger-soft' : 'text-brass')}>
          --:--
        </span>
      </span>
      <span className="hidden h-12 w-px shrink-0 bg-line sm:block" />
      <span className="flex min-w-0 flex-col gap-1 leading-tight">
        <span className="text-[15px] font-medium text-text">
          left to act · closes <span className="num">{clock(deadline.tick)}</span>
        </span>
        {actNow != null ? (
          <span className="text-[13px] text-dim">
            start right now: <b className={cx('num', actNow === 0 ? 'text-safe' : 'text-danger-soft')}>{actNow}</b> dangerous minutes
          </span>
        ) : null}
        <span className="line-clamp-1 text-[12px] text-dimmer">{deadline.label}</span>
      </span>
    </button>
  );
}
