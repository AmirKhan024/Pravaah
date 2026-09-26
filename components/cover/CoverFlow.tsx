'use client';
/*
 * The cover visual is the engine, not an illustration: the do-nothing evening at DY Patil,
 * simulated in the browser. Renders through the same FlowMap the console/Live Ops use (real
 * MapLibre geodata, teardrop gate pins, hover tooltips, zoom/compass/legend) — reusing it here
 * instead of a second bespoke renderer, so the cover page shows the identical illustrated map,
 * not a copy of it (docs/DECISIONS.md, 2026-09-26 "cover page: reuse FlowMap").
 */
import { useEffect, useRef, useState } from 'react';
import { dyPatil, probeWaits, simulate, type SimResult } from '@/engine';
import FlowMap, { type MapFrameState } from '@/components/map/FlowMap';

export default function CoverFlow() {
  const [res, setRes] = useState<SimResult | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const tickRef = useRef(250);

  useEffect(() => {
    const waits = probeWaits(dyPatil);
    simulate(dyPatil, [], { waits, lite: true }); // warm the JIT once, then time a full evening
    const t0 = performance.now();
    const r = simulate(dyPatil, [], { waits });
    setMs(performance.now() - t0);
    setRes(r);
  }, []);

  useEffect(() => {
    if (!res) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      tickRef.current = 318;
      return;
    }
    let raf = 0,
      last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      tickRef.current += dt * 4.2;
      if (tickRef.current > 336) tickRef.current = 250;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [res]);

  const getState = (): MapFrameState => ({
    scn: dyPatil,
    cur: res!,
    ghost: null,
    tick: tickRef.current,
    raviCur: null,
    raviRelease: Infinity,
  });

  if (!res) return <div className="h-full w-full animate-pulse bg-panel-2/40" />;

  return (
    <div className="relative h-full w-full">
      <FlowMap getState={getState} fitKey="dyPatilCover" zoomBoost={0.35} />
      <div className="pointer-events-none absolute bottom-2 left-[4%] flex items-center gap-3 rounded-lg bg-panel/85 px-2.5 py-1 text-[11px] text-dimmer backdrop-blur-sm">
        <span>
          If nobody acts · 84,000 people, 540 minutes, simulated in <b className="num font-semibold text-brass">{ms == null ? '…' : ms.toFixed(1) + ' ms'}</b> on this device
        </span>
      </div>
    </div>
  );
}
