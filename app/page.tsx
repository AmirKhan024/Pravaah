import Link from 'next/link';
import { Logo } from '@/components/ui';
import CoverVisual from './CoverVisual';

const STEPS = [
  { n: '01', k: 'Rehearse', t: 'Replay the whole evening, minute by minute, before anyone leaves home.' },
  { n: '02', k: 'Predict', t: 'Run it sixty times. Where does it break, when, and how likely?' },
  { n: '03', k: 'Explain', t: 'Remove one cause at a time and re-run. Proof, not a guess.' },
  { n: '04', k: 'Prove', t: 'Simulate every fix. Show the winner, and the ones that fail.' },
  { n: '05', k: 'Guide', t: 'Orders to hotels, trains, gate staff and every phone, in Marathi, Hindi and English.' },
];

const EDGES = [
  {
    k: 'The Decision Clock',
    t: 'Not just what to do. How many minutes you have left to do it, tested against twelve rough nights. When it hits zero, you see what waiting cost.',
  },
  {
    k: 'The Room',
    t: 'Judges scan a code and join the crowd. When the plan is approved, their phones buzz. Their yes and no replace our assumption, and the evening re-runs.',
  },
  {
    k: 'The Red Team',
    t: 'We try to break our own plan on 192 bad nights: rain, rail failure, late gates, a bigger crowd. We show you where it fails, and the backup.',
  },
  {
    k: 'Where people sleep',
    t: 'Hotels, trains and gates live in one simulation. Booking empty rooms far away changes the density at a gate three kilometres from them.',
  },
];

export default function Home() {
  return (
    <div className="min-h-dvh bg-ink">
      <header className="mx-auto flex max-w-[1320px] items-center gap-6 px-6 py-5 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5 text-brass">
          <Logo className="size-7" />
          <span className="text-[15px] font-semibold tracking-[0.22em] text-text">PRAVAAH</span>
        </Link>
        <nav className="ml-auto hidden items-center gap-1 text-[13px] text-dim sm:flex">
          <Link href="/replay" className="rounded-lg px-3 py-1.5 hover:bg-panel-2 hover:text-text">
            Replay 4 June
          </Link>
          <Link href="/venues" className="rounded-lg px-3 py-1.5 hover:bg-panel-2 hover:text-text">
            Any venue
          </Link>
          <Link href="/console" className="ml-2 rounded-lg border border-brass-dim px-3.5 py-1.5 text-brass hover:bg-[#1d1c14]">
            Open the console
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-[1320px] gap-10 px-6 pb-16 pt-6 sm:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:pt-14">
        <div className="flex flex-col justify-center">
          <div className="kicker rise !text-brass-dim">4 June 2025 · Bengaluru</div>
          <p className="rise mt-4 max-w-[560px] text-[17px] leading-relaxed text-dim" style={{ animationDelay: '80ms' }}>
            Eleven people died outside a stadium. The crowd was not violent. It arrived faster than the gates could take it, and nobody knew until it was too late.
          </p>
          <h1 className="rise mt-8 font-display text-[52px] leading-[0.98] tracking-[-0.015em] text-text sm:text-[76px]" style={{ animationDelay: '220ms' }}>
            A flight simulator
            <br />
            <span className="italic text-brass">for the evening</span>
            <br />
            before it happens.
          </h1>
          <p className="rise mt-7 max-w-[560px] text-[16.5px] leading-relaxed text-dim" style={{ animationDelay: '360ms' }}>
            Pravaah rehearses the whole event: hotels, trains, roads and gates in one simulation. It finds the minute the crowd will break, proves why, tests every fix, and tells you <b className="font-semibold text-text">how many minutes you have left to act</b>.
          </p>
          <div className="rise mt-9 flex flex-wrap gap-3" style={{ animationDelay: '480ms' }}>
            <Link href="/console" className="inline-flex h-12 items-center gap-2 rounded-lg bg-brass px-6 text-[15px] font-semibold text-ink hover:bg-brass-glow">
              Rehearse tonight at DY Patil <span aria-hidden>→</span>
            </Link>
            <Link href="/replay" className="inline-flex h-12 items-center rounded-lg border border-line px-5 text-[14.5px] text-text hover:border-brass-dim">
              Replay 4 June, respectfully
            </Link>
          </div>
          <div className="rise mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-dimmer" style={{ animationDelay: '600ms' }}>
            <span>No cameras</span>
            <span>No sensors</span>
            <span>No AI inventing numbers</span>
            <span>Works offline</span>
          </div>
        </div>
        <div className="relative h-[420px] overflow-hidden rounded-3xl border border-line bg-[#0c1211] sm:h-[560px]">
          <CoverVisual />
        </div>
      </section>

      <section className="border-y border-line bg-panel/40">
        <div className="mx-auto max-w-[1320px] px-6 py-16 sm:px-10">
          <p className="max-w-[980px] font-display text-[34px] leading-[1.15] text-text sm:text-[44px]">
            Every other system watches the crush happen. <span className="text-brass">Pravaah tells you forty minutes early, proves why, and tells you how long you have left to stop it.</span>
          </p>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-5">
            {STEPS.map((s) => (
              <div key={s.n} className="bg-ink p-5">
                <div className="num text-[12px] text-brass-dim">{s.n}</div>
                <div className="mt-2 text-[16px] font-semibold">{s.k}</div>
                <p className="mt-2 text-[13px] leading-relaxed text-dim">{s.t}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-6 py-16 sm:px-10">
        <div className="kicker">What no one else has</div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {EDGES.map((e) => (
            <div key={e.k} className="rounded-2xl border border-line bg-panel-2/50 p-6">
              <div className="font-display text-[28px] leading-tight">{e.k}</div>
              <p className="mt-3 text-[14.5px] leading-relaxed text-dim">{e.t}</p>
            </div>
          ))}
        </div>
        <div className="mt-14 grid gap-8 rounded-2xl border border-line p-7 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="font-display text-[30px] leading-tight">Same 84,000 people. Same stadium. Same evening. Different decisions.</div>
            <p className="mt-3 max-w-[760px] text-[14px] leading-relaxed text-dim">
              Every number in Pravaah comes from running the evening. Causes are proven by removing them and re-running. Fixes are proven by applying them. A language model only helps with words, and never touches a number.
            </p>
          </div>
          <Link href="/console" className="inline-flex h-12 items-center justify-center rounded-lg bg-brass px-6 text-[15px] font-semibold text-ink hover:bg-brass-glow">
            Open the console →
          </Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-6 gap-y-2 px-6 py-6 text-[12px] text-dimmer sm:px-10">
          <span>Pravaah · Team Grid9 · HackCelestial 3.0 · PS-8 Mega-Event Hospitality Orchestration</span>
          <span className="ml-auto">Stadium and hotel figures are illustrative estimates, labelled as such inside.</span>
        </div>
      </footer>
    </div>
  );
}
