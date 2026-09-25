'use client';
/*
 * The cover visual is the engine, not an illustration: the do-nothing evening at DY Patil,
 * simulated in the browser, drawn as the streams that feed each gate. Gate 3 goes red while
 * Gate 5 stays nearly empty — mismatch, not shortage — straight from the frames.
 */
import { useEffect, useRef, useState } from 'react';
import { clockFor, dyPatil, probeWaits, simulate, type SimResult } from '@/engine';
import { denColor } from '@/lib/colors';

interface Stream {
  links: string[];
  y: number;
  gate: string;
  label: string;
}
// origin streams (left) → plaza/gate (right), laid out schematically
const STREAMS: Stream[] = [
  { links: ['L5'], y: 0.12, gate: 'gate1', label: 'Vashi hotels' },
  { links: ['L4'], y: 0.24, gate: 'gate1', label: 'Sector 20 parking' },
  { links: ['L1'], y: 0.4, gate: 'gate3', label: 'Nerul station' },
  { links: ['L2'], y: 0.5, gate: 'gate3', label: 'Seawoods' },
  { links: ['L3'], y: 0.6, gate: 'gate3', label: 'Palm Beach cabs' },
  { links: ['L6', 'L7', 'L8', 'L15', 'L16'], y: 0.8, gate: 'gate5', label: 'Belapur · Kharghar · Panvel' },
];
const GATES = [
  { id: 'gate1', plaza: 'fc_north', y: 0.2, name: 'Gate 1' },
  { id: 'gate3', plaza: 'fc_west', y: 0.5, name: 'Gate 3' },
  { id: 'gate5', plaza: 'fc_east', y: 0.8, name: 'Gate 5' },
];

export default function CoverFlow() {
  const cv = useRef<HTMLCanvasElement>(null);
  const [res, setRes] = useState<SimResult | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const clockRef = useRef<HTMLSpanElement>(null);

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
    const canvas = cv.current!;
    const ctx = canvas.getContext('2d')!;
    const li: Record<string, number> = {};
    dyPatil.links.forEach((l, i) => (li[l.id] = i));
    const zi: Record<string, number> = {};
    dyPatil.zones.forEach((z, i) => (zi[z.id] = i));
    let W = 0,
      H = 0,
      raf = 0,
      last = performance.now(),
      tick = 250,
      anim = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect(),
        dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width;
      H = r.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) tick = 318;

    const draw = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      anim += dt;
      if (!reduce) {
        tick += dt * 4.2;
        if (tick > 336) tick = 250;
      }
      const t = Math.floor(tick);
      const f = res.frames[t];
      ctx.clearRect(0, 0, W, H);
      const gx = W * 0.8;
      const ox = W * 0.04;
      // streams
      STREAMS.forEach((s, si) => {
        const occ = s.links.reduce((a, id) => a + f.linkOcc[li[id]], 0);
        const flow = s.links.reduce((a, id) => a + f.linkFlow[li[id]], 0);
        const g = GATES.find((x) => x.id === s.gate)!;
        const den = f.zoneDen[zi[g.plaza]];
        const y0 = H * s.y,
          y1 = H * g.y;
        const width = Math.min(26, 2 + Math.sqrt(occ) * 0.32);
        const path = (u: number) => {
          const x = ox + (gx - ox) * u;
          const e = u * u * (3 - 2 * u);
          return { x, y: y0 + (y1 - y0) * e };
        };
        // channel
        ctx.strokeStyle = 'rgba(220,229,225,.05)';
        ctx.lineWidth = 16;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let u = 0; u <= 1.001; u += 0.02) {
          const p = path(u);
          u === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        // particles
        const n = Math.min(240, Math.ceil(occ / 22) + Math.ceil(flow / 10));
        const speed = den >= 4 ? 0.02 : 0.08;
        ctx.fillStyle = denColor(Math.max(1, den * 0.9), 0.9);
        for (let k = 0; k < n; k++) {
          const seed = (k * 0.6180339887 + si * 0.31) % 1;
          let u = (seed + anim * speed) % 1;
          if (den >= 4) u = 0.62 + u * 0.38; // held back: bunched against the full forecourt
          const p = path(u);
          const j = ((((k * 2654435761) % 1000) / 1000) - 0.5) * width;
          ctx.beginPath();
          ctx.arc(p.x, p.y + j, 1.3, 0, 6.2832);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(122,138,133,.8)';
        ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(s.label, ox, y0 - 12);
      });
      // gates
      GATES.forEach((g) => {
        const den = f.zoneDen[zi[g.plaza]];
        const y = H * g.y;
        const r = 10 + Math.min(24, den * 5);
        const halo = ctx.createRadialGradient(gx, y, 2, gx, y, r + 30);
        halo.addColorStop(0, denColor(den, 0.55));
        halo.addColorStop(1, denColor(den, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(gx, y, r + 30, 0, 6.2832);
        ctx.fill();
        ctx.fillStyle = denColor(Math.max(0.3, den), 1);
        ctx.beginPath();
        ctx.arc(gx, y, 7, 0, 6.2832);
        ctx.fill();
        if (den >= 4) {
          const ph = Math.sin(anim * 4);
          ctx.strokeStyle = `rgba(240,165,148,${0.4 + 0.35 * ph})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(gx, y, r + 8 + 3 * ph, 0, 6.2832);
          ctx.stroke();
        }
        ctx.textAlign = 'left';
        ctx.fillStyle = den >= 4 ? '#F0A594' : 'rgba(220,229,225,.9)';
        ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText(g.name, gx + 26, y - 2);
        ctx.font = '500 12px ui-monospace, monospace';
        ctx.fillStyle = den >= 4 ? '#F0A594' : 'rgba(122,138,133,.95)';
        ctx.fillText(den.toFixed(1) + ' people/m²', gx + 26, y + 14);
      });
      if (clockRef.current) clockRef.current.textContent = clockFor(dyPatil, t);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [res]);

  return (
    <div className="relative h-full w-full">
      <canvas ref={cv} className="h-full w-full" aria-label="The do-nothing evening at DY Patil Stadium, simulated live" />
      <div className="absolute bottom-2 left-[4%] flex items-center gap-3 text-[11px] text-dimmer">
        <span ref={clockRef} className="num text-[13px] text-dim">
          17:10
        </span>
        <span>
          DY Patil Stadium, if nobody acts · 84,000 people, 540 minutes, simulated in <b className="num font-semibold text-brass">{ms == null ? '…' : ms.toFixed(1) + ' ms'}</b> on this device
        </span>
      </div>
    </div>
  );
}
