'use client';
/*
 * The organiser console. Three questions, always in order:
 * what's going wrong → what should I do → what must I do right now (and how long do I have)?
 */
import Link from 'next/link';
import { useEffect } from 'react';
import { useSlice } from '@/lib/createStore';
import { boot, goStep, store } from '@/lib/console';
import { openRoom, roomStore } from '@/lib/room';
import { useSimTicker } from '@/lib/useSimTicker';
import { RAVI } from '@/engine';
import FlowMap from '@/components/map/FlowMap';
import { cx, Logo } from '@/components/ui';
import DecisionClock from './DecisionClock';
import Drawers from './Drawers';
import MobileNotice from './MobileNotice';
import Toast from './Toast';
import { RaviCard, Readouts } from './Readouts';
import Timeline from './Timeline';
import WhatIfBar from './WhatIfBar';
import Rehearse from './steps/Rehearse';
import Predict from './steps/Predict';
import Explain from './steps/Explain';
import Prove from './steps/Prove';
import Guide from './steps/Guide';
import RoomPanel from '@/components/room/RoomPanel';

const STEPS = ['Rehearse', 'Predict', 'Explain', 'Prove', 'Guide'];

const SCRIPT = [
  { t: 2, x: '14:00. Nothing has gone wrong yet. The gates open in two hours.' },
  { t: 122, x: '16:00. The gates open. Three gates, thirty bag-check lanes between them.' },
  { t: 176, x: 'The self-drive crowd and the hotel coaches start to arrive. Everything is moving.' },
  { t: 200, x: 'A train reaches Nerul every six minutes. Each one empties onto the same skywalk.' },
  { t: 214, x: 'Look where the dots are going. Almost everyone walks to Gate 3, because that is where the station is.' },
];

