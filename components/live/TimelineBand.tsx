'use client';
/*
 * Slice 1 — "the three months before the match" answer. A compact row at the top of /live: N days
 * to match + a T-90..Match night stepper, always visible (brief: "Compact row at the top of
 * /live"). The chart, its sentence, and the "do by" playbook actions are secondary and sit behind
 * "More" (brief: "max 4 numbers visible at once, anything secondary behind More"). Every number
 * here already comes from a real simulate() run (lib/console.ts's timeline/timelineDueActions) or
 * from the editable playbook table (data/playbooks.csv) — nothing is invented in this component.
 */
import { useState } from 'react';
import { useSlice } from '@/lib/createStore';
import { approveTimelineAction, resetDemoDate, setDemoDate, setTimelineStep, skipTimelineAction, store, timelineDueActions } from '@/lib/console';
import { daysBetweenISO, timelineSentence, todayISO } from '@/lib/timeline';
import { crossesThreshold, WEATHER_THRESHOLD } from '@/lib/weather';
import { Button, cx, Pill } from '@/components/ui';
import type { DoByAction } from '@/engine';

const WEATHER_SOURCE_LABEL = { forecast: 'forecast', climatology: 'climatology (past 10 years)', sample: 'sample weather' } as const;

function DueCard({ a }: { a: DoByAction }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[13px] font-medium leading-snug text-text">{a.action}</div>
        <Pill tone={a.overdue ? 'danger' : a.daysUntilDue <= 3 ? 'brass' : 'default'}>{a.overdue ? 'overdue' : `do by ${a.doByISO}`}</Pill>
      </div>
      <div className="mt-1 text-[11.5px] text-dimmer">
        {a.owner} · {a.trigger}
      </div>
      {a.benefitMin != null ? (
        <div className="mt-1 text-[11.5px] text-brass">
          removes ~{a.benefitMin} dangerous minute{a.benefitMin === 1 ? '' : 's'} · simulated
        </div>
      ) : (
        <div className="mt-1 text-[11.5px] text-dimmer">playbook item · not simulated</div>
      )}
      <div className="mt-2 flex gap-1.5">
        <Button size="sm" variant="solid" onClick={() => approveTimelineAction(a)}>
          Approve
        </Button>
        <Button size="sm" variant="quiet" onClick={() => skipTimelineAction(a)}>
          Not now
        </Button>
      </div>
    </div>
  );
}

export default function TimelineBand() {
  const [expanded, setExpanded] = useState(false);
  // Only stable references here (each field is either a primitive or a store value that keeps the
  // same identity until something real changes it) — useSlice's shallow-equal cache needs that to
  // avoid re-rendering forever. `due` is derived below, in the render body, precisely because
  // timelineDueActions() allocates fresh objects on every call and must never be computed inside a
  // useSlice selector (see docs/DECISIONS.md — this is a real bug this component's own build caught).
  const s = useSlice(store, (st) => ({
    matchDateISO: st.matchDateISO,
    demoDateISO: st.demoDateISO,
    timeline: st.timeline,
    activeSnapshot: st.activeSnapshot,
    playbook: st.playbook,
    timelineDecisions: st.timelineDecisions,
    scn: st.scn,
    base: st.base,
    weather: st.weather,
  }));
  const due = expanded ? timelineDueActions(store.getState()) : [];

  const today = s.demoDateISO ?? todayISO();
  const daysToMatch = daysBetweenISO(today, s.matchDateISO);
  const isDemo = !!s.demoDateISO;

  return (
    <div className="no-print border-b border-line bg-panel/60 px-5 py-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-display text-[20px] leading-none text-text">
          <span className="num">{daysToMatch}</span> <span className="text-[12px] font-normal text-dim">day{daysToMatch === 1 ? '' : 's'} to match</span>
        </span>
        {isDemo ? (
          <Pill tone="brass">
            demo date {today}{' '}
            <button className="ml-1.5 underline hover:text-text" onClick={() => resetDemoDate()}>
              reset
            </button>
          </Pill>
        ) : null}

        {s.weather ? (
          <span title={s.weather.label}>
            <Pill tone={crossesThreshold(s.weather) ? 'danger' : 'default'}>
              {s.weather.chancePct}% rain · {WEATHER_SOURCE_LABEL[s.weather.source]}
            </Pill>
          </span>
        ) : null}

        {s.timeline ? (
          <div className="flex flex-wrap items-center gap-1">
            {s.timeline.steps.map((step) => (
              <button
                key={step.label}
                onClick={() => setTimelineStep(step.label)}
                className={cx(
                  'rounded-md px-2 py-1 text-[11.5px] transition-colors',
                  s.activeSnapshot === step.label ? 'bg-brass/20 text-brass' : 'text-dim hover:bg-panel-2 hover:text-text',
                )}
                title={step.dateISO}
              >
                {step.label}
              </button>
            ))}
            <input
              type="date"
              aria-label="Demo date"
              className="ml-1 rounded-md border border-line bg-panel-2 px-1.5 py-1 text-[11.5px] text-dim"
              value={s.demoDateISO ?? ''}
              onChange={(e) => e.target.value && setDemoDate(e.target.value)}
            />
          </div>
        ) : (
          <span className="text-[11.5px] text-dimmer">No ticket snapshots loaded — load the sample or your own data on /setup to unlock the T-90 stepper.</span>
        )}

        <button className="ml-auto text-[11.5px] text-dim underline hover:text-text" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Less' : 'More'}
        </button>
      </div>

      {expanded ? (
        <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3 sm:flex-row">
          {s.weather ? (
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="kicker !mb-0">Weather</div>
              <p className="text-[12px] text-dim">{s.weather.label}</p>
              <p className="text-[11.5px] text-dimmer">
                {crossesThreshold(s.weather)
                  ? `Crosses the threshold (${s.weather.chancePct}% ≥ ${WEATHER_THRESHOLD.probabilityPct}% and ${s.weather.amountMm}mm ≥ ${WEATHER_THRESHOLD.amountMm}mm) — the rain patch is applied.`
                  : `Below the threshold (${WEATHER_THRESHOLD.probabilityPct}% / ${WEATHER_THRESHOLD.amountMm}mm) — Calm on weather.`}
              </p>
            </div>
          ) : null}
          {s.timeline ? (
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="kicker !mb-0">When does it become a problem?</div>
              <div className="flex h-16 items-end gap-1.5">
                {s.timeline.steps.map((step) => {
                  const max = Math.max(1, ...s.timeline!.steps.map((x) => x.crushMin));
                  const h = Math.max(2, Math.round((step.crushMin / max) * 56));
                  return (
                    <div key={step.label} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className={cx('w-full rounded-t', step.crushMin > 0 ? 'bg-danger-soft/70' : 'bg-safe/50')}
                        style={{ height: h }}
                        title={`${step.label}: ${step.crushMin} dangerous minutes`}
                      />
                      <span className="text-[10px] text-dimmer">{step.label}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[12px] text-dim">{timelineSentence(s.timeline)}</p>
            </div>
          ) : null}

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="kicker !mb-0">Do by</div>
            {due.length ? due.map((a) => <DueCard key={a.id} a={a} />) : <p className="text-[12px] text-dim">Nothing due right now, or the playbook table hasn&apos;t loaded yet.</p>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
