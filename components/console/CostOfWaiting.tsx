'use client';
/*
 * "Every minute you wait costs": the selected plan, started at different times, each one a real
 * re-run of the evening (lite, ~8 ms). The line is data; the marker is now.
 */
import { useMemo } from 'react';
import { useSlice } from '@/lib/createStore';
import { clock, selectedPlan, store } from '@/lib/console';
import { planResult } from '@/lib/planCache';
import { retime, type Lever, type Scenario } from '@/engine';

export function crushIfStartedAt(scn: Scenario, plan: Lever[], waits: Record<string, number>, t: number) {
  return planResult(scn, plan.map((c) => retime(c, Math.round(t))), waits).crushMin;
}

export default function CostOfWaiting() {
  const s = useSlice(store, (s) => ({ scn: s.scn, waits: s.waits, base: s.base.crushMin, t: Math.floor(s.tick), plan: selectedPlan(s), approved: s.approved }));
  const pts = useMemo(() => {
    if (!s.plan || !s.plan.chosen.length) return [];
    const out: { t: number; c: number }[] = [];
    for (let t = s.scn.gatesOpenTick; t <= s.scn.showStartTick; t += 10) out.push({ t, c: crushIfStartedAt(s.scn, s.plan.chosen, s.waits, t) });
    return out;
  }, [s.plan, s.scn, s.waits]);
  if (!pts.length || s.approved) return null;
  const now = Math.max(s.scn.gatesOpenTick, s.t);
  const nowC = crushIfStartedAt(s.scn, s.plan!.chosen, s.waits, now);
  const W = 320,
    H = 64,
    t0 = pts[0].t,
    t1 = pts[pts.length - 1].t;
  const max = Math.max(1, s.base);
  const x = (t: number) => 6 + ((t - t0) / (t1 - t0)) * (W - 12);
  const y = (c: number) => H - 12 - (c / max) * (H - 22);
  const fullUntil = pts.filter((p) => p.c <= 0).pop();
  return (
    <div className="rounded-xl border border-line bg-panel-2/60 p-4">
      <div className="flex items-baseline justify-between">
        <span className="kicker !mb-0">The cost of waiting</span>
        <span className="text-[12px] text-dim">
          start now: <b className={nowC === 0 ? 'num text-safe' : 'num text-danger-soft'}>{nowC}</b> dangerous min
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" aria-label="Dangerous minutes left, by when you start the plan">
        <line x1={6} x2={W - 6} y1={y(s.base)} y2={y(s.base)} stroke="rgba(224,99,79,.35)" strokeDasharray="3 3" />
        <text x={W - 6} y={y(s.base) - 3} textAnchor="end" fontSize="8.5" fill="rgba(224,99,79,.7)">
          doing nothing: {s.base}
        </text>
        <polyline fill="none" stroke="#C9A961" strokeWidth={1.8} points={pts.map((p) => `${x(p.t)},${y(p.c)}`).join(' ')} />
        {now <= t1 ? (
          <>
            <line x1={x(now)} x2={x(now)} y1={4} y2={H - 12} stroke="#DCE5E1" strokeWidth={1} />
            <circle cx={x(now)} cy={y(nowC)} r={3.2} fill={nowC === 0 ? '#6FB39A' : '#E0634F'} />
          </>
        ) : null}
        {[t0, Math.round((t0 + t1) / 2 / 30) * 30, t1].map((t) => (
          <text key={t} x={x(t)} y={H - 1} fontSize="8.5" fill="#586662" textAnchor="middle" fontFamily="monospace">
            {clock(t)}
          </text>
        ))}
      </svg>
      <div className="mt-1 text-[11.5px] leading-snug text-dimmer">
        {fullUntil ? `Started by ${clock(fullUntil.t)}, this plan removes every dangerous minute. ` : ''}Each point is the whole evening re-run with the plan starting at that time.
      </div>
    </div>
  );
}
