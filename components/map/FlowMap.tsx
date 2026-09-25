'use client';
/*
 * The live map. A calm dark basemap (MapLibre) with a hand-drawn canvas overlay:
 * corridors, moving people, density halos, crush rings, the stadium filling, Ravi,
 * and the ghost of the do-nothing evening. Every visual is read from the current SimResult frame.
 */
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { CRUSH, personAt, type Scenario, type SimResult, type Trace } from '@/engine';
import { denColor } from '@/lib/colors';
import { displayLatLng } from '@/lib/display';

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
const BLANK: StyleSpecification = { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0c1312' } }] };

// ink/brass control-room basemap, recoloured from Carto dark-matter
function tintBasemap(map: maplibregl.Map) {
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

export default function FlowMap({ getState, fitKey, zoomBoost = 0.05 }: { getState: () => MapFrameState; fitKey?: string; zoomBoost?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const getRef = useRef(getState);
  getRef.current = getState;

  useEffect(() => {
    const offline = process.env.NEXT_PUBLIC_DEMO_OFFLINE === '1';
    const map = new maplibregl.Map({
      container: mapEl.current!,
      style: offline ? BLANK : CARTO,
      center: [73.024, 19.044],
      zoom: 14,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      fadeDuration: 0,
    });
    mapRef.current = map;
    (window as unknown as { __map?: maplibregl.Map }).__map = map;
    map.on('style.load', () => tintBasemap(map));
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

    const draw = (now: number) => {
      const dt = Math.min(60, now - last);
      last = now;
      anim += dt * 0.06;
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
          ctx.strokeStyle = sat > 0.98 ? 'rgba(199,147,56,.55)' : 'rgba(220,229,225,.13)';
          ctx.lineWidth = 1.3;
        } else {
          ctx.strokeStyle = 'rgba(220,229,225,.07)';
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
        ctx.fillStyle = 'rgba(16,23,21,.55)';
        ctx.beginPath();
        ctx.ellipse(vp.x, vp.y, gr, gr * 0.84, 0, 0, 6.2832);
        ctx.fill();
        ctx.strokeStyle = 'rgba(220,229,225,.14)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        const cap = vz.capacity || 1;
        const pct = Math.min(1, f.arrived / cap);
        ctx.strokeStyle = 'rgba(111,179,154,.65)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(vp.x, vp.y, gr, gr * 0.84, 0, -Math.PI / 2, -Math.PI / 2 + 6.2832 * pct);
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(220,229,225,.38)';
        ctx.font = `500 11px ${font}`;
        ctx.fillText(scn.venueLabel.toUpperCase(), vp.x, vp.y - 4);
        ctx.fillStyle = 'rgba(111,179,154,.85)';
        ctx.font = `500 12px ${mono}`;
        ctx.fillText(Math.round(pct * 100) + '% inside', vp.x, vp.y + 13);
      }

      // zones: shapes first, labels queued by priority and placed without collisions
      type Lab = { text: string; x: number; y: number; align: CanvasTextAlign; font: string; color: string; pr: number; sub?: { text: string; color: string; font: string } };
      const labs: Lab[] = [];
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
            ctx.fillStyle = ratio > 0.35 ? 'rgba(111,179,154,.9)' : 'rgba(204,95,44,.85)';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4.5, 0, 6.2832);
            ctx.fill();
            labs.push({ text: z.name.replace(' hotels', '').replace('CBD ', '') + ' hotels · ' + free.toLocaleString('en-IN') + ' rooms free', x: p.x + (right ? -10 : 10), y: p.y + 3.5, align: right ? 'right' : 'left', font: `500 10.5px ${font}`, color: 'rgba(220,229,225,.5)', pr: 20 });
          } else {
            const w = f.foodWait[z.id] || 0;
            const near = z.near ? f.zoneDen[zi[z.near]] : 0;
            ctx.fillStyle = denColor(Math.max(0.6, near, w / 5), 0.9);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, 6.2832);
            ctx.fill();
            if (w > 0.5) labs.push({ text: 'Food · ' + Math.round(w) + ' min wait', x: p.x + (right ? -8 : 8), y: p.y + 3.5, align: right ? 'right' : 'left', font: `500 10px ${font}`, color: 'rgba(199,147,56,.85)', pr: 15 });
          }
          return;
        }
        const r = z.type === 'gate' ? 7 : Math.max(9, Math.sqrt(z.areaM2 || 1200) * 0.12);
        if (den > 0.15) {
          const halo = ctx.createRadialGradient(p.x, p.y, r * 0.6, p.x, p.y, r + Math.min(34, den * 8));
          halo.addColorStop(0, denColor(den, 0.35));
          halo.addColorStop(1, denColor(den, 0));
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + Math.min(34, den * 8), 0, 6.2832);
          ctx.fill();
        }
        ctx.fillStyle = den > 0.15 ? denColor(den, 0.95) : 'rgba(58,74,79,.9)';
        if (z.type === 'gate') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-6, -6, 12, 12);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, 6.2832);
          ctx.fill();
        }
        if (den >= CRUSH) {
          const ph = Math.sin(anim * 0.12);
          ctx.strokeStyle = `rgba(240,165,148,${0.45 + 0.4 * ph})`;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 11 + 4 * ph, 0, 6.2832);
          ctx.stroke();
          ctx.strokeStyle = `rgba(240,165,148,${0.18 + 0.15 * ph})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 22 + 6 * ph, 0, 6.2832);
          ctx.stroke();
        }
        if (G.offZone[i]) {
          labs.push({ text: z.name + (right ? ' →' : ''), x: p.x + (right ? -12 : 12), y: p.y + 3.5, align: right ? 'right' : 'left', font: `500 10.5px ${font}`, color: 'rgba(220,229,225,.55)', pr: 40 });
          return;
        }
        const up = z.type === 'gate' || z.type === 'plaza' ? p.y < (venueIdx >= 0 ? G.zoneXY[venueIdx].y : H / 2) : p.y > H * 0.66;
        const y1 = up ? p.y - r - 18 : p.y + r + 16;
        const danger = den >= CRUSH;
        labs.push({
          text: z.name,
          x: p.x,
          y: y1,
          align: 'center',
          font: `600 11.5px ${font}`,
          color: danger ? '#F0A594' : 'rgba(220,229,225,.88)',
          pr: danger ? 100 : z.type === 'gate' ? 80 : z.type === 'plaza' ? 75 : 60,
          sub: occ > 250 ? { text: occ.toLocaleString('en-IN', { maximumFractionDigits: 0 }) + ' · ' + den.toFixed(1) + '/m²', color: danger ? '#F0A594' : 'rgba(122,138,133,.95)', font: `500 11px ${mono}` } : undefined,
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
        labs.push({ text: l.name + (held ? ' · people held here' : jam ? ' · at capacity' : ''), x: m.x, y: m.y - 9, align: 'center', font: `500 10.5px ${font}`, color: held ? '#F0A594' : jam ? 'rgba(240,165,148,.85)' : 'rgba(122,138,133,.8)', pr: held ? 90 : jam ? 55 : 30 });
      });

      lb.reset();
      if (venueIdx >= 0) lb.reserve(G.zoneXY[venueIdx].x, G.zoneXY[venueIdx].y + 4, 34);
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
        ctx.fillStyle = 'rgba(11,17,16,.72)';
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
            ctx.strokeStyle = 'rgba(176,45,30,.5)';
            ctx.setLineDash([3, 4]);
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(gp.x, gp.y, 16 + gd * 6, 0, 6.2832);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(224,99,79,.85)';
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
          ctx.strokeStyle = danger ? 'rgba(240,165,148,.95)' : 'rgba(201,169,97,.95)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 8 + 2 * ph, 0, 6.2832);
          ctx.stroke();
          ctx.fillStyle = danger ? '#F0A594' : '#C9A961';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3, 0, 6.2832);
          ctx.fill();
          ctx.textAlign = 'left';
          ctx.font = `600 11px ${font}`;
          ctx.fillText('Ravi', pt.x + 13, pt.y + 4);
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={wrap} className="absolute inset-0 overflow-hidden bg-ink-deep">
      <div ref={mapEl} style={{ position: 'absolute', inset: 0 }} />
      <canvas ref={cv} className="pointer-events-none absolute inset-0" />
      {/* vignette so overlays read cleanly */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 45% 45%, transparent 55%, rgba(11,17,16,.55) 100%)' }} />
    </div>
  );
}
