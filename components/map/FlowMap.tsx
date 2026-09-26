'use client';
/*
 * The live map. A calm basemap (MapLibre, re-tinted per Light/Night theme) with a hand-drawn
 * canvas overlay: corridors, moving people, density halos, crush rings, the stadium filling,
 * Ravi, and the ghost of the do-nothing evening. Every visual is read from the current SimResult
 * frame — nothing here is a static image, and no geometry is invented (SOURCE_OF_TRUTH §13,
 * docs/DECISIONS.md 2026-09-26 "map migration").
 */
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { CRUSH, clockFor, personAt, type Scenario, type SimResult, type Trace } from '@/engine';
import { denColor, legendWord } from '@/lib/colors';
import { displayLatLng } from '@/lib/display';
import { cx } from '@/components/ui';

export interface MapFrameState {
  scn: Scenario;
  cur: SimResult;
  ghost: SimResult | null;
  tick: number;
  raviCur: Trace | null;
  raviRelease: number;
  highlightLink?: string | null;
}

const CARTO = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json';
const blankStyle = (bg: string): StyleSpecification => ({ version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': bg } }] });

/** ink/brass control-room basemap, recoloured from Carto dark-matter — the original tint, unchanged */
function tintBasemapDark(map: maplibregl.Map) {
  const layers = map.getStyle()?.layers || [];
  for (const l of layers) {
    const id = l.id;
    try {
      if (l.type === 'background') map.setPaintProperty(id, 'background-color', '#0d1413');
      else if (l.type === 'fill') {
        if (/water_shadow/.test(id)) map.setLayoutProperty(id, 'visibility', 'none');
        else if (/water/.test(id)) map.setPaintProperty(id, 'fill-color', '#0a1b1f');
        else if (/building-top/.test(id)) map.setPaintProperty(id, 'fill-color', '#1a2523');
        else if (/building/.test(id)) map.setPaintProperty(id, 'fill-color', '#151f1d');
        else if (/park|landcover/.test(id)) map.setPaintProperty(id, 'fill-color', '#0f1a17');
        else map.setPaintProperty(id, 'fill-color', '#101816');
      } else if (l.type === 'line') {
        if (/waterway/.test(id)) map.setPaintProperty(id, 'line-color', '#0c2024');
        else if (/boundary|aeroway/.test(id)) map.setLayoutProperty(id, 'visibility', 'none');
        else if (/rail_dash/.test(id)) map.setLayoutProperty(id, 'visibility', 'none');
        else if (/rail/.test(id)) map.setPaintProperty(id, 'line-color', 'rgba(201,169,97,0.22)');
        else if (/case/.test(id)) map.setPaintProperty(id, 'line-color', 'rgba(0,0,0,0)');
        else if (/mot|trunk/.test(id)) map.setPaintProperty(id, 'line-color', 'rgba(220,229,225,0.17)');
        else if (/pri|sec/.test(id)) map.setPaintProperty(id, 'line-color', 'rgba(220,229,225,0.12)');
        else if (/path/.test(id)) map.setPaintProperty(id, 'line-color', 'rgba(220,229,225,0.05)');
        else map.setPaintProperty(id, 'line-color', 'rgba(220,229,225,0.075)');
      }
    } catch {
      /* layer without that property */
    }
  }
}

/** warm parchment basemap (reference/ui-mockup.html's illustrated palette), same real geodata */
function tintBasemapLight(map: maplibregl.Map) {
  const layers = map.getStyle()?.layers || [];
  for (const l of layers) {
    const id = l.id;
    try {
      if (l.type === 'background') map.setPaintProperty(id, 'background-color', '#f5f2ec');
      else if (l.type === 'fill') {
        if (/water_shadow/.test(id)) map.setLayoutProperty(id, 'visibility', 'none');
        else if (/water/.test(id)) map.setPaintProperty(id, 'fill-color', '#bfe0ee');
        else if (/building-top/.test(id)) map.setPaintProperty(id, 'fill-color', '#ece4d2');
        else if (/building/.test(id)) map.setPaintProperty(id, 'fill-color', '#f1ebdc');
        else if (/park|landcover/.test(id)) map.setPaintProperty(id, 'fill-color', '#dfead0');
        else map.setPaintProperty(id, 'fill-color', '#f0ebe0');
      } else if (l.type === 'line') {
        if (/waterway/.test(id)) map.setPaintProperty(id, 'line-color', '#8fbfd6');
        else if (/boundary|aeroway/.test(id)) map.setLayoutProperty(id, 'visibility', 'none');
        else if (/rail_dash/.test(id)) map.setLayoutProperty(id, 'visibility', 'none');
        else if (/rail/.test(id)) map.setPaintProperty(id, 'line-color', 'rgba(15,118,110,0.35)');
        else if (/case/.test(id)) map.setPaintProperty(id, 'line-color', 'rgba(0,0,0,0)');
        else if (/mot|trunk/.test(id)) map.setPaintProperty(id, 'line-color', 'rgba(20,58,53,0.32)');
        else if (/pri|sec/.test(id)) map.setPaintProperty(id, 'line-color', 'rgba(20,58,53,0.2)');
        else if (/path/.test(id)) map.setPaintProperty(id, 'line-color', 'rgba(20,58,53,0.08)');
        else map.setPaintProperty(id, 'line-color', 'rgba(20,58,53,0.1)');
      }
    } catch {
      /* layer without that property */
    }
  }
}

const isDarkTheme = () => document.documentElement.dataset.theme === 'dark';

/** canvas-overlay colours per theme — Night's values are the exact originals, preserved */
const PAL = {
  dark: {
    corridorIdle: 'rgba(220,229,225,.07)',
    corridorHeld: 'rgba(199,147,56,.55)',
    corridorFaint: 'rgba(220,229,225,.13)',
    zoneIdle: 'rgba(58,74,79,.9)',
    labelIdle: 'rgba(220,229,225,.88)',
    labelOff: 'rgba(220,229,225,.55)',
    labelDanger: '#F0A594',
    subIdle: 'rgba(122,138,133,.95)',
    corridorLabel: 'rgba(122,138,133,.8)',
    corridorJam: 'rgba(240,165,148,.85)',
    halo: 'rgba(11,17,16,.72)',
    stadiumBg: 'rgba(16,23,21,.55)',
    stadiumRing: 'rgba(220,229,225,.14)',
    stadiumFill: 'rgba(111,179,154,.65)',
    stadiumLabel: 'rgba(220,229,225,.38)',
    stadiumPct: 'rgba(111,179,154,.85)',
    ghostRing: 'rgba(176,45,30,.5)',
    ghostText: 'rgba(224,99,79,.85)',
    raviNormal: 'rgba(201,169,97,.95)',
    raviDanger: 'rgba(240,165,148,.95)',
    raviFillNormal: '#C9A961',
    raviFillDanger: '#F0A594',
    hotelOk: 'rgba(111,179,154,.9)',
    hotelLow: 'rgba(204,95,44,.85)',
    pinRing: 'rgba(13,20,19,.9)',
    card: 'rgba(11,17,16,.92)',
    cardText: '#dce5e1',
    vignette: 'radial-gradient(ellipse at 45% 45%, transparent 55%, rgba(11,17,16,.55) 100%)',
    blank: '#0c1312',
  },
  light: {
    corridorIdle: 'rgba(20,58,53,.10)',
    corridorHeld: 'rgba(232,145,45,.55)',
    corridorFaint: 'rgba(20,58,53,.16)',
    zoneIdle: 'rgba(91,111,107,.5)',
    labelIdle: '#143A35',
    labelOff: 'rgba(20,58,53,.72)',
    labelDanger: '#C23B3F',
    subIdle: '#5B6F6B',
    corridorLabel: '#5B6F6B',
    corridorJam: '#C97A22',
    halo: 'rgba(245,242,236,.85)',
    stadiumBg: 'rgba(255,255,255,.6)',
    stadiumRing: 'rgba(20,58,53,.18)',
    stadiumFill: '#2FA37A',
    stadiumLabel: 'rgba(20,58,53,.55)',
    stadiumPct: '#0B4F4A',
    ghostRing: 'rgba(197,59,63,.55)',
    ghostText: '#C23B3F',
    raviNormal: 'rgba(15,118,110,.95)',
    raviDanger: 'rgba(197,59,63,.95)',
    raviFillNormal: '#0F766E',
    raviFillDanger: '#C23B3F',
    hotelOk: '#2FA37A',
    hotelLow: '#E8912D',
    pinRing: 'rgba(255,255,255,.95)',
    card: '#ffffff',
    cardText: '#143A35',
    vignette: 'radial-gradient(ellipse at 45% 45%, transparent 60%, rgba(20,58,53,.08) 100%)',
    blank: '#efe9db',
  },
};

/** keeps map labels from piling on top of each other: first come, first placed */
class LabelBox {
  private boxes: { x0: number; y0: number; x1: number; y1: number }[] = [];
  reset() {
    this.boxes.length = 0;
  }
  place(x: number, y: number, w: number, h: number, align: CanvasTextAlign): boolean {
    const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    const b = { x0: x0 - 3, y0: y - h, x1: x0 + w + 3, y1: y + 3 };
    for (const o of this.boxes) if (b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0) return false;
    this.boxes.push(b);
    return true;
  }
  reserve(x: number, y: number, r: number) {
    this.boxes.push({ x0: x - r, y0: y - r, x1: x + r, y1: y + r });
  }
  reserveRect(x0: number, y0: number, x1: number, y1: number) {
    this.boxes.push({ x0, y0, x1, y1 });
  }
}

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
};

type P = { x: number; y: number };
interface Geo {
  zoneXY: P[];
  offZone: boolean[];
  links: { a: P; b: P; c: P; off: boolean; len: number }[];
}
interface HoverInfo {
  x: number;
  y: number;
  title: string;
  status?: string;
  rows: { k: string; v: string }[];
}

export default function FlowMap({ getState, fitKey, zoomBoost = 0.05 }: { getState: () => MapFrameState; fitKey?: string; zoomBoost?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const getRef = useRef(getState);
  getRef.current = getState;
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [nowClock, setNowClock] = useState('');
  const [venueName, setVenueName] = useState('');

  // re-tint the basemap whenever the site-wide Light/Night toggle changes (lib/theme.ts)
  useEffect(() => {
    const apply = () => {
      const map = mapRef.current;
      if (!map) return;
      const dark = isDarkTheme();
      if (map.isStyleLoaded()) (dark ? tintBasemapDark : tintBasemapLight)(map);
      if (process.env.NEXT_PUBLIC_DEMO_OFFLINE === '1') {
        try {
          map.setPaintProperty('bg', 'background-color', dark ? PAL.dark.blank : PAL.light.blank);
        } catch {
          /* style not ready yet */
        }
      }
    };
    const mo = new MutationObserver(apply);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    const offline = process.env.NEXT_PUBLIC_DEMO_OFFLINE === '1';
    const dark = isDarkTheme();
    const map = new maplibregl.Map({
      container: mapEl.current!,
      style: offline ? blankStyle(dark ? PAL.dark.blank : PAL.light.blank) : CARTO,
      center: [73.024, 19.044],
      zoom: 14,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      fadeDuration: 0,
    });
    mapRef.current = map;
    (window as unknown as { __map?: maplibregl.Map }).__map = map;
    map.on('style.load', () => (isDarkTheme() ? tintBasemapDark : tintBasemapLight)(map));
    map.on('error', () => {
      /* tiles unavailable: the overlay still draws on the ink background */
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // frame the scenario's on-map zones
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const fit = () => {
      const { scn } = getRef.current();
      setVenueName(scn.venueLabel);
      const ids = scn.mapZones || scn.zones.filter((z) => z.type !== 'hotel').map((z) => z.id);
      const zs = scn.zones.filter((z) => ids.indexOf(z.id) >= 0);
      const b = new maplibregl.LngLatBounds();
      zs.forEach((z) => {
        const d = displayLatLng(scn, z);
        b.extend([d.lng, d.lat]);
      });
      const w = wrap.current!.clientWidth,
        h = wrap.current!.clientHeight;
      // fit the whole approach, then lean in on the stadium: the gates and forecourts are where
      // the story happens; far origins sit at the edge of the view with their corridors running in
      const cam = map.cameraForBounds(b, { padding: { top: 120, bottom: 200, left: 40, right: Math.min(300, w * 0.24) } });
      const venue = scn.zones.find((z) => z.type === 'venue');
      if (cam && venue) {
        const c = maplibregl.LngLat.convert(cam.center!);
        const vd = displayLatLng(scn, venue);
        const zoom = Math.min(16.4, (cam.zoom ?? 14) + zoomBoost);
        map.jumpTo({ center: [c.lng * 0.8 + vd.lng * 0.2, c.lat * 0.8 + vd.lat * 0.2], zoom });
        // keep the venue left of the readout column and above the timeline
        map.panBy([Math.min(110, w * 0.08), 10], { duration: 0 });
      } else map.fitBounds(b, { padding: 80, duration: 0 });
    };
    let lastW = 0,
      lastH = 0;
    const ro = new ResizeObserver(() => {
      const w = wrap.current!.clientWidth,
        h = wrap.current!.clientHeight;
      if (!w || !h || (Math.abs(w - lastW) < 40 && Math.abs(h - lastH) < 40)) return;
      lastW = w;
      lastH = h;
      map.resize();
      fit();
    });
    ro.observe(wrap.current!);
    return () => ro.disconnect();
  }, [fitKey, zoomBoost]);

  useEffect(() => {
    const canvas = cv.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let W = 0,
      H = 0;
    let last = performance.now();
    let anim = 0;
    const lb = new LabelBox();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const resize = () => {
      const r = wrap.current!.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width;
      H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mapRef.current?.resize();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap.current!);

    const project = (lat: number, lng: number): P => {
      const map = mapRef.current;
      if (!map) return { x: 0, y: 0 };
      const p = map.project([lng, lat]);
      return { x: p.x, y: p.y };
    };
    const M = 46;
    const clampEdge = (p: P, cx: number, cy: number): P & { off: boolean } => {
      const x0 = M,
        y0 = M + 40,
        x1 = W - M,
        y1 = H - 150;
      if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) return { ...p, off: false };
      const dx = p.x - cx,
        dy = p.y - cy;
      let t = 1;
      if (dx > 0) t = Math.min(t, (x1 - cx) / dx);
      if (dx < 0) t = Math.min(t, (x0 - cx) / dx);
      if (dy > 0) t = Math.min(t, (y1 - cy) / dy);
      if (dy < 0) t = Math.min(t, (y0 - cy) / dy);
      return { x: cx + dx * t, y: cy + dy * t, off: true };
    };
    const bez = (a: P, c: P, b: P, u: number): P => {
      const v = 1 - u;
      return { x: v * v * a.x + 2 * v * u * c.x + u * u * b.x, y: v * v * a.y + 2 * v * u * c.y + u * u * b.y };
    };
    const bezTan = (a: P, c: P, b: P, u: number): P => ({ x: 2 * (1 - u) * (c.x - a.x) + 2 * u * (b.x - c.x), y: 2 * (1 - u) * (c.y - a.y) + 2 * u * (b.y - c.y) });

    const geometry = (scn: Scenario): Geo => {
      const zi: Record<string, number> = {};
      scn.zones.forEach((z, i) => (zi[z.id] = i));
      const raw = scn.zones.map((z) => {
        const d = displayLatLng(scn, z);
        return project(d.lat, d.lng);
      });
      const clamped = raw.map((p) => clampEdge(p, W * 0.46, H * 0.44));
      const links = scn.links.map((l) => {
        const a = clamped[zi[l.from]],
          b = clamped[zi[l.to]];
        const dx = b.x - a.x,
          dy = b.y - a.y,
          len = Math.hypot(dx, dy) || 1;
        const k = l.mode === 'gate' ? 0 : ((hash(l.id) % 7) / 7) * 0.22 + (hash(l.id) % 2 ? 0.06 : -0.06);
        const c = { x: (a.x + b.x) / 2 - (dy / len) * len * k * 0.5, y: (a.y + b.y) / 2 + (dx / len) * len * k * 0.5 };
        return { a, b, c, off: a.off && b.off, len };
      });
      return { zoneXY: clamped, offZone: clamped.map((p) => p.off), links };
    };

    // teardrop pin — reference/ui-mockup.html's marker language, sized/coloured from real data
    const pin = (c: CanvasRenderingContext2D, x: number, y: number, color: string, ring: string, r = 13) => {
      c.save();
      c.translate(x, y);
      c.shadowColor = 'rgba(0,0,0,.35)';
      c.shadowBlur = 7;
      c.shadowOffsetY = 2;
      c.beginPath();
      c.moveTo(0, r * 0.7);
      c.bezierCurveTo(-r * 0.3, r * 0.1, -r, -r * 0.1, -r, -r);
      c.arc(0, -r, r, Math.PI, 0);
      c.bezierCurveTo(r, -r * 0.1, r * 0.3, r * 0.1, 0, r * 0.7);
      c.closePath();
      c.fillStyle = color;
      c.fill();
      c.restore();
      c.strokeStyle = ring;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x, y + r * 0.7);
      c.bezierCurveTo(x - r * 0.3, y + r * 0.1, x - r, y - r * 0.1, x - r, y - r);
      c.arc(x, y - r, r, Math.PI, 0);
      c.bezierCurveTo(x + r, y - r * 0.1, x + r * 0.3, y + r * 0.1, x, y + r * 0.7);
      c.stroke();
    };

    // every gate/source zone currently on screen, rebuilt each frame — hit-tested against all of
    // them (found via testing: keeping only the single last-seen zone meant hovering near Gate 1
    // showed Gate 5's tooltip, since the zones loop visits gate3/gate1/gate5 in that order and
    // only the last write survived).
    let hoverGates: { g: Scenario['zones'][number]; x: number; y: number; capPerMin: number; demandPerMin: number; den: number }[] = [];
    let hoverSrcs: { z: Scenario['zones'][number]; x: number; y: number }[] = [];

    // MapLibre's own mousemove (map.on, not a DOM listener): its internal canvas is nested inside
    // mapEl and stops propagation on its own pointer events, so a DOM listener on an ancestor
    // never fires (found by dispatching a synthetic pointermove and seeing it never arrive).
    // e.point is already relative to the map container, i.e. the same space G.zoneXY uses.
    const onMove = (e: { point: { x: number; y: number } }) => {
      const px = e.point.x,
        py = e.point.y;
      let best: { d: number; hit: () => void } | null = null;
      for (const g of hoverGates) {
        const d = Math.hypot(px - g.x, py - (g.y - 13));
        if (d < 16 && (!best || d < best.d))
          best = {
            d,
            hit: () =>
              setHover({
                x: px,
                y: py,
                title: g.g.name,
                status: legendWord(g.den),
                rows: [
                  { k: 'Can let in per minute', v: Math.round(g.capPerMin).toString() },
                  { k: 'People arriving per minute', v: Math.round(g.demandPerMin).toString() },
                ],
              }),
          };
      }
      for (const s of hoverSrcs) {
        const d = Math.hypot(px - s.x, py - s.y);
        if (d < 14 && (!best || d < best.d)) best = { d, hit: () => setHover({ x: px, y: py, title: s.z.name, rows: [{ k: 'People come here first, then walk to a gate.', v: '' }] }) };
      }
      if (best) best.hit();
      else setHover((h) => (h ? null : h));
    };
    const onLeave = () => setHover(null);
    const mapForHover = mapRef.current;
    mapForHover?.on('mousemove', onMove);
    mapForHover?.on('mouseout', onLeave);

    const draw = (now: number) => {
      const dt = Math.min(60, now - last);
      last = now;
      anim += dt * (reduceMotion ? 0.015 : 0.06);
      const st = getRef.current();
      const { scn, cur, ghost } = st;
      const t = Math.max(0, Math.min(scn.horizon - 1, Math.floor(st.tick)));
      const f = cur.frames[t];
      const gf = ghost && ghost !== cur ? ghost.frames[t] : null;
      ctx.clearRect(0, 0, W, H);
      if (!mapRef.current || !f) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const C = isDarkTheme() ? PAL.dark : PAL.light;
      let venueLabelBox: { x0: number; y0: number; x1: number; y1: number } | null = null;
      setNowClock(clockFor(scn, t));
      const G = geometry(scn);
      const Z = scn.zones;
      const zi: Record<string, number> = {};
      Z.forEach((z, i) => (zi[z.id] = i));
      const venueIdx = Z.findIndex((z) => z.type === 'venue');
      const font = getComputedStyle(document.body).fontFamily;
      const mono = 'JetBrains Mono, ui-monospace, monospace';

      // corridors
      scn.links.forEach((l, i) => {
        const g = G.links[i];
        const sat = f.linkSat[i],
          occ = f.linkOcc[i],
          den = f.linkDen[i];
        ctx.lineCap = 'round';
        if (g.off) {
          ctx.setLineDash([3, 6]);
          ctx.strokeStyle = sat > 0.98 ? C.corridorHeld : C.corridorFaint;
          ctx.lineWidth = 1.3;
        } else {
          ctx.strokeStyle = C.corridorIdle;
          ctx.lineWidth = l.mode === 'gate' ? 3 : 6;
        }
        ctx.beginPath();
        ctx.moveTo(g.a.x, g.a.y);
        ctx.quadraticCurveTo(g.c.x, g.c.y, g.b.x, g.b.y);
        ctx.stroke();
        ctx.setLineDash([]);
        if (!g.off && (occ > 15 || sat > 0.05)) {
          const load = Math.max(den, sat > 1 ? 3.4 : sat * 1.6, Math.min(2.2, occ / 1400));
          ctx.strokeStyle = denColor(load, 0.55);
          ctx.lineWidth = l.mode === 'gate' ? 3 : Math.min(11, 2.4 + load * 1.8 + sat * 1.4);
          ctx.beginPath();
          ctx.moveTo(g.a.x, g.a.y);
          ctx.quadraticCurveTo(g.c.x, g.c.y, g.b.x, g.b.y);
          ctx.stroke();
        }
        if (st.highlightLink === l.id) {
          ctx.strokeStyle = 'rgba(201,169,97,.9)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 5]);
          ctx.lineDashOffset = -anim * 0.8;
          ctx.beginPath();
          ctx.moveTo(g.a.x, g.a.y);
          ctx.quadraticCurveTo(g.c.x, g.c.y, g.b.x, g.b.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.lineDashOffset = 0;
        }
      });

      // people on the move
      scn.links.forEach((l, i) => {
        const occ = f.linkOcc[i];
        if (occ < 25) return;
        const g = G.links[i];
        const n = Math.min(g.off ? 18 : 64, Math.ceil(occ / (g.off ? 260 : 80)));
        const sat = f.linkSat[i];
        const held = f.linkDen[i] >= 3 || (sat > 1.2 && l.areaM2);
        const speed = Math.max(0.05, 1 - Math.min(1, sat)) * 0.5 + 0.05;
        const spread = Math.min(14, 2.5 + occ / 260);
        ctx.fillStyle = denColor(Math.max(1.1, f.linkDen[i], held ? 3.8 : 0), 0.92);
        for (let k = 0; k < n; k++) {
          const seed = (k * 0.6180339887 + i * 0.137) % 1;
          let u = (seed + anim * speed * 0.009) % 1;
          if (held) u = 0.55 + u * 0.45; // spillback: people bunch against the full zone ahead
          const p = bez(g.a, g.c, g.b, u);
          const tg = bezTan(g.a, g.c, g.b, u);
          const tl = Math.hypot(tg.x, tg.y) || 1;
          const jt = (((k * 2654435761) % 1000) / 1000 - 0.5) * spread;
          ctx.beginPath();
          ctx.arc(p.x + (-tg.y / tl) * jt, p.y + (tg.x / tl) * jt, g.off ? 1.1 : 1.45, 0, 6.2832);
          ctx.fill();
        }
      });

      // the stadium
      if (venueIdx >= 0) {
        const vz = Z[venueIdx];
        const vp = G.zoneXY[venueIdx];
        let gr = 0;
        Z.filter((z) => z.type === 'gate').forEach((gz) => {
          const p = G.zoneXY[zi[gz.id]];
          gr = Math.max(gr, Math.hypot(p.x - vp.x, p.y - vp.y));
        });
        gr = Math.max(26, gr * 0.8);
        ctx.fillStyle = C.stadiumBg;
        ctx.beginPath();
        ctx.ellipse(vp.x, vp.y, gr, gr * 0.84, 0, 0, 6.2832);
        ctx.fill();
        ctx.strokeStyle = C.stadiumRing;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        const cap = vz.capacity || 1;
        const pct = Math.min(1, f.arrived / cap);
        ctx.strokeStyle = C.stadiumFill;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(vp.x, vp.y, gr, gr * 0.84, 0, -Math.PI / 2, -Math.PI / 2 + 6.2832 * pct);
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillStyle = C.stadiumLabel;
        ctx.font = `500 11px ${font}`;
        const vw1 = ctx.measureText(scn.venueLabel.toUpperCase()).width;
        ctx.fillText(scn.venueLabel.toUpperCase(), vp.x, vp.y - 4);
        ctx.fillStyle = C.stadiumPct;
        ctx.font = `500 12px ${mono}`;
        const pctText = Math.round(pct * 100) + '% inside';
        const vw2 = ctx.measureText(pctText).width;
        ctx.fillText(pctText, vp.x, vp.y + 13);
        // the venue's own two-line label isn't part of the labs[]/LabelBox system below (it's
        // always drawn, never collision-tested against), so reserve its real footprint here —
        // a single small circle around the venue's centre point used to under-cover it, letting
        // a nearby gate's label render right on top of "DY PATIL STADIUM" (found via screenshot).
        venueLabelBox = { x0: vp.x - Math.max(vw1, vw2) / 2 - 4, y0: vp.y - 16, x1: vp.x + Math.max(vw1, vw2) / 2 + 4, y1: vp.y + 20 };
      }

      // zones: shapes first, labels queued by priority and placed without collisions
      type Lab = { text: string; x: number; y: number; align: CanvasTextAlign; font: string; color: string; pr: number; sub?: { text: string; color: string; font: string } };
      const labs: Lab[] = [];
      hoverGates = [];
      hoverSrcs = [];
      Z.forEach((z, i) => {
        if (i === venueIdx) return;
        const p = G.zoneXY[i];
        const den = f.zoneDen[i],
          occ = f.zoneOcc[i];
        const right = p.x > W * 0.55;
        if (z.type === 'hotel' || z.type === 'food') {
          if (z.type === 'hotel') {
            const free = (z.rooms || 0) - (z.occupied || 0);
            const ratio = z.rooms ? free / z.rooms : 0;
            ctx.fillStyle = ratio > 0.35 ? C.hotelOk : C.hotelLow;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4.5, 0, 6.2832);
            ctx.fill();
            labs.push({ text: z.name.replace(' hotels', '').replace('CBD ', '') + ' hotels · ' + free.toLocaleString('en-IN') + ' rooms free', x: p.x + (right ? -10 : 10), y: p.y + 3.5, align: right ? 'right' : 'left', font: `500 10.5px ${font}`, color: C.labelOff, pr: 20 });
            if (!G.offZone[i]) hoverSrcs.push({ z, x: p.x, y: p.y });
          } else {
            const w = f.foodWait[z.id] || 0;
            const near = z.near ? f.zoneDen[zi[z.near]] : 0;
            ctx.fillStyle = denColor(Math.max(0.6, near, w / 5), 0.9);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, 6.2832);
            ctx.fill();
            if (w > 0.5) labs.push({ text: 'Food · ' + Math.round(w) + ' min wait', x: p.x + (right ? -8 : 8), y: p.y + 3.5, align: right ? 'right' : 'left', font: `500 10px ${font}`, color: C.corridorJam, pr: 15 });
          }
          return;
        }
        if (z.type === 'transit' || z.type === 'parking') {
          if (!G.offZone[i]) hoverSrcs.push({ z, x: p.x, y: p.y });
        }
        const r = z.type === 'gate' ? 13 : Math.max(9, Math.sqrt(z.areaM2 || 1200) * 0.12);
        if (den > 0.15 && z.type !== 'gate') {
          const halo = ctx.createRadialGradient(p.x, p.y, r * 0.6, p.x, p.y, r + Math.min(34, den * 8));
          halo.addColorStop(0, denColor(den, 0.35));
          halo.addColorStop(1, denColor(den, 0));
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + Math.min(34, den * 8), 0, 6.2832);
          ctx.fill();
        }
        if (z.type === 'gate') {
          const gateLinkIdx = scn.links.findIndex((l) => l.mode === 'gate' && l.gate === z.id);
          const demandPerMin = gateLinkIdx >= 0 ? f.linkFlow[gateLinkIdx] : 0;
          const capPerMin = (z.lanes || 0) * scn.laneRate;
          if (!G.offZone[i]) hoverGates.push({ g: z, x: p.x, y: p.y, capPerMin, demandPerMin, den });
          if (den >= 2) {
            const halo = ctx.createRadialGradient(p.x, p.y - r, 4, p.x, p.y - r, r + 22 + den * 5);
            halo.addColorStop(0, denColor(den, 0.4));
            halo.addColorStop(1, denColor(den, 0));
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(p.x, p.y - r, r + 22 + den * 5, 0, 6.2832);
            ctx.fill();
          }
          pin(ctx, p.x, p.y, denColor(Math.max(0.3, den), 1), C.pinRing, r);
          if (den >= CRUSH) {
            const ph = Math.sin(anim * 0.12);
            ctx.strokeStyle = `rgba(240,165,148,${0.45 + 0.4 * ph})`;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.arc(p.x, p.y - r, r + 8 + 4 * ph, 0, 6.2832);
            ctx.stroke();
          }
          const danger = den >= CRUSH;
          // flip below the pin when there isn't room above (top chips + margin) — a gate near the
          // top edge of the framed view was otherwise clipping its own name line (found via
          // screenshot: only "Comfortable · 0.0/m²" was visible, "Gate 1" cut off above y=0).
          const gateUp = p.y - r - 39 > 66;
          labs.push({
            text: z.name,
            x: p.x,
            y: gateUp ? p.y - r - 26 : p.y + r + 16,
            align: 'center',
            font: `700 12px ${font}`,
            color: danger ? C.labelDanger : C.labelIdle,
            pr: danger ? 100 : 85,
            sub: { text: legendWord(den) + ' · ' + den.toFixed(1) + '/m²', color: danger ? C.labelDanger : C.subIdle, font: `600 10.5px ${mono}` },
          });
          return;
        }
        ctx.fillStyle = den > 0.15 ? denColor(den, 0.95) : C.zoneIdle;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, 6.2832);
        ctx.fill();
        if (G.offZone[i]) {
          labs.push({ text: z.name + (right ? ' →' : ''), x: p.x + (right ? -12 : 12), y: p.y + 3.5, align: right ? 'right' : 'left', font: `500 10.5px ${font}`, color: C.labelOff, pr: 40 });
          return;
        }
        const up = z.type === 'plaza' ? p.y < (venueIdx >= 0 ? G.zoneXY[venueIdx].y : H / 2) : p.y > H * 0.66;
        const y1 = up ? p.y - r - 18 : p.y + r + 16;
        const danger = den >= CRUSH;
        labs.push({
          text: z.name,
          x: p.x,
          y: y1,
          align: 'center',
          font: `600 11.5px ${font}`,
          color: danger ? C.labelDanger : C.labelIdle,
          pr: danger ? 100 : z.type === 'plaza' ? 75 : 60,
          sub: occ > 250 ? { text: occ.toLocaleString('en-IN', { maximumFractionDigits: 0 }) + ' · ' + den.toFixed(1) + '/m²', color: danger ? C.labelDanger : C.subIdle, font: `500 11px ${mono}` } : undefined,
        });
      });

      // corridor labels where they are busy
      scn.links.forEach((l, i) => {
        if (l.mode === 'gate' || (venueIdx >= 0 && l.to === Z[venueIdx].id)) return;
        const g = G.links[i];
        if (g.off || g.len < 110) return;
        if (f.linkOcc[i] < 160 && f.linkSat[i] < 0.6) return;
        const m = bez(g.a, g.c, g.b, 0.5);
        const held = f.linkDen[i] >= CRUSH;
        const jam = f.linkSat[i] > 0.98 || f.linkDen[i] >= 3;
        labs.push({ text: l.name + (held ? ' · people held here' : jam ? ' · at capacity' : ''), x: m.x, y: m.y - 9, align: 'center', font: `500 10.5px ${font}`, color: held ? C.labelDanger : jam ? C.corridorJam : C.corridorLabel, pr: held ? 90 : jam ? 55 : 30 });
      });

      lb.reset();
      if (venueIdx >= 0) lb.reserve(G.zoneXY[venueIdx].x, G.zoneXY[venueIdx].y + 4, 34);
      if (venueLabelBox) lb.reserveRect(venueLabelBox.x0, venueLabelBox.y0, venueLabelBox.x1, venueLabelBox.y1);
      labs.sort((a, b) => b.pr - a.pr);
      for (const L of labs) {
        ctx.font = L.font;
        const w = ctx.measureText(L.text).width;
        let h = 12,
          w2 = w;
        if (L.sub) {
          ctx.font = L.sub.font;
          w2 = Math.max(w, ctx.measureText(L.sub.text).width);
          h = 26;
        }
        if (!lb.place(L.x, L.y + (L.sub ? 13 : 0), w2, h, L.align)) continue;
        ctx.textAlign = L.align;
        ctx.font = L.font;
        ctx.fillStyle = C.halo;
        ctx.fillText(L.text, L.x + 0.5, L.y + 0.8);
        ctx.fillStyle = L.color;
        ctx.fillText(L.text, L.x, L.y);
        if (L.sub) {
          ctx.font = L.sub.font;
          ctx.fillStyle = L.sub.color;
          ctx.fillText(L.sub.text, L.x, L.y + 13);
        }
      }

      // ghost of the do-nothing evening
      if (gf && ghost) {
        const wz = ghost.worst.zone;
        if (wz >= 0) {
          const gp = G.zoneXY[wz];
          const gd = gf.zoneDen[wz];
          if (gd > 1 && !G.offZone[wz]) {
            ctx.strokeStyle = C.ghostRing;
            ctx.setLineDash([3, 4]);
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(gp.x, gp.y, 16 + gd * 6, 0, 6.2832);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = C.ghostText;
            ctx.font = `500 10.5px ${mono}`;
            ctx.textAlign = 'center';
            ctx.fillText('if you did nothing: ' + gd.toFixed(1) + '/m²', gp.x, gp.y + 30 + gd * 6);
          }
        }
      }

      // Ravi
      const tr = st.raviCur;
      if (tr && t >= st.raviRelease - 20) {
        const a = personAt(tr, cur, t),
          s = a.seg;
        let pt: P | null = null;
        if (s.type === 'inside' && venueIdx >= 0) pt = G.zoneXY[venueIdx];
        else if (s.type === 'move') {
          const li = scn.links.findIndex((x) => x.id === s.link);
          const g = G.links[li];
          pt = bez(g.a, g.c, g.b, Math.min(1, a.prog || 0));
        } else if (s.type === 'wait') {
          const zp = G.zoneXY[s.zi];
          if ((a.den || 0) >= 5.0 && s.inLink != null) {
            const g = G.links[s.inLink];
            pt = bez(g.a, g.c, g.b, 0.84);
          } else pt = zp;
        }
        if (pt && t >= st.raviRelease) {
          const danger = (a.den || 0) >= CRUSH;
          const ph = Math.sin(anim * 0.14);
          ctx.strokeStyle = danger ? C.raviDanger : C.raviNormal;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 8 + 2 * ph, 0, 6.2832);
          ctx.stroke();
          ctx.fillStyle = danger ? C.raviFillDanger : C.raviFillNormal;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3, 0, 6.2832);
          ctx.fill();
          ctx.textAlign = 'left';
          ctx.font = `600 11px ${font}`;
          ctx.fillStyle = C.labelIdle;
          ctx.fillText('Ravi', pt.x + 13, pt.y + 4);
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mapForHover?.off('mousemove', onMove);
      mapForHover?.off('mouseout', onLeave);
    };
  }, []);

  const zoomBy = (f: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.zoomTo((map.getZoom() || 14) + Math.log2(f));
  };
  const resetView = () => {
    const map = mapRef.current;
    if (!map) return;
    const w = wrap.current!.clientWidth;
    const { scn } = getRef.current();
    const ids = scn.mapZones || scn.zones.filter((z) => z.type !== 'hotel').map((z) => z.id);
    const zs = scn.zones.filter((z) => ids.indexOf(z.id) >= 0);
    const b = new maplibregl.LngLatBounds();
    zs.forEach((z) => {
      const d = displayLatLng(scn, z);
      b.extend([d.lng, d.lat]);
    });
    const venue = scn.zones.find((z) => z.type === 'venue');
    const cam = map.cameraForBounds(b, { padding: { top: 120, bottom: 200, left: 40, right: Math.min(300, w * 0.24) } });
    if (cam && venue) {
      const c = maplibregl.LngLat.convert(cam.center!);
      const vd = displayLatLng(scn, venue);
      map.flyTo({ center: [c.lng * 0.8 + vd.lng * 0.2, c.lat * 0.8 + vd.lat * 0.2], zoom: Math.min(16.4, (cam.zoom ?? 14) + zoomBoost), duration: 400 });
    }
  };

  return (
    <div ref={wrap} className="absolute inset-0 overflow-hidden bg-ink-deep">
      <div ref={mapEl} style={{ position: 'absolute', inset: 0 }} />
      <canvas ref={cv} className="pointer-events-none absolute inset-0" />
      {/* vignette so overlays read cleanly */}
      <div className="pointer-events-none absolute inset-0" style={{ background: isDarkTheme() ? PAL.dark.vignette : PAL.light.vignette }} />

      {/* context pill */}
      <div className="pointer-events-none absolute left-3 top-3 flex max-w-[62%] items-center gap-2 rounded-xl border border-line bg-panel/90 px-3 py-2 text-[12.5px] font-semibold text-text shadow-[var(--shadow-card)] backdrop-blur-sm">
        <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-danger" aria-hidden>
          <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
        </svg>
        <span className="truncate">{venueName || 'Loading venue…'}</span>
      </div>

      {/* time-of-day chip */}
      <div className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-line bg-panel/90 px-3 py-1.5 text-[12px] font-semibold text-text shadow-[var(--shadow-card)] backdrop-blur-sm">
        <span className="num">{nowClock}</span>
      </div>

      {/* zoom / reset — stacked below the context pill, top-left: Console.tsx's own
          Readouts/RaviCard overlay (rendered after FlowMap in the DOM) claims top-right, and
          Caption/Timeline span the full width at the bottom, so top-left below the pill is the
          one corner nothing else already occupies (found via screenshot: at top-right or
          bottom-left these buttons were clickable but invisible, covered by those panels). */}
      <div className="pointer-events-auto absolute left-3 top-[54px] flex flex-col overflow-hidden rounded-xl border border-line bg-panel/90 shadow-[var(--shadow-card)] backdrop-blur-sm">
        <button onClick={() => zoomBy(1.35)} title="Zoom in" className="grid size-9 place-items-center text-[17px] text-text hover:bg-panel-2">
          +
        </button>
        <button onClick={() => zoomBy(1 / 1.35)} title="Zoom out" className="grid size-9 place-items-center border-t border-line text-[17px] text-text hover:bg-panel-2">
          −
        </button>
        <button onClick={resetView} title="Reset view" className="grid size-9 place-items-center border-t border-line text-text hover:bg-panel-2">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="12" r="3.2" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
      </div>

      {/* compass — rotation is locked (dragRotate: false), so this always points north */}
      <div className="pointer-events-none absolute left-3 top-[171px] grid size-9 place-items-center rounded-full border border-line bg-panel/90 shadow-[var(--shadow-card)]" title="North" aria-hidden>
        <svg viewBox="0 0 24 24" className="size-5">
          <path d="M12 2l4.2 10H7.8z" fill="var(--color-danger)" />
          <path d="M12 22l-4.2-10h8.4z" fill="var(--color-dimmer)" />
        </svg>
      </div>

      {/* legend — same words/thresholds as engine/constants.ts (CRUSH/JAM), via legendWord().
          bottom-[104px], not bottom-3: Console.tsx's Timeline has its own full-width, near-opaque
          background band at the very bottom (found via screenshot: the card was there but hidden
          behind it) — this clears it with a small gap. */}
      <div className="pointer-events-none absolute bottom-[104px] right-3 w-[168px] rounded-xl border border-line bg-panel/90 px-3 py-2.5 text-[11px] shadow-[var(--shadow-card)] backdrop-blur-sm">
        <div className="mb-1 font-semibold text-text">How crowded is it?</div>
        <div className="h-1.5 w-full rounded-full" style={{ background: 'linear-gradient(90deg,#2C4750,#3F7A6B,#9AA24B,#C79338,#CC5F2C,#B02D1E)' }} />
        <div className="mt-1 flex justify-between text-[10px] text-dim">
          <span>Comfortable</span>
          <span>Packed</span>
        </div>
      </div>

      {/* hover tooltip: real capacity/demand for gates, a one-line explainer for sources */}
      {hover ? (
        <div
          className="pointer-events-none absolute z-10 min-w-[190px] rounded-xl border border-line bg-ink px-3 py-2.5 text-[12.5px] text-white shadow-[var(--shadow-card)]"
          style={{ left: Math.min(hover.x + 16, (wrap.current?.clientWidth || 999) - 210), top: Math.max(8, hover.y - 20) }}
        >
          <div className="flex items-center gap-2 font-semibold">
            {hover.title}
            {hover.status ? <span className="text-[11px] font-normal text-dimmer">· {hover.status}</span> : null}
          </div>
          {hover.rows.map((r, i) =>
            r.v ? (
              <div key={i} className="mt-1 flex justify-between gap-3 text-dim">
                <span>{r.k}</span>
                <span className="num font-semibold text-white">{r.v}</span>
              </div>
            ) : (
              <div key={i} className="mt-1 text-dim">
                {r.k}
              </div>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
