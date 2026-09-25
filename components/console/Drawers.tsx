'use client';
import { useState, type ReactNode } from 'react';
import { useSlice } from '@/lib/createStore';
import { clock, store } from '@/lib/console';
import { verifyLedger, type LedgerEntry } from '@/lib/ledger';
import { BOARD_CHECKS, comma, inr, type RedTeamNight } from '@/engine';
import { Button, cx, Delta, Kicker, Pill, Row } from '@/components/ui';

function Shell({ title, sub, children, wide }: { title: ReactNode; sub?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog">
      <button aria-label="Close" className="absolute inset-0 bg-ink/50" onClick={() => store.setState({ drawer: null })} />
      <div className={cx('relative h-full overflow-y-auto border-l border-line bg-panel px-7 pb-10 pt-6 shadow-2xl rise', wide ? 'w-[min(760px,100vw)]' : 'w-[min(520px,100vw)]')}>
        <button onClick={() => store.setState({ drawer: null })} className="absolute right-5 top-5 rounded-md px-2 py-1 text-[13px] text-dim hover:bg-panel-2 hover:text-text">
          ✕
        </button>
        <h3 className="pr-10 font-display text-[30px] leading-tight">{title}</h3>
        {sub ? <p className="mt-2 text-[13.5px] leading-relaxed text-dim">{sub}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

const TIER: Record<RedTeamNight['tier'], { c: string; label: string }> = {
  safe: { c: 'bg-safe', label: 'safe' },
  better: { c: 'bg-brass', label: 'better than doing nothing' },
  same: { c: 'bg-dim', label: 'no change' },
  worse: { c: 'bg-danger', label: 'worse than doing nothing' },
};

function RedTeamDrawer() {
  const s = useSlice(store, (s) => ({ rt: s.redTeam, busy: s.redTeamBusy, f: s.redTeamProgress, name: s.redTeamFor, scn: s.scn }));
  if (!s.rt || s.busy)
    return (
      <Shell title="Trying to break our own plan" sub="Every combination of a bad night, run twice: once doing nothing, once with the plan.">
        <div className="h-1 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-brass transition-[width]" style={{ width: Math.round(s.f * 100) + '%' }} />
        </div>
        <div className="num mt-2 text-[12px] text-dim">rough night {Math.round(s.f * 192)} of 192</div>
      </Shell>
    );
  const rt = s.rt;
  const turnouts = [...new Set(rt.nights.map((n) => n.f.turnout))];
  const rails = [...new Set(rt.nights.map((n) => JSON.stringify(n.f.railFail)))].map((x) => JSON.parse(x) as number | null);
  const lates = [...new Set(rt.nights.map((n) => n.f.gatesLate))];
  const cell = (to: number, rain: boolean, rf: number | null, gl: number, sl: boolean) => rt.nights.find((n) => n.f.turnout === to && n.f.rain === rain && n.f.railFail === rf && n.f.gatesLate === gl && n.f.slowLanes === sl)!;
  return (
    <Shell
      wide
      title={
        <>
          Safe on <span className="num text-safe">{rt.survived}</span> of {rt.total} rough nights.
        </>
      }
      sub={`We tried to break “${s.name}”. More people, rain, the rail line failing, gates opening late, slower bag checks: every combination, each night run twice. Safe means 5 or fewer dangerous minutes and nobody extra left outside.`}
    >
      <div className="flex h-3 overflow-hidden rounded-full">
        {(['safe', 'better', 'same', 'worse'] as const).map((t) => (rt.tiers[t] ? <div key={t} className={TIER[t].c} style={{ width: (rt.tiers[t] / rt.total) * 100 + '%' }} /> : null))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-dim">
        {(['safe', 'better', 'same', 'worse'] as const).map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <i className={cx('size-2 rounded-full', TIER[t].c)} />
            <b className="num text-text">{rt.tiers[t]}</b> {TIER[t].label}
          </span>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="border-separate border-spacing-[3px] text-[10.5px] text-dimmer">
          <thead>
            <tr>
              <th />
              {rails.map((rf) => (
                <th key={String(rf)} colSpan={lates.length * 2} className="px-1 text-left font-medium text-dim">
                  {rf == null ? 'rail runs' : 'rail fails ' + clock(rf)}
                </th>
              ))}
            </tr>
            <tr>
              <th />
              {rails.map((rf) =>
                lates.map((gl) => (
                  <th key={String(rf) + gl} colSpan={2} className="font-normal">
                    {gl ? `+${gl}m` : 'on time'}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {turnouts.map((to) =>
              [false, true].map((rain) => (
                <tr key={to + String(rain)}>
                  <td className="whitespace-nowrap pr-2 text-right text-dim">
                    {to === 1 ? 'normal crowd' : to > 1 ? `+${Math.round((to - 1) * 100)}% people` : `${Math.round((to - 1) * 100)}% people`}
                    {rain ? ' · rain' : ''}
                  </td>
                  {rails.map((rf) =>
                    lates.map((gl) =>
                      [false, true].map((sl) => {
                        const n = cell(to, rain, rf, gl, sl);
                        return <td key={String(rf) + gl + sl} title={`${n.labels.join(', ') || 'an ordinary night'}: ${n.planCrush} dangerous min with the plan, ${n.noneCrush} doing nothing`} className={cx('size-4 rounded-[3px]', TIER[n.tier].c, n === rt.worst && 'outline outline-2 outline-text')} />;
                      }),
                    ),
                  )}
                </tr>
              )),
            )}
          </tbody>
        </table>
        <div className="mt-1 text-[10.5px] text-dimmer">each pair of squares: normal bag checks, then 10% slower · hover for the numbers</div>
      </div>

      {rt.breaksWhen.length ? (
        <div className="mt-6">
          <Kicker>It breaks mainly when</Kicker>
          <div className="flex flex-wrap gap-1.5">
            {rt.breaksWhen.slice(0, 6).map((b) => (
              <Pill key={b.label} tone="danger">
                {b.label} · fails {Math.round(b.failRate * 100)}%
              </Pill>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 rounded-xl border border-danger/40 bg-[#221512] p-4">
        <Kicker>The worst night we found</Kicker>
        <div className="text-[15px] font-medium leading-snug">{rt.worst.labels.join(', ') || 'an ordinary night'}</div>
        <div className="mt-2 text-[13px] text-dim">
          With the plan: <b className="num text-danger-soft">{rt.worst.planCrush}</b> dangerous minutes. Doing nothing: <span className="num">{rt.worst.noneCrush}</span>.
          {rt.worst.planCrush > rt.worst.noneCrush ? ' On this night the plan sends people to a gate that cannot cope. We would rather tell you than hide it.' : null}
        </div>
      </div>

      {rt.backup ? (
        <div className="mt-3 rounded-xl border border-brass-dim/60 bg-[#1d1c14] p-4">
          <Kicker>Backup plan for that night</Kicker>
          <ul className="flex flex-col gap-1 text-[13px]">
            {rt.backup.chosen.map((c) => (
              <li key={c.label}>· {c.label}</li>
            ))}
          </ul>
          <div className="mt-2 text-[13px] text-dim">
            On the worst night: <Delta from={rt.worst.planCrush} to={rt.backup.crush} unit="dangerous min" /> for {rt.backup.rupees ? inr(rt.backup.rupees) : '₹0'}.
          </div>
        </div>
      ) : null}
    </Shell>
  );
}

function BoardDrawer() {
  const s = useSlice(store, (s) => ({ board: s.board, t: Math.floor(s.tick) }));
  return (
    <Shell title="How long each move still works" sub="For each move, on each of 12 rough versions of tonight, Pravaah re-ran the whole evening starting the move at six different times. The deadline shown is the earliest across all 12 nights: the most cautious answer, not the average.">
      {!s.board ? (
        <div className="text-dim">Still testing…</div>
      ) : (
        <div className="flex flex-col gap-4">
          {s.board.map((o) => {
            const left = o.deadlineTick - s.t;
            const max = Math.max(1, ...o.curves.flatMap((c) => c.points.map((p) => p.benefit)));
            return (
              <div key={o.id} className="rounded-xl border border-line bg-panel-2/60 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-[14px] font-semibold leading-snug">{o.label}</div>
                  {o.useless ? <Pill>no deadline</Pill> : <Pill tone={left <= 15 ? 'danger' : 'brass'}>{left > 0 ? `closes ${clock(o.deadlineTick)}` : 'closed'}</Pill>}
                </div>
                {o.useless ? (
                  <div className="mt-1.5 text-[12.5px] text-dim">On none of the {o.tested} rough nights does starting this at a different time change the number of dangerous minutes by one or more. It is not time-sensitive.</div>
                ) : (
                  <>
                    <div className="mt-1.5 text-[12.5px] leading-relaxed text-dim">
                      Even on the hardest of the {o.tested} nights ({o.worstLabels.join(' + ') || 'an ordinary night'}), starting it after {clock(o.deadlineTick)} saves less than 15% of what it could.
                    </div>
                    <svg viewBox="0 0 300 70" className="mt-3 w-full">
                      {o.curves.map((c) => (
                        <polyline
                          key={c.night}
                          fill="none"
                          stroke={c.deadline === o.deadlineTick ? '#C9A961' : 'rgba(122,138,133,.35)'}
                          strokeWidth={c.deadline === o.deadlineTick ? 1.8 : 1}
                          points={c.points.map((p, i) => `${10 + (i / (BOARD_CHECKS.length - 1)) * 280},${62 - (p.benefit / max) * 54}`).join(' ')}
                        />
                      ))}
                      {BOARD_CHECKS.map((t, i) => (
                        <text key={t} x={10 + (i / (BOARD_CHECKS.length - 1)) * 280} y={70} fontSize="8" fill="#586662" textAnchor="middle" fontFamily="monospace">
                          {clock(t)}
                        </text>
                      ))}
                    </svg>
                    <div className="text-[10.5px] text-dimmer">dangerous minutes saved if you start at each time · one line per rough night · brass = the night that closes it first</div>
                  </>
                )}
              </div>
            );
          })}
          <p className="text-[12px] leading-relaxed text-dimmer">The countdown is not a guess. Once the deadline is known, the clock is just deadline minus now. No simulation runs per frame.</p>
        </div>
      )}
    </Shell>
  );
}

function LedgerDrawer() {
  const s = useSlice(store, (s) => ({ ledger: s.ledger }));
  const [check, setCheck] = useState<null | { ok: boolean; seq?: number; tamper?: boolean }>(null);
  const verify = async (list: LedgerEntry[], tamper = false) => {
    const r = await verifyLedger(list);
    setCheck(r.ok ? { ok: true, tamper } : { ok: false, seq: r.seq, tamper });
  };
  const tamper = () => {
    if (s.ledger.length < 2) return;
    const i = Math.min(2, s.ledger.length - 1);
    const copy = s.ledger.map((e) => ({ ...e }));
    copy[i] = { ...copy[i], summary: copy[i].summary.replace(/\d+/, (d) => String(Number(d) + 1)) };
    verify(copy, true);
  };
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(s.ledger, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pravaah-black-box.json';
    a.click();
  };
  return (
    <Shell title="The Black Box" sub="Every forecast, warning, recommendation and approval, in order. Each entry is sealed with the one before it, so nobody can quietly change what we knew, and when.">
      <div className="flex flex-wrap gap-2">
        <Button variant="solid" size="sm" onClick={() => verify(s.ledger)}>
          Verify the ledger
        </Button>
        <Button size="sm" onClick={tamper} disabled={s.ledger.length < 2}>
          Try to tamper with it
        </Button>
        <Button size="sm" variant="quiet" onClick={exportJSON}>
          Export
        </Button>
      </div>
      {check ? (
        <div className={cx('mt-3 rounded-lg border px-3 py-2 text-[13px]', check.ok ? 'border-safe/40 bg-[#122019] text-safe' : 'border-danger/40 bg-[#221512] text-danger-soft')}>
          {check.ok ? `✓ All ${s.ledger.length} entries check out. Nothing has been changed.` : `✕ Entry ${check.seq} does not match its seal.${check.tamper ? ' We changed one number in a copy, and the chain caught it. The real ledger is untouched.' : ''}`}
        </div>
      ) : null}
      <ol className="mt-5 flex flex-col">
        {s.ledger
          .slice()
          .reverse()
          .map((e) => (
            <li key={e.seq} className="border-b border-line-soft py-3">
              <div className="flex items-center gap-2 text-[11px] text-dimmer">
                <span className="num">#{e.seq}</span>
                <span className="num">{e.simClock}</span>
                <span className="uppercase tracking-[0.1em]">{e.type.replace(/_/g, ' ')}</span>
                <span className="num ml-auto" title={e.hash}>
                  {e.hash.slice(0, 10)}…
                </span>
              </div>
              <div className="mt-1 text-[13px] leading-snug">{e.summary}</div>
            </li>
          ))}
      </ol>
      {!s.ledger.length ? <div className="text-[13px] text-dim">Nothing recorded yet.</div> : null}
    </Shell>
  );
}

function ReportDrawer() {
  const s = useSlice(store, (s) => ({ base: s.base, a: s.approved, scn: s.scn, rc: s.raviCur, rg: s.raviGhost, ledger: s.ledger.length, rt: s.redTeam }));
  const r = s.a?.result || s.base;
  const peak = (x: number[]) => Math.max(...x).toFixed(1);
  return (
    <Shell title="After-action report" sub={`${s.scn.name} · rehearsal ${new Date().toLocaleDateString('en-IN')}`}>
      <Row k="Attendance" v={<span className="num">{comma(s.scn.zones.find((z) => z.type === 'venue')?.capacity || 0)}</span>} />
      <Row k="Plan used" v={s.a ? `${s.a.name}, approved ${clock(s.a.tick)}` : 'none'} />
      <Row k="Dangerous minutes" v={<Delta from={s.base.crushMin} to={r.crushMin} />} />
      <Row k="Most crowded spot" v={<Delta from={peak(s.base.peakDen)} to={peak(r.peakDen)} unit="/m²" />} />
      <Row k="Longest wait at a gate" v={<Delta from={Math.round(s.base.maxGateWait)} to={Math.round(r.maxGateWait)} unit="min" />} />
      <Row k={`Still outside at ${clock(s.scn.showStartTick)}`} v={<Delta from={comma(s.base.missed)} to={comma(r.missed)} />} />
      <Row k="Money spent" v={<span className="num">{r.rupees ? inr(r.rupees) : 'nil'}</span>} />
      {s.rt ? <Row k="Red team" v={`safe on ${s.rt.survived} of ${s.rt.total} rough nights`} /> : null}
      {s.rg ? (
        <div className="mt-5 rounded-xl border border-line bg-panel-2/60 p-4 text-[13px] leading-relaxed text-dim">
          <Kicker>One person, followed through both evenings</Kicker>
          <p>Ravi Sharma reaches Nerul at 19:00 with his nine-year-old daughter.</p>
          <p className="mt-1">
            If you did nothing: he stands still for <b className="num text-text">{s.rg.waited}</b> min, in a crowd of <b className="num text-text">{s.rg.worst.toFixed(1)}</b>/m², and gets in at <b className="num text-text">{clock(s.rg.inside)}</b>.
          </p>
          <p className="mt-1">
            With the plan: he stands still for <b className="num text-text">{s.rc.waited}</b> min, in a crowd of <b className="num text-text">{s.rc.worst.toFixed(1)}</b>/m², and gets in at <b className="num text-text">{clock(s.rc.inside)}</b>.
          </p>
        </div>
      ) : null}
      {s.a ? (
        <div className="mt-5">
          <Kicker>What you approved</Kicker>
          <ul className="flex flex-col gap-1 text-[13px]">
            {s.a.ivs.map((c, i) => (
              <li key={i}>· {c.label || c.type}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="mt-5 text-[12.5px] leading-relaxed text-dimmer">
        You can check every number here. The same set-up and the same decisions always give the same evening. That makes this a record, not an opinion. {s.ledger} entries in the Black Box.
      </p>
      <Button className="no-print mt-5" onClick={() => window.print()}>
        Print or save as PDF
      </Button>
    </Shell>
  );
}

function AboutDrawer() {
  return (
    <Shell title="How this works, and what we guessed" sub="If you are going to trust a number on this screen, you should know where it came from.">
      <div className="flex flex-col gap-5 text-[13.5px] leading-relaxed text-dim">
        <p>
          <b className="text-text">No AI writes the numbers.</b> Every figure here comes from a simulation running in your browser: how crowded a place gets, how long people wait, what it costs, how many people listen. Run it twice and you get the same evening both times.
        </p>
        <div>
          <Kicker>What the simulation does</Kicker>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>The area is a map of places joined by roads and paths. Each can carry only so many people per minute.</li>
            <li>It works one minute at a time, through the whole evening. One full evening takes about 15 milliseconds.</li>
            <li>Walking gets slower as a path gets busier (a standard traffic formula).</li>
            <li>
              A place can hold at most 5.8 people per m². Once it is full, people are stopped on the path behind it. <b className="text-text">That is what turns a queue into a crush.</b>
            </li>
            <li>Trains arrive in bursts, not a steady stream. A crush is built out of bursts.</li>
            <li>A minute counts as dangerous when any place goes above 4 people per m².</li>
          </ul>
        </div>
        <div>
          <Kicker>How each claim is proven</Kicker>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>Predict: the evening is re-run 60 times with small changes (crowd size, train timing, bag-check speed).</li>
            <li>Explain: each cause is removed and the evening re-run. What disappears, that cause made.</li>
            <li>Prove: every plan is simulated, including the ones that fail. They are shown with their result.</li>
            <li>Time left to act: each move is started at six times on 12 rough nights. The earliest deadline wins.</li>
            <li>Red team: 192 bad nights, each run twice. We show where our own plan breaks.</li>
          </ul>
        </div>
        <div>
          <Kicker>Why people follow a message</Kicker>
          <p>
            Mostly because of the queue, not the money. How many switch depends first on time saved, then any reward, then extra walking. That is why the best fix tonight costs nothing. The Room tests this assumption live with real phones.
          </p>
        </div>
        <div>
          <Kicker>Guessed, not measured</Kicker>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>Forecourt sizes, lane counts and path widths are sensible for this stadium, but not surveyed.</li>
            <li>Each bag-check lane handles 28 people a minute, a common planning figure.</li>
            <li>At most 12 extra lanes in total, and 8 at any one gate.</li>
            <li>The hotel numbers are illustrative. The pattern is the point: full near the stadium, empty further out.</li>
            <li>How many people accept a message is set by hand, not fitted to field data.</li>
            <li>This model covers arrival. Leaving the stadium is not modelled yet.</li>
          </ul>
        </div>
        <div>
          <Kicker>Where the language model is used</Kicker>
          <p>
            Only for words: turning a typed question into a scenario the engine can run, and re-wording a message. Numbers are locked before the model sees the text and put back afterwards. If the model changes a number, its answer is thrown away. <b className="text-text">A model that cannot make up a number cannot lie about one.</b>
          </p>
        </div>
      </div>
    </Shell>
  );
}

export default function Drawers() {
  const d = useSlice(store, (s) => s.drawer);
  if (d === 'redteam') return <RedTeamDrawer />;
  if (d === 'board') return <BoardDrawer />;
  if (d === 'ledger') return <LedgerDrawer />;
  if (d === 'report') return <ReportDrawer />;
  if (d === 'about') return <AboutDrawer />;
  return null;
}
