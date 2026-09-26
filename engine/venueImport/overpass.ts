/*
 * OpenStreetMap → VenueSpec (§8.5). Pure: the caller (app/worker) performs the Overpass request
 * with `overpassQuery()` and passes the JSON here. No network calls inside engine/.
 */
import { bearing, distM, offset, type LatLng, type VenueGate, type VenueHotel, type VenuePlace, type VenueSpec, type VenueStation } from './buildGraph';

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}
export interface OverpassJson {
  elements: OverpassElement[];
}
export interface VenueMeta {
  name: string;
  city: string;
  capacity: number;
  center: LatLng;
  t0Min: number;
  gatesOpenMin: number;
  showMin: number;
  id?: string;
}

/** entrances are only looked for this close to the venue centre (stadium/campus footprint) */
export const ENTRANCE_RADIUS_M = 500;
const MAX_GATES = 6,
  MAX_STATIONS = 3,
  MAX_PARKING = 2,
  MAX_HOTELS = 40;

/** Overpass QL for everything the importer uses around (lat,lng). */
export function overpassQuery(lat: number, lng: number, radiusM = 1500): string {
  const r = Math.round(radiusM);
  const e = Math.min(r, ENTRANCE_RADIUS_M);
  const a = (rr: number) => `(around:${rr},${lat},${lng})`;
  return [
    '[out:json][timeout:25];',
    '(',
    `  nwr["railway"="station"]${a(r)};`,
    `  nwr["public_transport"="station"]${a(r)};`,
    `  nwr["amenity"="bus_station"]${a(r)};`,
    `  nwr["amenity"="parking"]${a(r)};`,
    `  nwr["tourism"="hotel"]${a(r)};`,
    `  node["entrance"]${a(e)};`,
    `  node["barrier"="gate"]${a(e)};`,
    ');',
    'out center tags;',
  ].join('\n');
}

const pos = (el: OverpassElement): LatLng | null => {
  if (el.lat != null && el.lon != null) return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
};
const compass = (brg: number) => {
  const names = ['North', 'North-east', 'East', 'South-east', 'South', 'South-west', 'West', 'North-west'];
  const d = ((brg * 180) / Math.PI + 360) % 360;
  return names[Math.round(d / 45) % 8];
};
const slugId = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24) || 'venue';

function stationKind(t: Record<string, string>): VenueStation['kind'] | null {
  if (t.amenity === 'bus_station' || (t.public_transport === 'station' && (t.bus === 'yes' || t.highway === 'bus_stop') && !t.railway && t.train !== 'yes')) return 'bus';
  if (t.station === 'subway' || t.station === 'light_rail' || t.subway === 'yes' || t.light_rail === 'yes' || /metro/i.test(t.network || '') || /metro/i.test(t.name || '')) return 'metro';
  if (t.railway === 'station' || t.train === 'yes' || t.public_transport === 'station') return 'rail';
  return null;
}

