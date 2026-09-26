'use client';
/*
 * Live Ops — the new default landing view (SOURCE_OF_TRUTH's five-step console remains reachable,
 * unchanged, in full, via the "Full console" link below). Four zones, reusing existing state,
 * actions and components throughout — nothing here recomputes a simulation or a lever; it only
 * recomposes what boot()/approve()/the engine worker already produce into a faster, calmer view
 * for someone running the event live rather than walking a judge through five steps.
 */
import Link from 'next/link';
import { useEffect } from 'react';
import { useSlice } from '@/lib/createStore';
import { boot, rehearse, skipStory, store } from '@/lib/console';
import { useSimTicker } from '@/lib/useSimTicker';
import { RAVI } from '@/engine';
import FlowMap from '@/components/map/FlowMap';
import Drawers from '@/components/console/Drawers';
import Toast from '@/components/console/Toast';
import RoomPanel from '@/components/room/RoomPanel';
import { Logo } from '@/components/ui';
import StatusBand from './StatusBand';
import ActionsDue from './ActionsDue';
import StatusDots from './StatusDots';
import Ticker from './Ticker';
import MoreMenu from './MoreMenu';

/** Reaches the same 'live' mode the console's own "Skip to the warning" button does — reused
 *  verbatim (rehearse() + skipStory()), not a new state transition. Live Ops has no story/intro
 *  narration of its own; it should already read as "the evening, right now." */
/** Escape closes whatever drawer is open — matches the five-step console's own keyboard handling. */
function useEscToClose() {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') store.setState({ drawer: null });
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
}

function useReachLive() {
  useEffect(() => {
    boot();
    if (store.getState().mode === 'intro') {
      rehearse();
      requestAnimationFrame(() => skipStory());
    }
  }, []);
}

export default function Live() {
  useReachLive();
  useSimTicker();
  useEscToClose();
  const scnName = useSlice(store, (s) => s.scn.name);

  return (
    <div className="grid h-dvh grid-rows-[48px_auto_minmax(0,1fr)_auto] overflow-hidden bg-ink">
      <header className="no-print flex items-center gap-4 border-b border-line bg-ink px-5">
        <Link href="/" className="flex items-center gap-2.5 text-brass" aria-label="Pravaah home">
          <Logo className="size-6" />
          <span className="text-[13px] font-semibold tracking-[0.2em] text-text">PRAVAAH</span>
        </Link>
        <span className="hidden truncate text-[11.5px] text-dimmer lg:inline">{scnName} · live ops</span>
        <div className="ml-auto flex items-center gap-2">
          <MoreMenu />
          <Link href="/console" className="rounded-lg border border-brass-dim/60 px-3 py-1.5 text-[12.5px] text-brass hover:bg-panel-2">
            Full console →
          </Link>
        </div>
      </header>

      <StatusBand />

      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_340px]">
        <main className="relative min-h-0 overflow-hidden">
          <FlowMap
            fitKey="dyPatil"
            getState={() => {
              const s = store.getState();
              return { scn: s.scn, cur: s.cur, ghost: s.ghost, tick: s.peek ?? s.tick, raviCur: s.raviCur, raviRelease: RAVI.release };
            }}
          />
        </main>

        <aside className="no-print flex min-h-0 flex-col gap-3 overflow-y-auto border-l border-line bg-panel p-4">
          <div className="kicker">Do next</div>
          <ActionsDue />
        </aside>
      </div>

      <footer className="no-print border-t border-line bg-panel">
        <StatusDots />
        <Ticker />
      </footer>

      <Drawers />
      <RoomPanel />
      <Toast />
    </div>
  );
}
