'use client';
/*
 * The bare simulation clock: drives tickForward() every animation frame. Shared by the five-step
 * console (which layers its own story-caption narration on top in a separate effect) and Live Ops
 * (which doesn't narrate — it just needs the clock moving so the map, status band and per-lever
 * countdowns stay live).
 */
import { useEffect } from 'react';
import { tickForward } from './console';

export function useSimTicker() {
  useEffect(() => {
    let raf = 0,
      last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      tickForward(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}
