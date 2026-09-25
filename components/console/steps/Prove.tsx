'use client';
import { useMemo, useState } from 'react';
import { useSlice } from '@/lib/createStore';
import { approve, clock, PROFILE_NAMES, runRedTeamFor, selectedPlan, store } from '@/lib/console';
import { planResult } from '@/lib/planCache';
import { candidates, comma, feasible, inr, leverWorth, PROFILES, type Lever, type ProfileName } from '@/engine';
import { Busy, Button, cx, Delta, Pill } from '@/components/ui';
import { StepHead } from './StepHead';
import CostOfWaiting from '../CostOfWaiting';

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

function Deck() {
  const s = useSlice(store, (s) => ({ scn: s.scn, waits: s.waits, base: s.base, user: s.userPlan, selected: s.selected }));
  const C = useMemo(() => candidates(s.scn), [s.scn]);
  const r = planResult(s.scn, s.user, s.waits);
  const toggle = (c: Lever) => {
    const on = s.user.indexOf(c) >= 0;
    const next = on ? s.user.filter((x) => x !== c) : [...s.user, c];
    if (!on && !feasible(next)) return;
    store.setState({ userPlan: next, selected: 'Your plan' });
  };
  const peak = (x: number[]) => Math.max(...x).toFixed(1);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-xl border border-line bg-ink/60 p-3">
        <div className="col-span-2 kicker !mb-1">What will happen · updates as you choose</div>
        <span className="text-[12px] text-dim">Dangerous minutes</span>
        <Delta from={s.base.crushMin} to={r.crushMin} />
        <span className="text-[12px] text-dim">Most crowded spot</span>
        <Delta from={peak(s.base.peakDen)} to={peak(r.peakDen)} unit="/m²" />
        <span className="text-[12px] text-dim">Longest gate wait</span>
        <Delta from={Math.round(s.base.maxGateWait)} to={Math.round(r.maxGateWait)} unit="min" />
        <span className="text-[12px] text-dim">Outside at showtime</span>
        <Delta from={comma(s.base.missed)} to={comma(r.missed)} />
        <span className="text-[12px] text-dim">Cost to you</span>
        <span className="num text-[14px] font-semibold text-brass">{r.rupees ? inr(r.rupees) : '₹0'}</span>
      </div>
      <div className="flex max-h-[260px] flex-col gap-1 overflow-y-auto pr-1">
        {C.map((c) => {
          const on = s.user.indexOf(c) >= 0;
          const ok = on || feasible([...s.user, c]);
          return (
            <label key={c.label} className={cx('flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px] leading-snug hover:bg-panel-2', !ok && 'opacity-35')}>
              <input type="checkbox" checked={on} disabled={!ok} onChange={() => toggle(c)} className="mt-0.5 accent-[#C9A961]" />
              <span>{c.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function Prove() {
  const s = useSlice(store, (s) => ({
    plans: s.plans,
    done: s.plansDone,
    base: s.base,
    rejected: s.rejected,
    selected: s.selected,
    replan: s.replan,
    rt: s.redTeam,
    rtFor: s.redTeamFor,
    rtBusy: s.redTeamBusy,
    rtProg: s.redTeamProgress,
    user: s.userPlan.length,
  }));
  const [deck, setDeck] = useState(false);
  const rec = s.plans['Zero rupees'];
  const cur = selectedPlan(store.getState());
  return (
    <div className="flex flex-col gap-5">
      <StepHead n={4} verb="Prove" title={rec ? (rec.rupees === 0 && rec.crushMin === 0 ? <>The best fix costs ₹0.</> : <>The best plan tonight</>) : <>Trying every plan…</>}>
        {s.done ? (
          <>
            Pravaah tried <b className="num text-text">{s.done.evals}</b> plans in <span className="num">{comma(s.done.ms)}</span> ms. Each one is a full re-run of the evening. {rec && rec.rupees === 0 ? 'The winner just tells people the truth about the empty gate.' : null}
          </>
        ) : (
          'Every combination of moves is simulated. The one that works best, for the least, wins.'
        )}
      </StepHead>

      {s.replan ? (
        <div className="rounded-xl border border-danger/40 bg-[#221512] p-4 rise">
          <div className="kicker mb-1 !text-danger-soft">Plan B · from {clock(s.replan.atTick)}</div>
          <p className="text-[13px] leading-relaxed text-dim">
            The free moves closed. This is the best plan still possible: <Delta from={s.base.crushMin} to={s.replan.crushMin} unit="dangerous min" /> for {s.replan.rupees ? inr(s.replan.rupees) : '₹0'}.{' '}
            <b className="text-text">Waiting cost {s.replan.lostMin} more dangerous minutes.</b>
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-[12.5px]">
            {s.replan.chosen.map((c) => (
              <li key={c.label}>· {c.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {PROFILE_NAMES.map((n) => (
          <PlanCard key={n} name={n} active={s.selected === n && !s.replan} onPick={() => store.setState({ selected: n })} />
        ))}
      </div>

      {s.rejected ? (
        <div>
          <div className="kicker mb-2">Fixes that look right, but fail</div>
          <div className="flex flex-col gap-2">
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
        </div>
      ) : null}

      <div>
        <div className="kicker mb-1">Time left for each move</div>
        <div className="mb-1 text-[11.5px] text-dimmer">Tested against 12 rough versions of tonight. The most cautious answer.</div>
        <Board />
      </div>

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

      <div>
        <button onClick={() => setDeck(!deck)} className="flex w-full items-center justify-between text-left">
          <span className="kicker !mb-0">Build your own plan</span>
          <span className="text-[12px] text-dim">{deck ? 'hide' : s.user ? `${s.user} moves chosen` : 'open'}</span>
        </button>
        {deck ? (
          <div className="mt-3">
            <Deck />
          </div>
        ) : null}
      </div>

      <CostOfWaiting />

      <div className="sticky bottom-0 -mx-5 border-t border-line bg-panel px-5 py-3">
        <Button variant="solid" size="lg" className="w-full" disabled={!cur || !cur.chosen.length} onClick={() => approve()}>
          Approve {cur?.name ? `“${cur.name}”` : 'plan'} and send the orders
        </Button>
      </div>
    </div>
  );
}
