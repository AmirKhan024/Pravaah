'use client';
/*
 * The one "More" menu (brief: "Everything else... goes behind one More menu. Do not delete
 * features."). Every item here already exists in the five-step console or elsewhere — nothing
 * new is built, this is purely a single entry point that gathers Ravi/ghost, what-ifs, Red Team
 * detail, the Black Box, Venues, Replay, assumptions and build-your-own off the calm main screen.
 */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { runRedTeamFor, store, type Drawer } from '@/lib/console';

const ITEMS: { label: string; sub: string; drawer?: Drawer; href?: string; action?: 'redteam' }[] = [
  { label: 'What changed (Ravi & the ghost)', sub: 'One attendee, do-nothing vs. the plan', drawer: 'report' },
  { label: 'Report from the ground', sub: 'Rail delay, weather, gate counts…', drawer: 'observe' },
  { label: 'Test a what-if', sub: 'Rain, rail failure, a delayed show…', drawer: 'whatif' },
  { label: 'Stress test (Red Team)', sub: 'Survives how many of 12 rough nights?', action: 'redteam' },
  { label: 'How long each move works', sub: 'Decision windows, one lever at a time', drawer: 'board' },
  { label: 'Build your own plan', sub: 'Tick any combination of moves', drawer: 'deck' },
  { label: 'Orders sent', sub: 'Every order, and its Telegram status', drawer: 'liveOrders' },
  { label: 'The Black Box', sub: 'Tamper-evident log, verify it live', drawer: 'ledger' },
  { label: 'How this works, what we guessed', sub: 'Assumptions, honestly labelled', drawer: 'about' },
];

const LINKS: { label: string; sub: string; href: string }[] = [
  { label: 'Any venue in 60 seconds', sub: 'Import roads, gates and stations', href: '/venues' },
  { label: 'Replay a run', sub: 'Scrub back through a past evening', href: '/replay' },
  { label: 'Full console', sub: 'The guided, five-step walkthrough', href: '/console' },
];

export default function MoreMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] text-dim hover:border-brass-dim/60 hover:text-text"
      >
        More ▾
      </button>
      {open ? (
        <div className="rise absolute right-0 top-[calc(100%+6px)] z-50 w-[300px] overflow-hidden rounded-xl border border-line bg-panel shadow-2xl">
          <div className="max-h-[70vh] overflow-y-auto py-1.5">
            {ITEMS.map((it) => (
              <button
                key={it.label}
                onClick={() => {
                  setOpen(false);
                  if (it.action === 'redteam') runRedTeamFor();
                  else if (it.drawer) store.setState({ drawer: it.drawer });
                }}
                className="flex w-full flex-col px-4 py-2 text-left hover:bg-panel-2"
              >
                <span className="text-[13px] text-text">{it.label}</span>
                <span className="text-[11px] text-dimmer">{it.sub}</span>
              </button>
            ))}
            <div className="my-1.5 border-t border-line" />
            {LINKS.map((it) => (
              <Link key={it.label} href={it.href} onClick={() => setOpen(false)} className="flex w-full flex-col px-4 py-2 text-left hover:bg-panel-2">
                <span className="text-[13px] text-text">{it.label} →</span>
                <span className="text-[11px] text-dimmer">{it.sub}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
