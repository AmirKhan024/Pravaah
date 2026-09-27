'use client';
/*
 * Slice 3 — "After-event report (one screen, printable): promised vs happened per gate, what the
 * actions changed (with the do-nothing ghost as the comparison), and what we would change next
 * time." Reads the same shared store /live and /console already read (lib/console.ts) — nothing
 * here recomputes a simulation; it only lays out numbers already produced elsewhere. `.no-print`
 * (app/globals.css) hides the header/nav on paper; everything else is the report itself.
 */
import Link from 'next/link';
import { useSlice } from '@/lib/createStore';
import { store } from '@/lib/console';
import { comma, inr } from '@/engine';
import { Card, Delta, Kicker, Logo, Pill } from '@/components/ui';

function gateName(gateId: string): string {
  return store.getState().scn.zones.find((z) => z.id === gateId)?.name ?? gateId;
}

export default function Report() {
  const s = useSlice(store, (st) => ({
    scnName: st.scn.name,
    predicted: st.predicted,
    comparison: st.comparison,
    actualsSource: st.actualsSource,
    approved: st.approved,
    base: st.base,
    recalibration: st.recalibration,
    gateTrust: st.gateTrust,
  }));

  const takeaways: string[] = [];
  if (s.comparison) {
    for (const c of s.comparison) {
      if (Math.abs(c.pctDiff) > 15) {
        takeaways.push(
          `${gateName(c.gateId)} ran ${Math.abs(c.pctDiff)}% ${c.pctDiff > 0 ? 'busier' : 'quieter'} than predicted${
            c.peakShiftMin ? `, peak ${Math.abs(c.peakShiftMin)} min ${c.peakShiftMin < 0 ? 'earlier' : 'later'}` : ''
          } — next time, weight this gate's model toward ${c.pctDiff > 0 ? 'higher turnout' : 'lower turnout'}${c.peakShiftMin ? ` and a${c.peakShiftMin < 0 ? 'n earlier' : ' later'} arrival curve` : ''}.`,
        );
      }
    }
    if (!takeaways.length) takeaways.push('Every gate stayed within 15% of its predicted arrivals and peak timing — no model change indicated.');
  }

  return (
    <div className="min-h-dvh bg-ink px-5 py-8 text-text print:bg-white print:text-black">
      <div className="no-print mx-auto mb-6 flex max-w-[820px] items-center gap-2.5 text-brass">
        <Logo className="size-6" />
        <span className="text-[13px] font-semibold tracking-[0.2em] text-text">PRAVAAH</span>
        <span className="ml-auto flex gap-3 text-[12px] text-dimmer">
          <button onClick={() => window.print()} className="rounded-lg border border-line px-3 py-1.5 hover:border-brass-dim/60 hover:text-text">
            Print / save PDF
          </button>
          <Link href="/live" className="rounded-lg border border-line px-3 py-1.5 hover:border-brass-dim/60 hover:text-text">
            ← Back to Live Ops
          </Link>
        </span>
      </div>

      <div className="mx-auto flex max-w-[820px] flex-col gap-5">
        <div>
          <h1 className="font-display text-[26px] leading-tight">After-event report</h1>
          <p className="mt-1 text-[13px] text-dim">{s.scnName}</p>
        </div>

        {!s.predicted ? (
          <Card tone="danger">
            <Kicker>No prediction was frozen</Kicker>
            <p className="text-[13px] text-dim">Approve a plan on Live Ops first — this report reads the prediction frozen at that moment.</p>
          </Card>
        ) : (
          <>
            <Card>
              <Kicker right={<span>Same evening, same people</span>}>What the plan changed (vs. doing nothing)</Kicker>
              {s.approved ? (
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px]">
                  <span className="text-dim">Dangerous minutes</span>
                  <Delta from={s.base.crushMin} to={s.approved.result.crushMin} />
                  <span className="text-dim">Outside at showtime</span>
                  <Delta from={comma(s.base.missed)} to={comma(s.approved.result.missed)} />
                  <span className="text-dim">Cost</span>
                  <span className="num text-[14px] font-semibold text-brass">{s.approved.result.rupees ? inr(s.approved.result.rupees) : '₹0'}</span>
                  <span className="text-dim">Plan</span>
                  <span className="text-text">{s.approved.name}: {s.approved.ivs.map((iv) => iv.label).join('; ')}</span>
                </div>
              ) : (
                <p className="text-[13px] text-dim">No plan was approved — the numbers below are the do-nothing evening.</p>
              )}
            </Card>

            <Card>
              <Kicker right={<Pill tone={s.actualsSource === 'demo-feed' ? 'brass' : s.actualsSource === 'real' ? 'safe' : 'default'}>{s.actualsSource === 'demo-feed' ? 'demo feed' : s.actualsSource === 'real' ? 'real scan data' : 'no actuals yet'}</Pill>}>
                Promised vs. happened, per gate
              </Kicker>
              {!s.comparison ? (
                <p className="text-[13px] text-dim">No actual scan data has been loaded yet — load a demo feed or a real scan log on Live Ops.</p>
              ) : (
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="text-left text-dimmer">
                      <th className="pb-1.5 font-normal">Gate</th>
                      <th className="pb-1.5 font-normal">Predicted</th>
                      <th className="pb-1.5 font-normal">Actual</th>
                      <th className="pb-1.5 font-normal">Difference</th>
                      <th className="pb-1.5 font-normal">Peak shift</th>
                      <th className="pb-1.5 font-normal">Trust</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.comparison.map((c) => (
                      <tr key={c.gateId} className="border-t border-line/60">
                        <td className="py-1.5 text-text">{gateName(c.gateId)}</td>
                        <td className="py-1.5 num">{comma(c.predictedTotal)}</td>
                        <td className="py-1.5 num">{comma(c.actualTotal)}</td>
                        <td className={`py-1.5 num ${Math.abs(c.pctDiff) > 15 ? 'text-danger-soft' : 'text-safe'}`}>
                          {c.pctDiff > 0 ? '+' : ''}
                          {c.pctDiff}%
                        </td>
                        <td className="py-1.5 num">{c.peakShiftMin === 0 ? '—' : `${c.peakShiftMin > 0 ? '+' : ''}${c.peakShiftMin} min`}</td>
                        <td className="py-1.5">
                          <Pill tone={s.gateTrust[c.gateId] === 'verified' ? 'safe' : 'default'}>{s.gateTrust[c.gateId] === 'verified' ? 'verified by event' : 'claimed'}</Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {s.recalibration ? (
                <p className="mt-3 text-[12.5px] text-dim">
                  After recalibrating from these actuals: forecast error <span className="num text-text">{s.recalibration.errorBefore}%</span> →{' '}
                  <span className="num text-safe">{s.recalibration.errorAfter}%</span>.
                </p>
              ) : null}
            </Card>

            <Card>
              <Kicker>What we would change next time</Kicker>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[13px] text-dim">
                {takeaways.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </Card>

            <p className="text-[11.5px] text-dimmer">
              Pravaah checks that predicted and actual gate arrivals match. {s.actualsSource === 'demo-feed' ? 'These actuals are a demo feed, not real scan data.' : ''} It does not certify safety.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