/** the story-mode caption narration, layered on top of the shared tick loop below */
function useStoryCaptions() {
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const s = store.getState();
      if (s.mode === 'story') {
        let idx = -1;
        for (let i = 0; i < SCRIPT.length; i++) if (s.tick >= SCRIPT[i].t) idx = i;
        const text = idx >= 0 ? SCRIPT[idx].x : '';
        if (text !== s.caption) store.setState({ caption: text });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

function useKeys() {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const s = store.getState();
      if (e.key === ' ') {
        e.preventDefault();
        if (s.mode === 'intro') import('@/lib/console').then((m) => m.rehearse());
        else store.setState({ playing: !s.playing });
      } else if (e.key >= '1' && e.key <= '5') goStep(+e.key);
      else if (e.key === 'r' || e.key === 'R') openRoom();
      else if (e.key === 'Escape') {
        store.setState({ drawer: null });
        roomStore.setState({ open: false });
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
}

function StepTabs() {
  const s = useSlice(store, (s) => ({ step: s.step, max: s.maxStep }));
  return (
    <div className="flex gap-1 px-5 pt-4">
      {STEPS.map((name, i) => {
        const n = i + 1;
        const locked = n > s.max;
        return (
          <button
            key={name}
            disabled={locked}
            onClick={() => goStep(n)}
            className={cx(
              'group flex flex-1 flex-col items-start gap-1.5 rounded-lg px-1.5 pb-2 pt-1 text-left transition-colors',
              n === s.step ? 'text-text' : locked ? 'text-dimmer/60' : 'text-dim hover:text-text',
            )}
          >
            <span className={cx('h-[3px] w-full rounded-full', n === s.step ? 'bg-brass' : n <= s.max ? 'bg-brass-dim/60' : 'bg-line')} />
            <span className="text-[11px] font-semibold tracking-[0.04em]">
              <span className="num mr-1 text-dimmer">{n}</span>
              {name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function StepBody() {
  const step = useSlice(store, (s) => s.step);
  return (
    <div key={step} className="relative flex-1 overflow-y-auto px-5 pb-5 pt-3">
      {step === 1 && <Rehearse />}
      {step === 2 && <Predict />}
      {step === 3 && <Explain />}
      {step === 4 && <Prove />}
      {step === 5 && <Guide />}
    </div>
  );
}

function Caption() {
  const c = useSlice(store, (s) => s.caption);
  if (!c) return null;
  return (
    <div key={c} className="pointer-events-none mx-auto max-w-[720px] rounded-xl bg-ink/85 px-5 py-3 text-center text-[15px] leading-snug text-text backdrop-blur-[3px] fadein">
      {c}
    </div>
  );
}

function Legend() {
  return (
    <div className="pointer-events-auto flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-ink/80 px-3 py-1.5 text-[10.5px] text-dim backdrop-blur-[2px]">
      <span>people per m²</span>
      <span className="h-1.5 w-28 rounded-full" style={{ background: 'linear-gradient(90deg,#2C4750,#3F7A6B,#9AA24B,#C79338,#CC5F2C,#B02D1E)' }} />
      <span className="num">0 · 2 · 4 · 5.8</span>
    </div>
  );
}

export default function Console() {
  useSimTicker();
  useStoryCaptions();
  useKeys();
  useEffect(() => boot(), []);
  const top = useSlice(store, (s) => ({ name: s.scn.name, ledger: s.ledger.length, mode: s.mode }));
  const room = useSlice(roomStore, (r) => ({ id: r.id, n: r.snap?.participants.length || 0 }));

  return (
    <div className="grid h-dvh grid-rows-[52px_auto_minmax(0,1fr)] overflow-hidden bg-ink">
      <header className="no-print relative z-30 flex items-center gap-4 border-b border-line bg-ink px-5">
        <Link href="/" className="flex items-center gap-2.5 text-brass" aria-label="Pravaah home">
          <Logo className="size-6" />
          <span className="text-[13px] font-semibold tracking-[0.2em] text-text">PRAVAAH</span>
        </Link>
        <div className="hidden min-w-0 flex-col leading-tight lg:flex">
          <span className="truncate text-[11.5px] text-text">{top.name}</span>
          <span className="text-[10px] text-dimmer">rehearsal · every number from the simulation</span>
        </div>
        <nav className="ml-auto flex items-center gap-1">
          <button onClick={openRoom} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] text-dim hover:bg-panel-2 hover:text-text">
            <span className={cx('size-1.5 rounded-full', room.id ? 'bg-safe' : 'bg-dimmer')} />
            The Room{room.id ? <span className="num text-text">{room.n}</span> : null}
          </button>
          <button onClick={() => store.setState({ drawer: 'ledger' })} className="rounded-lg px-3 py-1.5 text-[12.5px] text-dim hover:bg-panel-2 hover:text-text">
            Black Box <span className="num text-dimmer">{top.ledger}</span>
          </button>
          <button onClick={() => store.setState({ drawer: 'about' })} className="rounded-lg px-3 py-1.5 text-[12.5px] text-dim hover:bg-panel-2 hover:text-text">
            How this works
          </button>
        </nav>
      </header>

      {/* Phase 5: the Decision Clock is its own full-width band, the single largest and boldest
          element on the page in every state — not a small pill sharing the 52px nav row with
          logo/links, which is all it could ever be at that size. */}
      <div className="no-print relative z-20">
        <DecisionClock />
      </div>

      <div className="grid min-h-0 grid-cols-[400px_minmax(0,1fr)]">
        <aside className="no-print z-20 flex min-h-0 flex-col border-r border-line bg-panel">
          <StepTabs />
          <StepBody />
        </aside>

        <main className="relative min-h-0 overflow-hidden">
          <FlowMap
            fitKey="dyPatil"
            getState={() => {
              const s = store.getState();
              return { scn: s.scn, cur: s.cur, ghost: s.ghost, tick: s.peek ?? s.tick, raviCur: s.raviCur, raviRelease: RAVI.release };
            }}
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col">
            <div className="flex items-start justify-between gap-4 p-4">
              <WhatIfBar />
              <div className="ml-auto flex flex-col gap-3">
                <Readouts />
                <RaviCard />
              </div>
            </div>
            <div className="mt-auto flex flex-col gap-3">
              <div className="flex items-end justify-between px-4">
                <div className="flex-1" />
                <Caption />
                <div className="flex flex-1 justify-end">
                  <Legend />
                </div>
              </div>
              <Timeline />
            </div>
          </div>
        </main>
      </div>
      <Drawers />
      <RoomPanel />
      <Toast />
      <MobileNotice />
    </div>
  );
}
