/*
 * "Any venue in 60 seconds" (SOURCE_OF_TRUTH §8.5) — turn a compact, human-editable VenueSpec
 * into a simulate()-able Scenario. Pure and deterministic: same spec → same graph.
 *
 * Everything this file invents (areas, lanes, caps, travel times, cohort sizes and timing)
 * is a default, not a survey. Every zone/link built from a default carries `estimated: true`.
 */
import { clockFor, comma } from '../format';
import type { Cohort, Lang, Link, Scenario, Zone } from '../types';

export interface LatLng {
  lat: number;
  lng: number;
}
export interface VenueGate extends LatLng {
  id?: string;
  name: string;
  /** screening lanes (default 8) */
  lanes?: number;
  /** forecourt area in front of the gate, m² (default 2,000) */
  plazaM2?: number;
  estimated?: boolean;
}
export interface VenueStation extends LatLng {
  name: string;
  kind: 'rail' | 'metro' | 'bus';
  /** relative share of the rail split (default equal) */
  weight?: number;
  areaM2?: number;
  estimated?: boolean;
}
export interface VenuePlace extends LatLng {
  name: string;
  areaM2?: number;
  estimated?: boolean;
}
export interface VenueHotel extends LatLng {
  name: string;
  rooms?: number;
  occupied?: number;
  price?: number;
}
export interface VenueSplit {
  rail: number;
  road: number;
  selfDrive: number;
  hotel: number;
}

export interface VenueSpec {
  id: string;
  name: string;
  city: string;
  venueLabel: string;
  capacity: number;
  center: LatLng;
  /** minutes after midnight for tick 0 */
  t0Min: number;
  /** minutes after midnight */
  gatesOpenMin: number;
  /** minutes after midnight */
  showMin: number;
  gates: VenueGate[];
  stations: VenueStation[];
  parking: VenuePlace[];
  hotels: VenueHotel[];
  dropoffs?: VenuePlace[];
  /** shares of capacity (normalised) */
  split?: VenueSplit;
  /** what was guessed — shown in "How this works" */
  notes?: string[];
}

export const DEFAULT_SPLIT: VenueSplit = { rail: 0.45, road: 0.2, selfDrive: 0.2, hotel: 0.15 };
export const VENUE_DEFAULTS = {
  gateLanes: 8,
  gateAreaM2: 400,
  plazaM2: 2000,
  plazaOffsetM: 60,
  stationM2: 2500,
  parkingM2: 6000,
  dropoffM2: 1500,
  walkLimitM: 1800,
  walkSpeed: 75, // m/min
  roadSpeed: 350, // m/min
  detour: 1.25, // street distance ÷ straight-line distance
  walkWidthM: 6,
  walkAreaMin: 600,
  walkAreaMax: 4500,
  roadCap: 400,
  concourseCap: 900,
  concourseFF: 3,
  concourseM2: 3000,
  perimeterCap: 300,
  perimeterWidthM: 4,
  hotelRooms: 120,
  maxHotelClusters: 4,
  laneRate: 28,
};

// ---------- geometry ----------
const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
export function distM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat),
    dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return Math.atan2(y, x);
}
export function offset(p: LatLng, brg: number, m: number): LatLng {
  const d = m / R;
  const la = rad(p.lat),
    lo = rad(p.lng);
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(brg));
  const lo2 = lo + Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return { lat: +deg(la2).toFixed(6), lng: +deg(lo2).toFixed(6) };
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24) || 'x';

// ---------- language by city ----------
type Role = 'rail' | 'bus' | 'cab' | 'self' | 'hotel' | 'late';
function langFor(city: string, role: Role): Lang {
  const c = city.toLowerCase();
  if (/mumbai|pune|panvel|thane|nagpur|nashik|kolhapur|navi/.test(c))
    return role === 'rail' || role === 'bus' ? 'mr' : role === 'hotel' || role === 'late' ? 'hi' : 'en';
  if (/delhi|ahmedabad|gandhinagar|jaipur|lucknow|kanpur|noida|gurgaon|gurugram|indore|bhopal|surat/.test(c))
    return role === 'cab' || role === 'self' ? 'en' : 'hi';
  return 'en';
}

