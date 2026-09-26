'use client';
import { useEffect, useRef, useState } from 'react';
import { useSlice } from '@/lib/createStore';
import { clock, decisionDeadline, scrub, setLiveSpeed, setPeek, store, togglePlay, skipStory } from '@/lib/console';
import { denColor } from '@/lib/colors';
import type { SimResult } from '@/engine';
import { cx } from '@/components/ui';

function paint(c: HTMLCanvasElement | null, res: SimResult | null, H: number) {
  if (!c || !res) return;
  const w = c.clientWidth || 600,
    h = c.clientHeight || 12,
    dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = w * dpr;
  c.height = h * dpr;
  const g = c.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  for (let x = 0; x < w; x++) {
    const t = Math.min(H - 1, Math.floor((x / w) * H));
    g.fillStyle = denColor(res.maxDenSeries[t], 0.95);
    g.fillRect(x, 0, 1, h);
  }
}

const LIVE_SPEEDS = [
  { v: 1 / 60, label: 'Real time' },
  { v: 0.25, label: '15×' },
  { v: 1, label: '60×' },
];

export default function Timeline() {
  const s = useSlice(store, (s) => ({
    cur: s.cur,
    ghost: s.ghost,
    H: s.scn.horizon,
    t0: s.scn.t0Min,
    gatesOpen: s.scn.gatesOpenTick,
    show: s.scn.showStartTick,
    mode: s.mode,
    playing: s.playing,
    liveSpeed: s.liveSpeed,
    curLabel: s.curLabel,
    ens: s.ens,
    approved: s.approved?.tick ?? null,
    peek: s.peek,
  }));
  const deadline = useSlice(store, (st) => decisionDeadline(st)?.tick ?? null);
  const main = useRef<HTMLCanvasElement>(null);
  const ghost = useRef<HTMLCanvasElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const clockEl = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const showGhost = !!s.ghost && s.ghost !== s.cur;

  useEffect(() => {
    const redraw = () => {
      paint(main.current, s.cur, s.H);
      if (showGhost) paint(ghost.current, s.ghost, s.H);
    };
    redraw();
    window.addEventListener('resize', redraw);
    return () => window.removeEventListener('resize', redraw);
  }, [s.cur, s.ghost, s.H, showGhost]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const st = store.getState();
      const t = st.tick;
      if (head.current) head.current.style.left = (t / (st.scn.horizon - 1)) * 100 + '%';
      if (clockEl.current) clockEl.current.textContent = clock(Math.floor(t));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pct = (t: number) => (t / (s.H - 1)) * 100 + '%';
  const tickAt = (clientX: number) => {
    const r = bar.current!.getBoundingClientRect();
    return Math.round(((clientX - r.left) / r.width) * (s.H - 1));
  };
  const hours: number[] = [];
  for (let m = Math.ceil(s.t0 / 60) * 60; m <= s.t0 + s.H; m += 60) hours.push(m - s.t0);
  const live = s.mode === 'live';

  return (
    <div className="no-print pointer-events-auto border-t border-line bg-ink/92 px-5 pb-3 pt-2.5 backdrop-blur-[2px]">
      <div className="mb-2 flex items-center gap-3">
        <button
          onClick={togglePlay}
          aria-label={s.playing ? 'Pause' : 'Play'}
          className="grid size-8 place-items-center rounded-full border border-line bg-panel-2 text-text hover:border-brass-dim"
        >
          {s.playing ? (
            <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
              <rect x="3.5" y="3" width="3" height="10" rx="1" fill="currentColor" />
              <rect x="9.5" y="3" width="3" height="10" rx="1" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" className="ml-0.5 size-3.5" aria-hidden>
              <path d="M4 2.8v10.4L13 8z" fill="currentColor" />
            </svg>
          )}
        </button>
        <span ref={clockEl} className="num text-[20px] font-semibold text-text">
          14:00
        </span>
        <span className="text-[12px] text-dim">{s.curLabel}</span>
        {live ? (
          <span className="flex items-center gap-2 rounded-full border border-danger/30 bg-danger/5 px-2.5 py-0.5 text-[11px] text-danger-soft">
            <span className="blink size-1.5 rounded-full bg-danger" /> LIVE
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-1.5">
          {s.mode === 'story' ? (
            <button onClick={skipStory} className="rounded-md px-2 py-1 text-[11.5px] text-dim hover:bg-panel-2 hover:text-text">
              Skip to the warning →
            </button>
          ) : null}
          {live
            ? LIVE_SPEEDS.map((o) => (
                <button
                  key={o.label}
                  onClick={() => setLiveSpeed(o.v)}
                  className={cx('rounded-md px-2 py-1 text-[11.5px]', Math.abs(s.liveSpeed - o.v) < 1e-6 ? 'bg-panel-2 text-brass' : 'text-dim hover:text-text')}
                >
                  {o.label}
                </button>
              ))
            : null}
          {s.peek != null ? (
            <button onClick={() => setPeek(null)} className="rounded-md border border-brass-dim px-2 py-1 text-[11.5px] text-brass">
              Peeking at {clock(s.peek)} · back to now
            </button>
          ) : null}
        </div>
      </div>

      <div
        ref={bar}
        className="relative cursor-pointer select-none"
        onMouseMove={(e) => setHover(tickAt(e.clientX))}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => scrub(tickAt(e.clientX))}
      >
        <div className="flex items-center gap-2">
          <span className="w-[92px] shrink-0 text-right text-[10.5px] text-dim">{showGhost ? 'with the plan' : 'crowd pressure'}</span>
          <canvas ref={main} className="h-3 w-full rounded-sm" />
        </div>
        {showGhost ? (
          <div className="mt-1 flex items-center gap-2">
            <span className="w-[92px] shrink-0 text-right text-[10.5px] text-dimmer">if you did nothing</span>
            <canvas ref={ghost} className="h-2 w-full rounded-sm opacity-70" />
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-y-0 left-[100px] right-0">
          {/* forecast window p10–p90 */}
          {s.ens && s.ens.tLo != null && !s.approved ? (
            <div className="absolute -top-1 bottom-[-4px] rounded border border-danger/40 bg-danger/10" style={{ left: pct(s.ens.tLo), width: `calc(${pct(s.ens.tHi - s.ens.tLo)})` }} title="Where 80% of forecast runs first hit crush" />
          ) : null}
          <div className="absolute -top-1 bottom-[-4px] w-px bg-dim/60" style={{ left: pct(s.gatesOpen) }} />
          <div className="absolute -top-1 bottom-[-4px] w-px bg-dim/60" style={{ left: pct(s.show) }} />
          {deadline != null ? <div className="absolute -top-2 bottom-[-6px] w-0.5 bg-brass" style={{ left: pct(deadline) }} /> : null}
          {s.approved != null ? <div className="absolute -top-2 bottom-[-6px] w-0.5 bg-safe" style={{ left: pct(s.approved) }} /> : null}
          {s.peek != null ? <div className="absolute -top-2 bottom-[-6px] w-0.5 bg-brass/70" style={{ left: pct(s.peek) }} /> : null}
          <div ref={head} className="absolute -top-2 bottom-[-6px] w-0.5 -translate-x-1/2 bg-text shadow-[0_0_0_3px_rgba(16,23,21,.8)]" />
          {hover != null ? (
            <div className="absolute -top-7 -translate-x-1/2 rounded bg-panel-2 px-1.5 py-0.5 text-[10.5px] text-text num" style={{ left: pct(hover) }}>
              {clock(hover)}
            </div>
          ) : null}
        </div>
        <div className="relative ml-[100px] mt-1.5 h-3.5 text-[10px] text-dimmer">
          {hours.map((h) => (
            <span key={h} className="num absolute -translate-x-1/2" style={{ left: pct(h) }}>
              {clock(h)}
            </span>
          ))}
          <span className="absolute -translate-x-1/2 translate-y-3 text-[9.5px] text-dim" style={{ left: pct(s.gatesOpen) }}>
            gates open
          </span>
          <span className="absolute -translate-x-1/2 translate-y-3 text-[9.5px] text-dim" style={{ left: pct(s.show) }}>
            show
          </span>
        </div>
      </div>
    </div>
  );
}
