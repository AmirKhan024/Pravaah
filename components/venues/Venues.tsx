'use client';
/*
 * "Any venue in 60 seconds" (SOURCE_OF_TRUTH §8.5). Pick a cached venue or import one live from
 * OpenStreetMap. The graph is auto-built, every derived number is marked estimated and editable,
 * and the same engine runs it. This is the proof that nothing is hardcoded to one stadium.
 */
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildVenueScenario, clockFor, comma, inr, probeWaits, simulate, VENUES, type Lever, type Scenario, type VenueSpec } from '@/engine';
import { engine } from '@/lib/engineClient';
import { denWords } from '@/lib/colors';
import FlowMap from '@/components/map/FlowMap';
import { Busy, Button, cx, Delta, Logo, Pill } from '@/components/ui';

type Plans = { plans: Record<string, { chosen: Lever[]; crushMin: number; rupees: number; missed: number; maxGateWait: number }>; evals: number; ms: number };

export default function Venues() {
  const [sel, setSel] = useState(VENUES[1].id);
  const [spec, setSpec] = useState<VenueSpec | null>(VENUES[1].spec);
  const [imported, setImported] = useState<{ spec: VenueSpec; found: string } | null>(null);
  const [q, setQ] = useState('');
  const [cap, setCap] = useState(30000);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [plans, setPlans] = useState<Plans | null>(null);
  const tickRef = useRef(200);
  const [tick, setTick] = useState(200);

  const entry = VENUES.find((v) => v.id === sel);
  const scn: Scenario = useMemo(() => {
    if (sel === 'import' && imported) return buildVenueScenario(spec || imported.spec);
    if (entry && !entry.spec) return entry.build();
    return buildVenueScenario(spec || entry!.spec!);
  }, [sel, spec, imported, entry]);
  const { base, ms } = useMemo(() => {
    const waits = probeWaits(scn);
    const t0 = performance.now();
    const r = simulate(scn, [], { waits });
    return { base: r, ms: performance.now() - t0 };
  }, [scn]);

  useEffect(() => {
    setPlans(null);
    const id = setTimeout(() => {
      engine().venuePlans(scn).then(setPlans).catch(() => {});
    }, 250);
    return () => clearTimeout(id);
  }, [scn]);

  useEffect(() => {
    tickRef.current = Math.max(0, scn.showStartTick - 100);
    let raf = 0,
      last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      tickRef.current += dt * 6;
      if (tickRef.current >= Math.min(scn.horizon - 1, scn.showStartTick + 40)) tickRef.current = Math.max(0, scn.showStartTick - 100);
      const f = Math.floor(tickRef.current);
      setTick((p) => (p === f ? p : f));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [scn]);

  const pick = (id: string) => {
    setSel(id);
    const v = VENUES.find((x) => x.id === id);
    setSpec(v?.spec ? JSON.parse(JSON.stringify(v.spec)) : null);
  };

  const doImport = async () => {
    if (!q.trim()) return;
    setBusy(true);
    setMsg('Asking OpenStreetMap for stations, roads, parking, hotels and entrances…');
    try {
      const r = await fetch('/api/venues/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q, capacity: cap }) }).then((x) => x.json());
      if (r.ok) {
        setImported({ spec: r.spec, found: r.found.name });
        setSpec(r.spec);
        setSel('import');
        setMsg(`Built from ${r.found.elements} OpenStreetMap features. Everything is estimated. Check it before you trust it.`);
      } else setMsg(r.reason || 'Import failed. Use a cached venue.');
    } catch {
      setMsg('Import failed. Use a cached venue.');
    } finally {
      setBusy(false);
    }
  };

  const f = base.frames[Math.min(tick, scn.horizon - 1)];
  const worst = base.worst.zone >= 0 ? scn.zones[base.worst.zone] : null;
  const peak = Math.max(...base.peakDen, ...base.peakLinkDen);
  const clock = (t: number) => clockFor(scn, t);
  const editable = spec && sel !== 'dyPatil';

  return (
    <div className="grid h-dvh grid-rows-[64px_minmax(0,1fr)] bg-ink">
      <header className="flex items-center gap-4 border-b border-line px-5">
        <Link href="/" className="flex items-center gap-2.5 text-brass">
          <Logo className="size-7" />
          <span className="text-[15px] font-semibold tracking-[0.2em] text-text">PRAVAAH</span>
        </Link>
        <span className="text-[13px] text-dim">Any venue in 60 seconds</span>
        <Link href="/console" className="ml-auto rounded-lg border border-line px-3.5 py-1.5 text-[13px] text-dim hover:text-text">
          Open the console
        </Link>
      </header>
      <div className="grid min-h-0 grid-cols-[380px_minmax(0,1fr)_340px]">
        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto border-r border-line bg-panel p-5">
          <div>
            <div className="kicker">Name a venue</div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                doImport();
              }}
              className="flex flex-col gap-2"
            >
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Eden Gardens, Kolkata" className="h-10 rounded-lg border border-line bg-ink px-3 text-[13.5px] placeholder:text-dimmer focus:border-brass-dim focus:outline-none" />
              <div className="flex items-center gap-2">
                <label className="text-[12px] text-dim">
                  Crowd
                  <input type="number" value={cap} min={1000} max={150000} step={1000} onChange={(e) => setCap(+e.target.value)} className="num ml-2 h-8 w-24 rounded-md border border-line bg-ink px-2 text-[13px]" />
                </label>
                <Button variant="solid" size="sm" className="ml-auto" disabled={busy}>
                  {busy ? 'Building…' : 'Import live'}
                </Button>
              </div>
            </form>
            {msg ? <div className="mt-2 text-[12px] leading-snug text-dim">{msg}</div> : null}
          </div>
          <div>
            <div className="kicker">Cached, always work offline</div>
            <div className="flex flex-col gap-2">
              {imported ? (
                <button onClick={() => setSel('import')} className={cx('rounded-xl border p-3.5 text-left', sel === 'import' ? 'border-brass bg-[#1d1c14]' : 'border-line bg-panel-2/50 hover:border-brass-dim')}>
                  <div className="flex items-center gap-2 text-[14px] font-semibold">
                    {imported.spec.venueLabel} <Pill tone="brass">live import</Pill>
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-[11.5px] text-dim">{imported.found}</div>
                </button>
              ) : null}
              {VENUES.map((v) => (
                <button key={v.id} onClick={() => pick(v.id)} className={cx('rounded-xl border p-3.5 text-left', sel === v.id ? 'border-brass bg-[#1d1c14]' : 'border-line bg-panel-2/50 hover:border-brass-dim')}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[14px] font-semibold">{v.name}</span>
                    <span className="num text-[11.5px] text-dim">{comma(v.capacity)}</span>
                  </div>
                  <div className="text-[11.5px] text-dimmer">{v.city}</div>
                  <div className="mt-1 text-[12px] leading-snug text-dim">{v.blurb}</div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="relative min-h-0 overflow-hidden">
          <FlowMap key={scn.id + (sel === 'import' ? 'i' : '')} fitKey={scn.id} zoomBoost={0.2} getState={() => ({ scn, cur: base, ghost: null, tick: tickRef.current, raviCur: null, raviRelease: 9999 })} />
          <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-line bg-ink/88 px-4 py-3">
            <div className="text-[15px] font-semibold">{scn.venueLabel}</div>
            <div className="text-[12px] text-dim">{scn.sub || scn.name}</div>
            <div className="mt-1.5 flex items-center gap-2 text-[12px] text-dim">
              <span className="num text-[15px] text-text">{clock(tick)}</span> if nobody acts
              {f ? (
                <span>
                  · peak now <b className="num text-text">{Math.max(...Array.from(f.zoneDen)).toFixed(1)}</b>/m²
                </span>
              ) : null}
            </div>
          </div>
        </main>

        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto border-l border-line bg-panel p-5">
          <div>
            <div className="kicker">The do-nothing evening</div>
            <div className="text-[12px] text-dimmer">simulated in {ms.toFixed(1)} ms</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-line bg-panel-2/60 p-3">
              <div className="text-[11.5px] text-dim">Dangerous minutes</div>
              <div className={cx('num text-[26px] font-semibold', base.crushMin ? 'text-danger-soft' : 'text-safe')}>{base.crushMin}</div>
            </div>
            <div className="rounded-xl border border-line bg-panel-2/60 p-3">
              <div className="text-[11.5px] text-dim">Longest gate wait</div>
              <div className="num text-[26px] font-semibold">{Math.round(base.maxGateWait)}m</div>
            </div>
            <div className="col-span-2 rounded-xl border border-line bg-panel-2/60 p-3">
              <div className="text-[11.5px] text-dim">Most crowded spot</div>
              <div className="text-[14px]">
                <b className="num">{peak.toFixed(1)}</b>/m², {denWords(peak)}
                {worst ? (
                  <span className="text-dim">
                    {' '}
                    · {worst.name}, {clock(base.worst.tick)}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-[11.5px] text-dim">
                <span className="num">{comma(base.missed)}</span> still outside at showtime
              </div>
            </div>
          </div>

          <div>
            <div className="kicker">Plans, simulated</div>
            {!plans ? (
              <Busy label="trying every plan for this venue…" />
            ) : (
              <div className="flex flex-col gap-2">
                <div className="text-[11.5px] text-dimmer">
                  {plans.evals} plans in {comma(plans.ms)} ms
                </div>
                {Object.entries(plans.plans).map(([name, p]) => (
                  <div key={name} className="rounded-xl border border-line bg-panel-2/60 p-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[13.5px] font-semibold">{name}</span>
                      <span className="num text-[13px] text-brass">{p.rupees ? inr(p.rupees) : '₹0'}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-[12px] text-dim">
                      <span>
                        danger <Delta from={base.crushMin} to={p.crushMin} />
                      </span>
                      <span>
                        wait <Delta from={Math.round(base.maxGateWait)} to={Math.round(p.maxGateWait)} unit="m" />
                      </span>
                    </div>
                    <ul className="mt-2 flex flex-col gap-0.5 text-[11.5px] leading-snug text-dim">
                      {p.chosen.length ? p.chosen.map((c) => <li key={c.label}>· {c.label}</li>) : <li>Nothing worth doing. The evening is fine as it is.</li>}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {editable ? (
            <div>
              <div className="kicker">Estimated · edit and it re-runs</div>
              <label className="flex items-center justify-between py-1 text-[12.5px] text-dim">
                Crowd
                <input
                  type="number"
                  step={1000}
                  value={spec!.capacity}
                  onChange={(e) => setSpec({ ...spec!, capacity: Math.max(1000, +e.target.value) })}
                  className="num h-8 w-24 rounded-md border border-line bg-ink px-2 text-right text-[13px] text-text"
                />
              </label>
              {spec!.gates.map((g, i) => (
                <div key={i} className="flex items-center justify-between py-1 text-[12.5px] text-dim">
                  <span className="truncate pr-2">{g.name} lanes</span>
                  <span className="flex items-center gap-1">
                    {[-1, 1].map((d) => (
                      <button
                        key={d}
                        onClick={() => {
                          const gates = spec!.gates.map((x, j) => (j === i ? { ...x, lanes: Math.max(1, Math.min(30, (x.lanes || 8) + d)) } : x));
                          setSpec({ ...spec!, gates });
                        }}
                        className="grid size-7 place-items-center rounded-md border border-line text-text hover:border-brass-dim"
                        aria-label={d > 0 ? 'more lanes' : 'fewer lanes'}
                      >
                        {d > 0 ? '+' : '−'}
                      </button>
                    ))}
                    <span className="num w-7 text-right text-text">{g.lanes || 8}</span>
                  </span>
                </div>
              ))}
              {spec!.notes?.length ? (
                <ul className="mt-3 flex list-disc flex-col gap-1 pl-4 text-[11.5px] leading-snug text-dimmer">
                  {spec!.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : sel === 'dyPatil' ? (
            <Link href="/console" className="rounded-xl border border-brass-dim bg-[#1d1c14] p-4 text-[13px] text-brass">
              DY Patil is the hand-built flagship. Open it in the console for the full five-step rehearsal →
            </Link>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