// ---------- hotel clustering (deterministic agglomerative) ----------
interface HotelCluster extends LatLng {
  members: VenueHotel[];
  rooms: number;
  occupied: number;
  price: number;
  estimated: boolean;
}
function clusterHotels(spec: VenueSpec): HotelCluster[] {
  const D = VENUE_DEFAULTS;
  let cl: HotelCluster[] = spec.hotels.map((h) => {
    const far = distM(h, spec.center) > 3000;
    const rooms = h.rooms ?? D.hotelRooms;
    // assumption: on an event night the hotels near the venue fill first
    const occupied = h.occupied ?? Math.round(rooms * (far ? 0.6 : 0.95));
    const price = h.price ?? (far ? 4000 : 6500);
    return { lat: h.lat, lng: h.lng, members: [h], rooms, occupied, price, estimated: h.rooms == null || h.occupied == null || h.price == null };
  });
  const merge = (a: HotelCluster, b: HotelCluster): HotelCluster => {
    const wa = a.rooms || 1,
      wb = b.rooms || 1;
    return {
      lat: (a.lat * wa + b.lat * wb) / (wa + wb),
      lng: (a.lng * wa + b.lng * wb) / (wa + wb),
      members: a.members.concat(b.members),
      rooms: a.rooms + b.rooms,
      occupied: a.occupied + b.occupied,
      price: Math.round((a.price * wa + b.price * wb) / (wa + wb)),
      estimated: true,
    };
  };
  for (;;) {
    if (cl.length < 2) break;
    let bi = 0,
      bj = 1,
      bd = Infinity;
    for (let i = 0; i < cl.length; i++)
      for (let j = i + 1; j < cl.length; j++) {
        const d = distM(cl[i], cl[j]);
        if (d < bd) {
          bd = d;
          bi = i;
          bj = j;
        }
      }
    if (cl.length <= D.maxHotelClusters && bd > 1200) break;
    const m = merge(cl[bi], cl[bj]);
    cl = cl.filter((_, k) => k !== bi && k !== bj);
    cl.splice(bi, 0, m);
  }
  return cl;
}

/** split `total` into integer parts proportional to `weights`, summing exactly to total */
function apportion(total: number, weights: number[]): number[] {
  const W = weights.reduce((a, b) => a + b, 0);
  if (!weights.length || W <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / W);
  const out = raw.map(Math.floor);
  let rest = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) out[order[k][1]]++;
  return out;
}

const PULSE_OFFSETS = [0, 3, 1, 4, 2, 5];

