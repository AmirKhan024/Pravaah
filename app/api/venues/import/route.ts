import { NextResponse } from 'next/server';
import { overpassQuery, specFromOverpass, type OverpassJson } from '@/engine';

export const dynamic = 'force-dynamic';

const UA = 'Pravaah/1.0 (hackathon demo; crowd-flow rehearsal)';

async function withTimeout<T>(p: (s: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await p(c.signal);
  } finally {
    clearTimeout(t);
  }
}

/** "Any venue in 60 seconds": Nominatim → Overpass → an estimated graph spec (built client-side). */
export async function POST(req: Request) {
  const { q, capacity, showMin } = (await req.json().catch(() => ({}))) as { q?: string; capacity?: number; showMin?: number };
  const query = String(q || '').slice(0, 120).trim();
  if (!query) return NextResponse.json({ ok: false, reason: 'Type a venue name.' }, { status: 400 });
  if (process.env.NEXT_PUBLIC_DEMO_OFFLINE === '1') return NextResponse.json({ ok: false, reason: 'Offline mode: use a cached venue.' });
  try {
    const found = await withTimeout(
      (signal) =>
        fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`, { headers: { 'user-agent': UA, 'accept-language': 'en' }, signal }).then((r) => r.json()),
      8000,
    );
    const hit = Array.isArray(found) ? found[0] : null;
    if (!hit) return NextResponse.json({ ok: false, reason: 'OpenStreetMap does not know that place.' });
    const center = { lat: +hit.lat, lng: +hit.lon };
    const osm = (await withTimeout(
      (signal) =>
        fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA },
          body: 'data=' + encodeURIComponent(overpassQuery(center.lat, center.lng, 1500)),
          signal,
        }).then((r) => r.json()),
      20000,
    )) as OverpassJson;
    const show = Math.max(9 * 60, Math.min(22 * 60, Number(showMin) || 19 * 60 + 30));
    const spec = specFromOverpass(osm, {
      name: String(hit.display_name || query).split(',')[0],
      city: String(hit.display_name || '').split(',').slice(-3, -2)[0]?.trim() || '',
      capacity: Math.max(1000, Math.min(150000, Number(capacity) || 30000)),
      center,
      t0Min: show - 330,
      gatesOpenMin: show - 210,
      showMin: show,
    });
    return NextResponse.json({ ok: true, spec, found: { name: hit.display_name, elements: osm.elements?.length || 0 } });
  } catch {
    return NextResponse.json({ ok: false, reason: 'OpenStreetMap did not answer in time. Use a cached venue.' });
  }
}
