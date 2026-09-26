/*
 * LOADER (SOURCE_OF_TRUTH-adjacent, added for the "bring your own event" build): turns an event
 * head's own rows (event/gates/tickets/arrivals/hotels/resources) into a simulate()-able Scenario.
 *
 * Pure TS, no fs/DOM — callers parse CSV text with `engine/csv.ts` (or a form) and pass plain rows.
 * Every zone/link/cohort this file invents from a default (as opposed to a value present in a row)
 * carries `estimated: true`, mirroring `engine/venueImport/buildGraph.ts`'s convention. The existing
 * `dyPatil` scenario is untouched; this is a separate, additive path.
 */
import { VENUE_DEFAULTS, bearing, distM, offset, slug, type LatLng } from './venueImport/buildGraph';
import { clockFor, comma } from './format';
import type { Cohort, Lang, Link, Scenario, Zone } from './types';

export type DataStatus = 'real' | 'estimated' | 'invented' | 'playbook';
const STATUSES = new Set<DataStatus>(['real', 'estimated', 'invented', 'playbook']);

export interface EventRow {
  name: string;
  date: string;
  gates_open: string;
  match_start: string;
  capacity: string;
  expected_turnout_pct: string;
  venue_lat: string;
  venue_lng: string;
  status: string;
  source_note: string;
}
export interface GateRow {
  gate_id: string;
  name: string;
  side: string;
  lanes: string;
  forecourt_area_m2: string;
  stands_served: string;
  vip_gate: string;
  accessible_lane: string;
  status: string;
  source_note: string;
}
export interface TicketRow {
  snapshot_label: string;
  snapshot_date: string;
  stand: string;
  gate_id: string;
  category: string;
  tickets_sold: string;
  days_before_match: string;
  alt_gates: string;
  status: string;
  source_note: string;
}
export interface ArrivalRow {
  group: string;
  size: string;
  share_pct: string;
  mode: string;
  origin: string;
  preferred_gate: string;
  ticket_gate: string;
  mean_arrival_time: string;
  spread_min: string;
  pulse_period_min: string;
  status: string;
  source_note: string;
}
export interface HotelRow {
  cluster: string;
  name: string;
  rooms_total: string;
  rooms_booked: string;
  distance_km: string;
  price_inr: string;
  coach_available: string;
  status: string;
  source_note: string;
}
export interface ResourceRow {
  resource: string;
  quantity: string;
  cost_inr: string;
  unit: string;
  notes: string;
  status: string;
  source_note: string;
}

export interface CsvScenarioInput {
  event: EventRow[];
  gates: GateRow[];
  tickets: TicketRow[];
  arrivals: ArrivalRow[];
  hotels: HotelRow[];
  resources: ResourceRow[];
}

export interface DataField {
  file: string;
  row: string;
  tag: DataStatus;
  sourceNote?: string;
}

export interface Confidence {
  real: number;
  estimated: number;
  invented: number;
  playbook: number;
  total: number;
  level: 'low' | 'medium' | 'high';
}

export function computeConfidence(fields: DataField[]): Confidence {
  const c: Confidence = { real: 0, estimated: 0, invented: 0, playbook: 0, total: fields.length, level: 'low' };
  for (const f of fields) c[f.tag]++;
  const solid = (c.real + c.estimated) / Math.max(1, c.total);
  const realFrac = c.real / Math.max(1, c.total);
  c.level = realFrac >= 0.5 ? 'high' : solid >= 0.5 ? 'medium' : 'low';
  return c;
}

export interface LoadedScenario {
  scenario: Scenario;
  fields: DataField[];
  resources: ResourceRow[];
  confidence: Confidence;
}
export type LoadResult = { ok: true; data: LoadedScenario } | { ok: false; errors: string[] };

export interface LoadOpts {
  /** which tickets.csv snapshot to rebuild cohort sizes from; defaults to the one closest to match day */
  snapshot?: string;
  /** the venue's display name — event.csv has no venue-name column, so the caller (Quick Start form) supplies it */
  venueLabel?: string;
}

const num = (s: string): number | null => {
  const n = Number(String(s ?? '').replace(/[,₹%]/g, '').trim());
  return Number.isFinite(n) ? n : null;
};
const parseHM = (s: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s ?? '').trim());
  if (!m) return null;
  const h = +m[1],
    mi = +m[2];
  if (h > 47 || mi > 59) return null;
  return h * 60 + mi;
};
const tag = (s: string): DataStatus => (STATUSES.has(String(s ?? '').trim().toLowerCase() as DataStatus) ? (String(s).trim().toLowerCase() as DataStatus) : 'estimated');
const SIDE_DEG: Record<string, number> = { north: 0, northeast: 45, ne: 45, east: 90, southeast: 135, se: 135, south: 180, southwest: 225, sw: 225, west: 270, northwest: 315, nw: 315 };

