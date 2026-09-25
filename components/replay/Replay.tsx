'use client';
/*
 * Incident replay (SOURCE_OF_TRUTH §8.4). Respectful, plain, sourced. It shows the reported
 * timeline, the reconstructed evening, when a rehearsal would have warned, and what upstream
 * change the engine says would have mattered most. It makes no finding about anyone.
 * The optimiser's gate-lane plans are deliberately NOT shown: the engine does not stop entry
 * at capacity, so they would overstate how many more people could safely have been let in.
 */
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { bengaluru2025, bengaluru2025Meta, clockFor, comma, CRUSH, probeWaits, simulate, trendWarning, type EnsembleResult, type Scenario } from '@/engine';
import { engine } from '@/lib/engineClient';
import { denWords } from '@/lib/colors';
import FlowMap from '@/components/map/FlowMap';
import { cx, Logo } from '@/components/ui';

const scn = bengaluru2025;
const meta = bengaluru2025Meta;
const clock = (t: number) => clockFor(scn, t);
const zoneIdx = scn.zones.findIndex((z) => z.id === meta.watchZone);

function variant(label: string, note: string, edit: (s: Scenario) => void) {
  const s: Scenario = JSON.parse(JSON.stringify(scn));
  edit(s);
  const w = probeWaits(s);
  const r = simulate(s, [], { waits: w, lite: true });
  return { label, note, crush: r.crushMin, missed: r.missed, peak: Math.max(...r.peakDen) };
}