export function buildVenueScenario(spec: VenueSpec): Scenario {
  const D = VENUE_DEFAULTS;
  if (!spec.gates.length) throw new Error('buildVenueScenario: a venue needs at least one gate');
  const id = spec.id === 'dyPatil' ? 'dyPatil_import' : spec.id;
  const t0 = spec.t0Min;
  const showTick = spec.showMin - t0;
  const gatesOpenTick = Math.max(0, spec.gatesOpenMin - t0);
  const horizon = spec.showMin + 90 - t0;
  const C = spec.center;

  const zones: Zone[] = [];
  const links: Link[] = [];
  const usedIds = new Set<string>();
  const uid = (base: string) => {
    let s = base,
      k = 2;
    while (usedIds.has(s)) s = base + '_' + k++;
    usedIds.add(s);
    return s;
  };
  let ln = 0;
  const addLink = (l: Omit<Link, 'id'>): Link => {
    const link = { id: 'V' + ++ln, ...l, estimated: true } as Link;
    links.push(link);
    return link;
  };
  const walkArea = (lenM: number, width = D.walkWidthM) => Math.round(Math.min(D.walkAreaMax, Math.max(D.walkAreaMin, lenM * width)) / 50) * 50;

  // ---- venue ----
  const venueId = uid('venue');
  zones.push({ id: venueId, name: spec.venueLabel, type: 'venue', lat: C.lat, lng: C.lng, areaM2: Math.round(spec.capacity * 0.5), capacity: spec.capacity, estimated: true });

  // ---- gates + plazas, ordered around the venue by bearing (for the perimeter ring) ----
  interface GP {
    gate: Zone;
    plaza: Zone;
    brg: number;
    gateLink: Link;
  }
  const gps: GP[] = spec.gates.map((g, i) => {
    const gd = distM(C, g);
    const brg = gd > 5 ? bearing(C, g) : (2 * Math.PI * i) / spec.gates.length;
    const p = offset(g, brg, D.plazaOffsetM);
    const gid = uid(g.id ? slug(g.id) : 'gate' + (i + 1));
    const gate: Zone = { id: gid, name: g.name, type: 'gate', lat: g.lat, lng: g.lng, areaM2: D.gateAreaM2, lanes: g.lanes ?? D.gateLanes, estimated: true };
    const plaza: Zone = { id: uid('pz_' + gid), name: g.name + ' forecourt', type: 'plaza', lat: p.lat, lng: p.lng, areaM2: g.plazaM2 ?? D.plazaM2, estimated: true };
    zones.push(gate, plaza);
    return { gate, plaza, brg, gateLink: null as unknown as Link };
  });
  for (const gp of gps) {
    gp.gateLink = addLink({ from: gp.plaza.id, to: gp.gate.id, name: gp.gate.name + ' screening', mode: 'gate', gate: gp.gate.id });
    addLink({ from: gp.gate.id, to: venueId, name: gp.gate.name + ' concourse', mode: 'walk', cap: D.concourseCap, ff: D.concourseFF, areaM2: D.concourseM2 });
  }
  const concourse = (gp: GP) => links.find((l) => l.from === gp.gate.id && l.to === venueId)!;

  // perimeter ring between adjacent plazas (both directions)
  const ring = [...gps].sort((a, b) => a.brg - b.brg);
  const perim: Record<string, Link> = {};
  const pairKey = (a: string, b: string) => a + '>' + b;
  const addPerim = (a: GP, b: GP) => {
    if (perim[pairKey(a.plaza.id, b.plaza.id)]) return;
    const len = distM(a.plaza, b.plaza) * 1.2; // walks round the stands, not through them
    const mk = (x: GP, y: GP) =>
      (perim[pairKey(x.plaza.id, y.plaza.id)] = addLink({
        from: x.plaza.id,
        to: y.plaza.id,
        name: 'Perimeter path, ' + x.gate.name + ' to ' + y.gate.name,
        mode: 'walk',
        cap: D.perimeterCap,
        ff: Math.max(2, Math.round(len / D.walkSpeed)),
        areaM2: walkArea(len, D.perimeterWidthM),
      }));
    mk(a, b);
    mk(b, a);
  };
  if (ring.length === 2) addPerim(ring[0], ring[1]);
  else if (ring.length > 2) for (let i = 0; i < ring.length; i++) addPerim(ring[i], ring[(i + 1) % ring.length]);

  // ---- origins ----
  interface Origin {
    zone: Zone;
    role: Role;
    weight: number;
    walkCap: number;
  }
  const origins: Origin[] = [];
  const addOrigin = (name: string, type: Zone['type'], p: LatLng, areaM2: number | undefined, role: Role, weight: number, walkCap: number, est: boolean, extra: Partial<Zone> = {}, idBase?: string) => {
    const zone: Zone = { id: uid(idBase ?? slug(name)), name, type, lat: p.lat, lng: p.lng, ...(areaM2 != null ? { areaM2 } : {}), ...extra, ...(est ? { estimated: true } : {}) };
    zones.push(zone);
    const o = { zone, role, weight, walkCap };
    origins.push(o);
    return o;
  };
  const railStations = spec.stations.filter((s) => s.kind !== 'bus');
  const busStations = spec.stations.filter((s) => s.kind === 'bus');
  for (const s of railStations)
    addOrigin(s.name, 'transit', s, s.areaM2 ?? D.stationM2, 'rail', s.weight ?? 1, s.kind === 'rail' ? 520 : 460, s.areaM2 == null || !!s.estimated);
  for (const s of busStations) addOrigin(s.name, 'transit', s, s.areaM2 ?? D.stationM2, 'bus', s.weight ?? 1, 420, s.areaM2 == null || !!s.estimated);
  for (const d of spec.dropoffs || []) addOrigin(d.name, 'transit', d, d.areaM2 ?? D.dropoffM2, 'cab', 1, 400, d.areaM2 == null || !!d.estimated);
  for (const p of spec.parking) addOrigin(p.name, 'parking', p, p.areaM2 ?? D.parkingM2, 'self', 1, 480, p.areaM2 == null || !!p.estimated);
  // cabs need somewhere to drop people; if the spec has no drop-off or bus stand, make one
  if (!origins.some((o) => o.role === 'cab' || o.role === 'bus')) {
    const g = ring[0];
    addOrigin('Cab drop-off (estimated)', 'transit', offset(C, g.brg, distM(C, g.gate) + 300), D.dropoffM2, 'cab', 1, 400, true);
  }
  const clusters = clusterHotels(spec);
  clusters.forEach((h) => {
    const lead = [...h.members].sort((a, b) => (b.rooms ?? D.hotelRooms) - (a.rooms ?? D.hotelRooms) || a.name.localeCompare(b.name))[0];
    const name = h.members.length > 1 ? lead.name + ' area hotels' : lead.name;
    return addOrigin(name, 'hotel', h, undefined, 'hotel', h.occupied, 400, h.estimated, { rooms: h.rooms, occupied: h.occupied, price: h.price }, 'htl_' + slug(lead.name));
  });

  // each origin → its nearest plaza
  const byDist = (p: LatLng) => [...gps].sort((a, b) => distM(p, a.plaza) - distM(p, b.plaza));
  const originLink = new Map<Origin, { link: Link; gp: GP }>();
  for (const o of origins) {
    const gp = byDist(o.zone)[0];
    const crow = distM(o.zone, gp.plaza);
    const route = crow * D.detour;
    const walk = crow < D.walkLimitM;
    const link = walk
      ? addLink({ from: o.zone.id, to: gp.plaza.id, name: o.zone.name + ' to ' + gp.plaza.name, mode: 'walk', cap: o.walkCap, ff: Math.max(1, Math.round(route / D.walkSpeed)), areaM2: walkArea(route) })
      : addLink({ from: o.zone.id, to: gp.plaza.id, name: o.zone.name + ' road to ' + gp.plaza.name, mode: 'road', cap: D.roadCap, ff: Math.max(2, Math.round(route / D.roadSpeed)) });
    originLink.set(o, { link, gp });
  }

  /** cohort means are departure times from the origin: people leave early enough to cover the trip */
  const tripFF = (o: Origin) => originLink.get(o)!.link.ff!;
  const pathVia = (o: Origin) => {
    const { link, gp } = originLink.get(o)!;
    return [link.id, gp.gateLink.id, concourse(gp).id];
  };
  const altVia = (o: Origin): { alt: string[]; altExtraMin: number } | null => {
    const { link, gp } = originLink.get(o)!;
    const nbrs = gps.filter((x) => x !== gp && perim[pairKey(gp.plaza.id, x.plaza.id)]);
    if (!nbrs.length) return null;
    const second = nbrs.sort((a, b) => distM(o.zone, a.plaza) - distM(o.zone, b.plaza))[0];
    const p = perim[pairKey(gp.plaza.id, second.plaza.id)];
    return { alt: [link.id, p.id, second.gateLink.id, concourse(second).id], altExtraMin: p.ff! };
  };

  // ---- cohorts from the split ----
  const split = spec.split || DEFAULT_SPLIT;
  const sTot = split.rail + split.road + split.selfDrive + split.hotel;
  let rail = split.rail / sTot,
    road = split.road / sTot,
    self = split.selfDrive / sTot,
    hotel = split.hotel / sTot;
  const oRail = origins.filter((o) => o.role === 'rail');
  const oRoad = origins.filter((o) => o.role === 'cab' || o.role === 'bus');
  const oSelf = origins.filter((o) => o.role === 'self');
  const oHotel = origins.filter((o) => o.role === 'hotel');
  if (!oRail.length) (road += rail), (rail = 0);
  if (!oSelf.length) (road += self), (self = 0);
  if (!oHotel.length) (road += hotel), (hotel = 0);

  // late bookings: people with no room nearby, while a far cluster has empty rooms
  let lateBookings = 0;
  let emptiest: Origin | null = null;
  if (oHotel.length) {
    emptiest = [...oHotel].sort((a, b) => b.zone.rooms! - b.zone.occupied! - (a.zone.rooms! - a.zone.occupied!))[0];
    const free = emptiest.zone.rooms! - emptiest.zone.occupied!;
    if (free >= 50) lateBookings = Math.round(Math.min(spec.capacity * 0.02, free * 2) / 10) * 10;
    if (lateBookings < 50) lateBookings = 0;
  }

  const groups = apportion(spec.capacity - lateBookings, [rail, road, self, hotel]);
  const cohorts: Cohort[] = [];
  const S = showTick;
  const lang = (r: Role) => langFor(spec.city, r);
  const withAlt = (c: Cohort, o: Origin): Cohort => {
    const a = altVia(o);
    return a ? { ...c, alt: a.alt, altExtraMin: a.altExtraMin } : c;
  };
  apportion(groups[0], oRail.map((o) => o.weight)).forEach((n, i) => {
    const o = oRail[i];
    const kind = railStations[i].kind;
    cohorts.push(
      withAlt(
        { id: uid(slug(o.zone.name) + '_rail'), label: (kind === 'metro' ? 'Metro arrivals at ' : 'Train arrivals at ') + o.zone.name, size: n, mean: S - 30 - (i % 2) * 6 - tripFF(o), std: 30 + (i % 3) * 3, ps: kind === 'metro' ? 0.66 : 0.7, lang: lang('rail'), pulse: { period: 6, width: 2, offset: PULSE_OFFSETS[i % 6] }, path: pathVia(o) },
        o,
      ),
    );
  });
  apportion(groups[1], oRoad.map(() => 1)).forEach((n, i) => {
    const o = oRoad[i];
    const bus = o.role === 'bus';
    cohorts.push(
      withAlt(
        { id: uid((bus ? 'bus_' : 'cab_') + slug(o.zone.name)), label: (bus ? 'Bus arrivals at ' : 'Cab arrivals at ') + o.zone.name, size: n, mean: S - (bus ? 35 : 25) - (i % 2) * 5 - tripFF(o), std: bus ? 34 : 26, ps: bus ? 0.5 : 0.34, lang: lang(bus ? 'bus' : 'cab'), path: pathVia(o) },
        o,
      ),
    );
  });
  apportion(groups[2], oSelf.map(() => 1)).forEach((n, i) => {
    const o = oSelf[i];
    cohorts.push(withAlt({ id: uid('drive_' + slug(o.zone.name)), label: 'Drivers parking at ' + o.zone.name, size: n, mean: S - 55 + (i % 2) * 6 - tripFF(o), std: 44, ps: 0.3, lang: lang('self'), path: pathVia(o) }, o));
  });
  apportion(groups[3], oHotel.map((o) => o.zone.occupied!)).forEach((n, i) => {
    const o = oHotel[i];
    cohorts.push(withAlt({ id: uid('guests_' + slug(o.zone.name)), label: 'Guests from ' + o.zone.name, size: n, mean: S - 45 + ((i * 7) % 16) - tripFF(o), std: 36 + (i % 3) * 3, ps: 0.45, lang: lang('hotel'), path: pathVia(o) }, o));
  });
  if (lateBookings && emptiest) {
    const cab = oRoad.find((o) => o.role === 'cab') || oRoad[0];
    const late: Cohort = withAlt({ id: uid('late_book'), label: 'Late bookings, no room nearby', size: lateBookings, mean: S - 16 - tripFF(cab), std: 20, ps: 0.5, lang: lang('late'), path: pathVia(cab), housed: pathVia(emptiest) }, cab);
    cohorts.push(late);
  }
  // drop empty cohorts (tiny venues with many origins)
  const live = cohorts.filter((c) => c.size > 0);

  const clock = (m: number) => clockFor({ t0Min: 0 }, m);
  return {
    id,
    name: spec.name,
    sub: comma(spec.capacity) + ' capacity · gates ' + clock(spec.gatesOpenMin) + ' · show ' + clock(spec.showMin) + ' · estimated graph',
    venueLabel: spec.venueLabel,
    t0Min: t0,
    horizon,
    gatesOpenTick,
    showStartTick: showTick,
    laneRate: D.laneRate,
    lateBookings,
    mapZones: zones.filter((z) => z.type !== 'hotel' && z.type !== 'food').map((z) => z.id),
    zones,
    links,
    cohorts: live,
  };
}