/** Plain-language validation. Every message is safe to show an event head verbatim. */
export function validateCsvInput(input: CsvScenarioInput): string[] {
  const errors: string[] = [];
  const { event, gates, tickets, arrivals, hotels } = input;

  if (event.length !== 1) errors.push(`event.csv must contain exactly one row (found ${event.length}).`);
  const ev = event[0];
  if (ev) {
    if (!ev.name?.trim()) errors.push('event.csv: "name" is empty.');
    if (num(ev.capacity) == null || num(ev.capacity)! <= 0) errors.push(`event.csv: "capacity" must be a positive number, got "${ev.capacity}".`);
    if (parseHM(ev.gates_open) == null) errors.push(`event.csv: "gates_open" must be HH:MM, got "${ev.gates_open}".`);
    if (parseHM(ev.match_start) == null) errors.push(`event.csv: "match_start" must be HH:MM, got "${ev.match_start}".`);
    if (parseHM(ev.gates_open) != null && parseHM(ev.match_start) != null && parseHM(ev.gates_open)! >= parseHM(ev.match_start)!)
      errors.push('event.csv: "gates_open" must be before "match_start".');
    if (num(ev.venue_lat) == null || num(ev.venue_lng) == null) errors.push('event.csv: "venue_lat"/"venue_lng" must be numbers.');
  }

  if (!gates.length) errors.push('gates.csv has no rows — at least one gate is needed.');
  const gateIds = new Set<string>();
  for (const g of gates) {
    if (!g.gate_id?.trim()) {
      errors.push('gates.csv: a row has an empty gate_id.');
      continue;
    }
    if (gateIds.has(g.gate_id)) errors.push(`gates.csv: duplicate gate_id "${g.gate_id}".`);
    gateIds.add(g.gate_id);
    if (num(g.lanes) == null || num(g.lanes)! <= 0) errors.push(`gates.csv: Gate ${g.gate_id} has an invalid "lanes" value ("${g.lanes}").`);
    if (num(g.forecourt_area_m2) == null || num(g.forecourt_area_m2)! <= 0) errors.push(`gates.csv: Gate ${g.gate_id} has an invalid "forecourt_area_m2" value ("${g.forecourt_area_m2}").`);
  }

  for (const t of tickets) {
    if (t.gate_id && !gateIds.has(t.gate_id)) errors.push(`Gate ${t.gate_id} in tickets.csv is not in gates.csv.`);
    for (const alt of (t.alt_gates || '').split(';').map((s) => s.trim()).filter(Boolean))
      if (!gateIds.has(alt)) errors.push(`Gate ${alt} in tickets.csv alt_gates is not in gates.csv.`);
    if (num(t.tickets_sold) == null || num(t.tickets_sold)! < 0) errors.push(`tickets.csv: row for ${t.stand || t.gate_id} has an invalid "tickets_sold" value ("${t.tickets_sold}").`);
  }

  if (!arrivals.length) errors.push('arrivals.csv has no rows — at least one arrival group is needed.');
  for (const a of arrivals) {
    if (a.ticket_gate && !gateIds.has(a.ticket_gate)) errors.push(`Gate ${a.ticket_gate} in arrivals.csv is not in gates.csv.`);
    if (a.preferred_gate && !gateIds.has(a.preferred_gate)) errors.push(`Gate ${a.preferred_gate} in arrivals.csv is not in gates.csv.`);
    if (num(a.size) == null || num(a.size)! <= 0) errors.push(`arrivals.csv: group "${a.group}" has an invalid "size" value ("${a.size}").`);
    if (parseHM(a.mean_arrival_time) == null) errors.push(`arrivals.csv: group "${a.group}" has an invalid "mean_arrival_time" ("${a.mean_arrival_time}"), expected HH:MM.`);
  }

  // ticket totals vs arrivals, per gate, at the snapshot closest to match day
  if (!errors.length && tickets.length && arrivals.length) {
    const finalSnap = pickFinalSnapshot(tickets);
    if (finalSnap) {
      const soldByGate = new Map<string, number>();
      for (const t of tickets) if (t.snapshot_label === finalSnap) soldByGate.set(t.gate_id, (soldByGate.get(t.gate_id) ?? 0) + (num(t.tickets_sold) ?? 0));
      const arrivedByGate = new Map<string, number>();
      for (const a of arrivals) arrivedByGate.set(a.ticket_gate, (arrivedByGate.get(a.ticket_gate) ?? 0) + (num(a.size) ?? 0));
      for (const [gate, sold] of soldByGate) {
        const arrived = arrivedByGate.get(gate) ?? 0;
        const tol = Math.max(20, sold * 0.05);
        if (Math.abs(arrived - sold) > tol)
          errors.push(`Ticket total for Gate ${gate} in tickets.csv (${Math.round(sold)} sold at ${finalSnap}) doesn't match arrivals.csv (${Math.round(arrived)} arriving via that gate).`);
      }
    }
  }

  return errors;
}