export default function Replay() {
  const base = useMemo(() => simulate(scn, [], { waits: probeWaits(scn) }), []);
  const tickRef = useRef(90);
  const [tick, setTick] = useState(90);
  const [playing, setPlaying] = useState(true);
  const [ens, setEns] = useState<EnsembleResult | null>(null);

  // when would a rehearsal have warned? read from the do-nothing frames, never ahead of the minute
  const marks = useMemo(() => {
    let over2 = -1,
      trend = -1,
      crush = -1;
    for (let t = 0; t < scn.horizon; t++) {
      const d = base.frames[t].zoneDen[zoneIdx];
      if (over2 < 0 && d >= 2) over2 = t;
      if (crush < 0 && d >= CRUSH) crush = t;
      if (trend < 0 && t > 3) {
        const w = trendWarning(scn, base, t);
        if (w && w.zone === meta.watchZone) trend = t;
      }
    }
    return { over2, trend, crush };
  }, [base]);

  const variants = useMemo(
    () => [
      variant('As reconstructed', 'about 90,000 people head for 35,000 seats; gates open around 15:45', () => {}),
      variant('Gates open on time', 'every gate open at the planned 13:45', (s) => (s.gatesOpenTick = 45)),
      variant('Entry by pass only', 'a clear, early message: only pass-holders come, so the crowd matches the seats', (s) => {
        const total = s.cohorts.reduce((a, c) => a + c.size, 0);
        s.cohorts.forEach((c) => (c.size = Math.round((c.size * 35000) / total)));
      }),
      variant('Both', 'pass-only entry and gates on time', (s) => {
        const total = s.cohorts.reduce((a, c) => a + c.size, 0);
        s.cohorts.forEach((c) => (c.size = Math.round((c.size * 35000) / total)));
        s.gatesOpenTick = 45;
      }),
    ],
    [],
  );

  useEffect(() => {
    engine().ensemble(scn, zoneIdx).then(setEns).catch(() => {});
  }, []);

  useEffect(() => {
    let raf = 0,
      last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (playing) {
        tickRef.current += dt * 5;
        if (tickRef.current >= scn.horizon - 1) tickRef.current = 60;
        const f = Math.floor(tickRef.current);
        setTick((p) => (p === f ? p : f));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const den = base.frames[tick].zoneDen[zoneIdx];
  const reported = meta.timeline.map((e) => ({ ...e, kind: 'reported' as const, min: +e.time.slice(0, 2) * 60 + +e.time.slice(3) }));
  const computed = [
    marks.over2 >= 0 && { time: clock(marks.over2), min: scn.t0Min + marks.over2, text: `A rehearsal shows the road outside Gates 6–7 passing 2 people per m². Pravaah would warn here.`, kind: 'pravaah' as const },
    marks.trend >= 0 && { time: clock(marks.trend), min: scn.t0Min + marks.trend, text: 'The live trend line projects crush density within 8 minutes.', kind: 'pravaah' as const },
    marks.crush >= 0 && { time: clock(marks.crush), min: scn.t0Min + marks.crush, text: 'In the reconstruction, the road outside Gates 6–7 first reaches dangerous density.', kind: 'pravaah' as const },
  ].filter(Boolean) as { time: string; min: number; text: string; kind: 'pravaah' }[];
  const timeline = [...reported, ...computed].sort((a, b) => a.min - b.min);

  return (
    <div className="min-h-dvh bg-ink">
      <header className="mx-auto flex max-w-[1320px] items-center gap-4 px-6 py-5 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5 text-brass">
          <Logo className="size-7" />
          <span className="text-[15px] font-semibold tracking-[0.22em] text-text">PRAVAAH</span>
        </Link>
        <Link href="/console" className="ml-auto rounded-lg border border-line px-3.5 py-1.5 text-[13px] text-dim hover:text-text">
          Open the console
        </Link>
      </header>

      <div className="mx-auto max-w-[1320px] px-6 sm:px-10">
        <div className="rounded-xl border border-brass-dim/60 bg-[#1d1c14] px-5 py-3 text-[14px] text-brass">{meta.label}</div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div>
            <div className="kicker">4 June 2025 · M. Chinnaswamy Stadium, Bengaluru</div>
            <h1 className="mt-3 font-display text-[46px] leading-[1.04] sm:text-[58px]">Could a rehearsal have warned in time?</h1>
            <p className="mt-5 max-w-[560px] text-[16px] leading-relaxed text-dim">
              Eleven people died outside the stadium that afternoon. This page does not judge anyone. It rebuilds the afternoon from public reporting, runs it through the same engine as the rest of Pravaah, and asks when the pressure would have shown, and what would have changed it.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-line bg-panel-2/60 p-4">
                <div className="kicker !mb-1">Warning</div>
                <div className="num text-[26px] font-semibold text-brass">{marks.over2 >= 0 ? clock(marks.over2) : '—'}</div>
                <div className="text-[11.5px] text-dim">density passes 2/m²</div>
              </div>
              <div className="rounded-xl border border-line bg-panel-2/60 p-4">
                <div className="kicker !mb-1">Dangerous</div>
                <div className="num text-[26px] font-semibold text-danger-soft">{marks.crush >= 0 ? clock(marks.crush) : '—'}</div>
                <div className="text-[11.5px] text-dim">first minute above 4/m²</div>
              </div>
              <div className="rounded-xl border border-line bg-panel-2/60 p-4">
                <div className="kicker !mb-1">Sixty runs</div>
                <div className="num text-[26px] font-semibold">{ens ? Math.round(ens.p * 100) + '%' : '…'}</div>
                <div className="text-[11.5px] text-dim">{ens ? `reach danger · p50 ${clock(ens.tMed)}` : 'running'}</div>
              </div>
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-dimmer">
              From the first warning to the first dangerous minute is {marks.crush - marks.over2} minutes in this reconstruction. On the day itself, the decisive moments were earlier: the announcements that morning. A rehearsal run after them, with any crowd estimate, would have shown the same thing hours ahead.
            </p>

            <ol className="mt-8 flex flex-col border-l border-line">
              {timeline.map((e, i) => (
                <li key={i} className={cx('relative py-2.5 pl-5', e.kind === 'pravaah' && 'text-brass')}>
                  <span className={cx('absolute -left-[5px] top-4 size-2.5 rounded-full', e.kind === 'pravaah' ? 'bg-brass' : 'bg-dim')} />
                  <div className="flex items-baseline gap-3">
                    <span className="num w-12 shrink-0 text-[13px]">{e.time}</span>
                    <span className={cx('text-[14px] leading-snug', e.kind === 'reported' ? 'text-text' : '')}>
                      {e.text}
                      {'source' in e ? <sup className="ml-1 text-[10px] text-dimmer">[{e.source}]</sup> : <span className="ml-2 text-[10.5px] uppercase tracking-[0.12em] text-brass-dim">simulated</span>}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="lg:sticky lg:top-6 lg:self-start">
            <div className="flex h-[560px] flex-col overflow-hidden rounded-2xl border border-line">
              <div className="relative flex-1">
              <FlowMap fitKey="bengaluru" zoomBoost={0.35} getState={() => ({ scn, cur: base, ghost: null, tick: tickRef.current, raviCur: null, raviRelease: 9999 })} />
              </div>
              <div className="flex items-center gap-3 border-t border-line bg-ink px-4 py-2.5">
                <button onClick={() => setPlaying(!playing)} className="grid size-8 place-items-center rounded-full border border-line text-[11px]">
                  {playing ? '❚❚' : '▶'}
                </button>
                <span className="num text-[18px] font-semibold">{clock(tick)}</span>
                <span className="text-[12px] text-dim">
                  Road outside Gates 6–7: <b className="num text-text">{den.toFixed(1)}</b>/m², {denWords(den)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={scn.horizon - 1}
                  value={tick}
                  onChange={(e) => {
                    tickRef.current = +e.target.value;
                    setTick(+e.target.value);
                    setPlaying(false);
                  }}
                  className="ml-auto w-40 accent-[#C9A961]"
                  aria-label="Scrub the afternoon"
                />
              </div>
            </div>
            <p className="mt-2 text-[11.5px] text-dimmer">Positions, road areas and gate groupings are estimates, marked in the data. No casualty is shown or modelled.</p>
          </div>
        </div>

        <section className="mt-16">
          <div className="kicker">What the engine says would have mattered most</div>
          <h2 className="mt-2 font-display text-[36px] leading-tight">The cheapest change was upstream, not at the gate.</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {variants.map((v, i) => (
              <div key={v.label} className={cx('rounded-xl border p-4', i === 0 ? 'border-danger/40 bg-[#221512]' : v.crush < variants[0].crush * 0.2 ? 'border-safe/40 bg-[#122019]' : 'border-line bg-panel-2/60')}>
                <div className="text-[14.5px] font-semibold">{v.label}</div>
                <div className="mt-1 min-h-[36px] text-[12px] leading-snug text-dim">{v.note}</div>
                <div className={cx('num mt-3 text-[30px] font-semibold', i === 0 ? 'text-danger-soft' : v.crush < variants[0].crush * 0.2 ? 'text-safe' : 'text-text')}>{comma(v.crush)}</div>
                <div className="text-[11.5px] text-dim">dangerous place-minutes</div>
              </div>
            ))}
          </div>
          <p className="mt-4 max-w-[900px] text-[13px] leading-relaxed text-dimmer">
            Each card is the same reconstructed afternoon re-run with one thing changed. “Gates open on time” overstates the benefit, because the engine does not stop entry once the stands are full. For the same reason we do not show gate-lane plans here: they would let more people in than there were seats. The honest lesson is about the crowd that was invited, and when the gates opened.
          </p>
        </section>

        <section className="mt-14 grid gap-10 pb-20 lg:grid-cols-2">
          <div>
            <div className="kicker">What we assumed</div>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[13px] leading-relaxed text-dim">
              {meta.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="kicker">Sources</div>
            <ol className="mt-3 flex flex-col gap-2 text-[13px] leading-snug">
              {meta.sources.map((s) => (
                <li key={s.n} className="flex gap-2">
                  <span className="num w-6 shrink-0 text-dimmer">[{s.n}]</span>
                  <span>
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-text underline decoration-line underline-offset-2 hover:decoration-brass">
                      {s.title}
                    </a>
                    <span className="text-dimmer">
                      {' '}
                      · {s.outlet}
                      {s.date ? ' · ' + s.date : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}