export function specFromOverpass(json: OverpassJson, meta: VenueMeta): VenueSpec {
  const C = meta.center;
  const notes: string[] = ['Built automatically from OpenStreetMap. Every area, lane count, capacity and cohort size is an estimate.'];
  const stations: (VenueStation & { d: number })[] = [];
  const parking: (VenuePlace & { d: number })[] = [];
  const hotels: (VenueHotel & { d: number })[] = [];
  const entrances: (VenueGate & { d: number })[] = [];

  const els = [...(json.elements || [])].sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : a.id - b.id));
  for (const el of els) {
    const p = pos(el);
    const t = el.tags || {};
    if (!p) continue;
    const d = distM(C, p);
    const kind = t.railway === 'station' || t.public_transport === 'station' || t.amenity === 'bus_station' ? stationKind(t) : null;
    if (kind) {
      const name = t.name || t['name:en'] || (kind === 'bus' ? 'Bus station' : 'Station');
      // OSM often has a railway=station node AND a public_transport=station area for one station
      if (stations.some((s) => s.kind === kind && (s.name === name || distM(s, p) < 150))) continue;
      stations.push({ name, lat: p.lat, lng: p.lng, kind, d, estimated: true });
      continue;
    }
    if (t.amenity === 'parking') {
      if (t.access === 'private' || t.access === 'no') continue;
      parking.push({ name: t.name || 'Parking', lat: p.lat, lng: p.lng, d, estimated: true });
      continue;
    }
    if (t.tourism === 'hotel') {
      const rooms = t.rooms ? parseInt(t.rooms, 10) : NaN;
      hotels.push({ name: t.name || 'Hotel', lat: p.lat, lng: p.lng, d, ...(Number.isFinite(rooms) && rooms > 0 ? { rooms } : {}) });
      continue;
    }
    if ((t.entrance || t.barrier === 'gate') && d <= ENTRANCE_RADIUS_M) {
      if (t.access === 'private' || t.access === 'no' || t.entrance === 'emergency' || t.entrance === 'exit') continue;
      const name = t.name || t.ref ? t.name || 'Gate ' + t.ref : '';
      entrances.push({ name, lat: p.lat, lng: p.lng, d, estimated: true });
    }
  }

  // gates: keep entrances spread around the venue — at most one per 60° sector, nearest to centre
  let gates: VenueGate[] = [];
  if (entrances.length) {
    const bySector = new Map<number, VenueGate & { d: number }>();
    for (const e of entrances) {
      const s = Math.floor(((((bearing(C, e) * 180) / Math.PI + 360) % 360) / 60)) % 6;
      const cur = bySector.get(s);
      if (!cur || e.d < cur.d) bySector.set(s, e);
    }
    gates = [...bySector.entries()]
      .sort((a, b) => a[0] - b[0])
      .slice(0, MAX_GATES)
      .map(([, e], i) => ({ id: 'gate' + (i + 1), name: e.name || compass(bearing(C, e)) + ' gate', lat: e.lat, lng: e.lng, estimated: true }));
    notes.push(`${gates.length} gates taken from OpenStreetMap entrances; lane counts default to 8.`);
  }
  if (!gates.length) {
    const n = meta.capacity > 60000 ? 4 : 3;
    const r = 80 + meta.capacity / 1000; // rough stand radius, metres
    for (let i = 0; i < n; i++) {
      const brg = (2 * Math.PI * i) / n;
      const p = offset(C, brg, r);
      gates.push({ id: 'gate' + (i + 1), name: compass(brg) + ' gate (estimated)', lat: p.lat, lng: p.lng, estimated: true });
    }
    notes.push(`No entrances in OpenStreetMap: ${n} gates placed on a ${Math.round(r)} m ring around the centre.`);
  }

  const near = <T extends { d: number }>(a: T[], n: number) => [...a].sort((x, y) => x.d - y.d).slice(0, n);
  const strip = <T extends { d: number }>(x: T): Omit<T, 'd'> => {
    const { d: _d, ...rest } = x;
    void _d;
    return rest;
  };
  const st = near(stations, MAX_STATIONS).map(strip);
  const pk = near(parking, MAX_PARKING).map(strip);
  const ht = near(hotels, MAX_HOTELS).map(strip);
  if (!st.length) notes.push('No railway, metro or bus station found nearby; rail arrivals are moved to road.');
  if (!pk.length) notes.push('No public parking found; self-drive arrivals are moved to cabs.');
  if (!ht.length) notes.push('No hotels found; hotel guests are moved to cabs.');
  else notes.push('Hotel room counts default to 120 where OpenStreetMap has none; occupancy assumed (near 95%, far 60%).');

  return {
    id: meta.id || 'osm_' + slugId(meta.name),
    name: meta.name,
    city: meta.city,
    venueLabel: meta.name,
    capacity: meta.capacity,
    center: C,
    t0Min: meta.t0Min,
    gatesOpenMin: meta.gatesOpenMin,
    showMin: meta.showMin,
    gates,
    stations: st,
    parking: pk,
    hotels: ht,
    notes,
  };
}