function pickFinalSnapshot(tickets: TicketRow[]): string | null {
  let best: TicketRow | null = null;
  for (const t of tickets) {
    const d = num(t.days_before_match);
    if (d == null) continue;
    if (!best || d < num(best.days_before_match)!) best = t;
  }
  return best?.snapshot_label ?? tickets[0]?.snapshot_label ?? null;
}

function fields(input: CsvScenarioInput): DataField[] {
  const out: DataField[] = [];
  const push = (file: string, row: string, status: string, note: string) => out.push({ file, row, tag: tag(status), sourceNote: note || undefined });
  input.event.forEach((r) => push('event.csv', r.name || 'event', r.status, r.source_note));
  input.gates.forEach((r) => push('gates.csv', r.name || r.gate_id, r.status, r.source_note));
  input.tickets.forEach((r) => push('tickets.csv', `${r.snapshot_label} · ${r.stand}`, r.status, r.source_note));
  input.arrivals.forEach((r) => push('arrivals.csv', r.group, r.status, r.source_note));
  input.hotels.forEach((r) => push('hotels.csv', r.name || r.cluster, r.status, r.source_note));
  input.resources.forEach((r) => push('resources.csv', r.resource, r.status, r.source_note));
  return out;
}

/** default free-flow minutes for a mode with no distance data — documented estimates, tagged in the field list */
const MODE_FF: Record<string, number> = { rail: 8, metro: 8, cab: 5, shuttle: 6, car: 7, coach: 10, bus: 6, mixed: 6 };

