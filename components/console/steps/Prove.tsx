'use client';
/*
 * Phase 4: restructured into tabs so only one section is visible at a time (previously this
 * panel stacked plan cards -> rejected fixes -> decision window -> Red Team teaser -> build-your-
 * own -> cost-of-waiting chart in one long scroll). Layout/IA change only — every number, every
 * data source, is untouched from before this pass.
 */
import { useState } from 'react';
import { useSlice } from '@/lib/createStore';
import { approve, clock, PROFILE_NAMES, runRedTeamFor, selectedPlan, store, waitingCost } from '@/lib/console';
import { planResult } from '@/lib/planCache';
import { comma, inr, leverWorth, PROFILES, type ProfileName } from '@/engine';
import { Busy, Button, cx, Delta, Pill } from '@/components/ui';
import { StepHead } from './StepHead';
import CostOfWaiting from '../CostOfWaiting';

type Tab = 'plan' | 'why' | 'timing' | 'stress';
const TABS: { id: Tab; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'why', label: 'Why it works' },
  { id: 'timing', label: 'Timing' },
  { id: 'stress', label: 'Stress test' },
];

function PlanCard({ name, active, onPick }: { name: ProfileName; active: boolean; onPick: () => void }) {
  const s = useSlice(store, (s) => ({ p: s.plans[name], base: s.base, scn: s.scn, waits: s.waits }));
  if (!s.p) return <div className="h-[74px] rounded-xl border border-line bg-panel-2/40 busy-bar" />;
  const r = planResult(s.scn, s.p.chosen, s.waits);
  const rec = name === 'Zero rupees';
  return (
    <button onClick={onPick} className={cx('w-full rounded-xl border p-3.5 text-left transition-colors', active ? 'border-brass bg-[#1d1c14]' : 'border-line bg-panel-2/50 hover:border-brass-dim')}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[14.5px] font-semibold">{name}</span>
          {rec ? <Pill tone="brass">Recommended</Pill> : null}
        </div>
        <span className={cx('num text-[15px] font-semibold', r.rupees === 0 ? 'text-brass' : 'text-text')}>{r.rupees ? inr(r.rupees) : '₹0'}</span>
      </div>
      <div className="mt-0.5 text-[11.5px] text-dim">{PROFILES[name].sub}</div>
      <div className="mt-2 flex items-center justify-between">
        <Delta from={s.base.crushMin} to={r.crushMin} unit="dangerous min" />
        <span className="text-[11px] text-dimmer">{s.p.chosen.length} moves</span>
      </div>
      {active ? (
        <ul className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          {s.p.chosen.map((c) => (
            <li key={c.label} className="text-[12.5px] leading-snug">
              <div className="text-text">{c.label}</div>
              <div className="text-[11.5px] text-dim">{leverWorth(s.scn, c, r)}</div>
            </li>
          ))}
        </ul>
      ) : null}
    </button>
  );
}

function PlanTab() {
  const s = useSlice(store, (s) => ({ base: s.base, selected: s.selected, replan: s.replan, user: s.userPlan.length }));
  return (
    <div className="flex flex-col gap-3">
      {s.replan ? (
        <div className="rounded-xl border border-danger/40 bg-[#221512] p-4 rise">
          <div className="kicker mb-1 !text-danger-soft">Plan B · from {clock(s.replan.atTick)}</div>
          <p className="text-[13px] leading-relaxed text-dim">
            The free moves closed. This is the best plan still possible: <Delta from={s.base.crushMin} to={s.replan.crushMin} unit="dangerous min" /> for {s.replan.rupees ? inr(s.replan.rupees) : '₹0'}.{' '}
            <b className="text-text">{waitingCost(s.replan.lostMin, s.replan.lostRupees)}</b>
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-[12.5px]">
            {s.replan.chosen.map((c) => (
              <li key={c.label}>· {c.label}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {PROFILE_NAMES.map((n) => (
        <PlanCard key={n} name={n} active={s.selected === n && !s.replan} onPick={() => store.setState({ selected: n })} />
      ))}
      {/* Advanced: build-your-own-plan, deliberately tucked away — not part of the default demo path */}
      <button onClick={() => store.setState({ drawer: 'deck' })} className="self-start text-[11.5px] text-dimmer underline decoration-line underline-offset-2 hover:text-dim">
        Advanced: build your own plan{s.user ? ` (${s.user} moves chosen)` : ''} →
      </button>
    </div>
  );
}

function WhyTab() {
  const s = useSlice(store, (s) => ({ rejected: s.rejected }));
  if (!s.rejected) return <Busy label="simulating the plans that look right, but fail…" />;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] leading-relaxed text-dim">Every one of these is simulated, not asserted. Each was a plausible-sounding fix; the engine shows why it doesn&apos;t work.</p>
      {s.rejected.map((r) => (
        <div key={r.name} className="rounded-xl border border-line bg-panel-2/40 px-3.5 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-medium">{r.name}</span>
            <span className="num shrink-0 text-[12px] text-danger-soft">still {r.left} dangerous min</span>
          </div>
          <div className="mt-1 text-[12px] leading-snug text-dim">{r.why}</div>
        </div>
      ))}
    </div>
  );
}

function Board() {
  const s = useSlice(store, (s) => ({ board: s.board, t: Math.floor(s.tick), prog: s.progress.board || 0, expired: s.expired, approved: !!s.approved }));
  if (!s.board) return <Busy label="testing when each move stops working, on 12 rough nights…" f={s.prog} />;
  const list = s.board.filter((o) => !o.useless);
  return (
    <div className="flex flex-col divide-y divide-line-soft">
      {list.map((o) => {
        const left = o.deadlineTick - s.t;
        const gone = left <= 0 || s.expired.indexOf(o.label) >= 0;
        return (
          <button key={o.id} onClick={() => store.setState({ drawer: 'board' })} className="flex items-center justify-between gap-3 py-2.5 text-left">
            <span className={cx('text-[12.5px] leading-snug', gone && 'text-dimmer line-through')}>{o.label}</span>
            <span className={cx('num shrink-0 rounded-md px-2 py-0.5 text-[12px] font-semibold', gone ? 'text-danger-soft' : left <= 15 ? 'bg-danger/15 text-danger-soft' : left <= 40 ? 'bg-brass/10 text-brass' : 'text-dim')}>
              {gone ? 'closed' : `${left} min`}
            </span>
          </button>
        );
      })}
      {s.board.filter((o) => o.useless).map((o) => (
        <div key={o.id} className="flex items-center justify-between gap-3 py-2.5">
          <span className="text-[12.5px] leading-snug text-dim">{o.label}</span>
          <span className="shrink-0 text-[11px] text-dimmer">no deadline</span>
        </div>
      ))}
    </div>
  );
}

function TimingTab() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="kicker mb-1">Time left for each move</div>
        <div className="mb-1 text-[11.5px] text-dimmer">Tested against 12 rough versions of tonight. The most cautious answer.</div>
        <Board />
      </div>
      <CostOfWaiting />
    </div>
  );
}

function StressTab() {
  const s = useSlice(store, (s) => ({ rt: s.redTeam, rtFor: s.redTeamFor, rtBusy: s.redTeamBusy, rtProg: s.redTeamProgress }));
  const cur = selectedPlan(store.getState());
  return (
    <div className="rounded-xl border border-line bg-panel-2/60 p-4">
      <div className="kicker mb-1">Red team</div>
      {s.rt && s.rtFor === cur?.name ? (
        <button onClick={() => store.setState({ drawer: 'redteam' })} className="w-full text-left">
          <div className="text-[14px] leading-snug">
            <b className="num text-[18px]">{s.rt.survived}</b> of {s.rt.total} rough nights stay safe. Worse than doing nothing on <b className="num">{s.rt.tiers.worse}</b>.
          </div>
          <div className="mt-1 text-[12px] text-brass">See where it breaks, and the backup plan →</div>
        </button>
      ) : (
        <>
          <p className="text-[13px] leading-relaxed text-dim">We try to break our own plan: more people, rain, the rail line failing, gates opening late, slower bag checks. Every combination.</p>
          {s.rtBusy ? <Busy label={`running rough night ${Math.round(s.rtProg * 192)} of 192…`} f={s.rtProg} /> : <Button className="mt-3 w-full" onClick={runRedTeamFor}>Try to break “{cur?.name || 'this plan'}”</Button>}
        </>
      )}
    </div>
  );
}

export default function Prove() {
  const s = useSlice(store, (s) => ({ plans: s.plans, done: s.plansDone }));
  const [tab, setTab] = useState<Tab>('plan');
  const cur = selectedPlan(store.getState());
  const rec = s.plans['Zero rupees'];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <StepHead n={4} verb="Prove" title={rec ? (rec.rupees === 0 && rec.crushMin === 0 ? <>The best fix costs ₹0.</> : <>The best plan tonight</>) : <>Trying every plan…</>}>
        {s.done ? (
          <>
            Pravaah tried <b className="num text-text">{s.done.evals}</b> plans in <span className="num">{comma(s.done.ms)}</span> ms. Each one is a full re-run of the evening. {rec && rec.rupees === 0 ? 'The winner just tells people the truth about the empty gate.' : null}
          </>
        ) : (
          'Every combination of moves is simulated. The one that works best, for the least, wins.'
        )}
      </StepHead>

      <div className="flex gap-1 rounded-lg border border-line bg-ink/50 p-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cx('flex-1 rounded-md px-2 py-1.5 text-[12.5px] font-medium transition-colors', tab === t.id ? 'bg-panel-2 text-brass' : 'text-dim hover:text-text')}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1">
        {tab === 'plan' && <PlanTab />}
        {tab === 'why' && <WhyTab />}
        {tab === 'timing' && <TimingTab />}
        {tab === 'stress' && <StressTab />}
      </div>

      <div className="sticky bottom-0 -mx-5 mt-auto border-t border-line bg-panel px-5 py-3">
        <Button variant="solid" size="lg" className="w-full" disabled={!cur || !cur.chosen.length} onClick={() => approve()}>
          Approve {cur?.name ? `“${cur.name}”` : 'plan'} and send the orders
        </Button>
      </div>
    </div>
  );
}