export function loadScenarioFromRows(input: CsvScenarioInput, opts: LoadOpts = {}): LoadResult {
  const errors = validateCsvInput(input);
  if (errors.length) return { ok: false, errors };

  const ev = input.event[0];
  const C: LatLng = { lat: num(ev.venue_lat)!, lng: num(ev.venue_lng)! };
  const t0 = parseHM(ev.gates_open)! - 120;
  const gatesOpenTick = 120;
  const showTick = parseHM(ev.match_start)! - t0;
  const horizon = showTick + 210;
  const D = VENUE_DEFAULTS;

  const zones: Zone[] = [];
  const links: Link[] = [];
  const used = new Set<string>();
  const uid = (base: string) => {
    let s = slug(base),
      k = 2;
    while (used.has(s)) s = slug(base) + '_' + k++;
    used.add(s);
    return s;
  };
  let ln = 0;
  const addLink = (l: Omit<Link, 'id'>, estimated: boolean): Link => {
    const link = { id: 'D' + ++ln, ...l, ...(estimated ? { estimated: true as const } : {}) } as Link;
    links.push(link);
    return link;
  };

  const venueId = uid('venue');
  const capacity = input.arrivals.reduce((a, r) => a + (num(r.size) ?? 0), 0);
  zones.push({ id: venueId, name: opts.venueLabel || ev.name, type: 'venue', lat: C.lat, lng: C.lng, areaM2: Math.round(capacity * 0.5), capacity, estimated: true });

  interface GateBuilt {
    id: string;
    plazaId: string;
    gateLinkId: string;
    concourseId: string;
    altIds: string[];
  }
  const gatesById = new Map<string, GateBuilt>();
  for (const g of input.gates) {
    const brg = ((SIDE_DEG[g.side?.trim().toLowerCase()] ?? 0) * Math.PI) / 180;
    const gatePos = offset(C, brg, 250);
    const plazaPos = offset(C, brg, 250 + D.plazaOffsetM);
    const gid = uid(g.gate_id);
    const gateEstimated = num(g.forecourt_area_m2) == null; // position is always synthesised, so mark it, but don't double-count real lane/area data
    zones.push({ id: gid, name: g.name || g.gate_id, type: 'gate', lat: gatePos.lat, lng: gatePos.lng, areaM2: D.gateAreaM2, lanes: num(g.lanes) ?? D.gateLanes, estimated: true });
    const pid = uid('pz_' + gid);
    zones.push({ id: pid, name: (g.name || g.gate_id) + ' forecourt', type: 'plaza', lat: plazaPos.lat, lng: plazaPos.lng, areaM2: num(g.forecourt_area_m2) ?? D.plazaM2, estimated: gateEstimated });
    const gateLink = addLink({ from: pid, to: gid, name: (g.name || g.gate_id) + ' screening', mode: 'gate', gate: gid }, true);
    const concourse = addLink({ from: gid, to: venueId, name: (g.name || g.gate_id) + ' concourse', mode: 'walk', cap: D.concourseCap, ff: D.concourseFF, areaM2: D.concourseM2 }, true);
    gatesById.set(g.gate_id, { id: gid, plazaId: pid, gateLinkId: gateLink.id, concourseId: concourse.id, altIds: [] });
  }
  // alt_gates from tickets.csv, per gate_id (first occurrence wins — verified consistent per gate in validation-passed data)
  for (const t of input.tickets) {
    const gb = gatesById.get(t.gate_id);
    if (!gb || gb.altIds.length) continue;
    gb.altIds = (t.alt_gates || '').split(';').map((s) => s.trim()).filter((id) => gatesById.has(id));
  }
  const perim = new Map<string, Link>();
  const perimLink = (fromGate: string, toGate: string): Link => {
    const key = fromGate + '>' + toGate;
    let l = perim.get(key);
    if (!l) {
      const a = gatesById.get(fromGate)!,
        b = gatesById.get(toGate)!;
      l = addLink({ from: a.plazaId, to: b.plazaId, name: 'Perimeter path, ' + fromGate + ' to ' + toGate, mode: 'walk', cap: D.perimeterCap, ff: 8, areaM2: 1500 }, true);
      perim.set(key, l);
    }
    return l;
  };

  // hotel clusters, aggregated from hotels.csv
  interface HotelCluster {
    cluster: string;
    rooms: number;
    occupied: number;
    price: number;
    distanceKm: number;
  }
  const clusters = new Map<string, HotelCluster>();
  for (const h of input.hotels) {
    const rooms = num(h.rooms_total) ?? 0;
    const booked = num(h.rooms_booked) ?? 0;
    const price = num(h.price_inr) ?? 0;
    const dist = num(h.distance_km) ?? 5;
    const c = clusters.get(h.cluster) ?? { cluster: h.cluster, rooms: 0, occupied: 0, price: 0, distanceKm: dist };
    c.price = c.rooms + rooms > 0 ? (c.price * c.rooms + price * rooms) / (c.rooms + rooms) : price;
    c.rooms += rooms;
    c.occupied += booked;
    c.distanceKm = dist; // hotels within a cluster share one approximate distance in this schema
    clusters.set(h.cluster, c);
  }
  const findCluster = (origin: string): HotelCluster | undefined => {
    const o = origin.trim().toLowerCase();
    for (const c of clusters.values()) {
      const cl = c.cluster.toLowerCase();
      if (o === cl || o.includes(cl) || cl.includes(o)) return c;
    }
    return undefined;
  };

  // snapshot scaling: rebuild sizes as of an earlier snapshot (Step 7 timeline support)
  const finalSnap = pickFinalSnapshot(input.tickets);
  const targetSnap = opts.snapshot && input.tickets.some((t) => t.snapshot_label === opts.snapshot) ? opts.snapshot : finalSnap;
  const gateTotalAt = (snap: string | null) => {
    const m = new Map<string, number>();
    if (!snap) return m;
    for (const t of input.tickets) if (t.snapshot_label === snap) m.set(t.gate_id, (m.get(t.gate_id) ?? 0) + (num(t.tickets_sold) ?? 0));
    return m;
  };
  const finalTotals = gateTotalAt(finalSnap);
  const targetTotals = gateTotalAt(targetSnap);
  const scaleFor = (gateId: string) => {
    if (!targetSnap || targetSnap === finalSnap) return 1;
    const base = finalTotals.get(gateId);
    const tgt = targetTotals.get(gateId);
    if (!base) return 1;
    return (tgt ?? 0) / base;
  };

  const PULSE_OFFSETS = [0, 3, 1, 4, 2, 5];
  const cohorts: Cohort[] = [];
  input.arrivals.forEach((a, i) => {
    const gb = gatesById.get(a.ticket_gate);
    if (!gb) return;
    const mode = a.mode.trim().toLowerCase();
    const cluster = findCluster(a.origin);
    const originType: Zone['type'] = cluster ? 'hotel' : mode === 'car' ? 'parking' : 'transit';
    const originBrg = ((SIDE_DEG[input.gates.find((g) => g.gate_id === a.ticket_gate)?.side?.trim().toLowerCase() ?? ''] ?? 0) * Math.PI) / 180;
    const originDistM = cluster ? cluster.distanceKm * 1000 : 1500;
    const originPos = offset(C, originBrg, 250 + D.plazaOffsetM + originDistM);
    const originId = uid((cluster ? 'htl_' : mode + '_') + a.origin);
    const tripFF = cluster ? Math.max(2, Math.round((cluster.distanceKm * 1000 * D.detour) / D.roadSpeed)) : MODE_FF[mode] ?? 6;
    const linkMode: Link['mode'] = cluster ? 'road' : 'walk';
    zones.push({
      id: originId,
      name: a.origin,
      type: originType,
      lat: originPos.lat,
      lng: originPos.lng,
      ...(originType === 'hotel' ? { rooms: cluster!.rooms, occupied: cluster!.occupied, price: Math.round(cluster!.price) } : { areaM2: 2200 }),
      estimated: true,
    });
    const originLink = addLink(
      linkMode === 'road'
        ? { from: originId, to: gb.plazaId, name: a.origin + ' road to ' + (a.preferred_gate || a.ticket_gate), mode: 'road', cap: D.roadCap, ff: tripFF }
        : { from: originId, to: gb.plazaId, name: a.origin + ' to ' + (a.preferred_gate || a.ticket_gate), mode: 'walk', cap: 450, ff: tripFF, areaM2: 2200 },
      true,
    );
    const path = [originLink.id, gb.gateLinkId, gb.concourseId];
    let alt: string[] | undefined;
    let altExtraMin: number | undefined;
    if (gb.altIds.length) {
      const altGate = gatesById.get(gb.altIds[0])!;
      const p = perimLink(a.ticket_gate, gb.altIds[0]);
      alt = [originLink.id, p.id, altGate.gateLinkId, altGate.concourseId];
      altExtraMin = p.ff;
    }
    const scale = scaleFor(a.ticket_gate);
    const size = Math.max(0, Math.round((num(a.size) ?? 0) * scale));
    if (!size) return;
    const cohort: Cohort = {
      id: uid(a.group || 'group_' + i),
      label: a.group,
      size,
      mean: (parseHM(a.mean_arrival_time) ?? showTick + t0) - t0 - tripFF - D.concourseFF,
      std: num(a.spread_min) ?? 30,
      ps: mode === 'car' ? 0.3 : mode === 'rail' || mode === 'metro' ? 0.7 : 0.4,
      lang: 'en',
      path,
      ...(alt ? { alt, altExtraMin } : {}),
      ...(num(a.pulse_period_min) ? { pulse: { period: num(a.pulse_period_min)!, width: 2, offset: PULSE_OFFSETS[i % 6] } } : {}),
    };
    cohorts.push(cohort);
  });

  const lateBookings = input.arrivals.filter((a) => /no\b.*room|no stadium-area hotel/i.test(a.origin)).reduce((s, a) => s + (num(a.size) ?? 0), 0);
  const turnoutPct = num(ev.expected_turnout_pct);
  const clock = (m: number) => clockFor({ t0Min: 0 }, m);
  const scenario: Scenario = {
    id: uid('evt_' + ev.name).slice(0, 40),
    name: ev.name,
    sub: comma(capacity) + ' expected' + (turnoutPct != null ? ` (${turnoutPct}% of ${comma(num(ev.capacity) ?? capacity)})` : '') + ' · gates ' + clock(gatesOpenTick) + ' · show ' + clock(showTick),
    venueLabel: opts.venueLabel || ev.name,
    t0Min: t0,
    horizon,
    gatesOpenTick,
    showStartTick: showTick,
    laneRate: D.laneRate,
    lateBookings,
    mapZones: zones.filter((z) => z.type !== 'hotel' && z.type !== 'food').map((z) => z.id),
    zones,
    links,
    cohorts,
  };

  return { ok: true, data: { scenario, fields: fields(input), resources: input.resources, confidence: computeConfidence(fields(input)) } };
}
