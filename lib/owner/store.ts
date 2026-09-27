'use client';
/*
 * Turns the owner's venue form into the exact row shape engine/dataLoader.ts already validates
 * and simulates (see docs/DECISIONS.md: "adapt the owner data to those rows instead of writing a
 * new path"). Persists the owner's own form state to localStorage (separate from the derived
 * Scenario bundle lib/console.ts already persists) so re-opening /owner/venue shows what was typed,
 * not just what it produced.
 */
import { loadScenarioFromRows, simulate, type ArrivalRow, type CsvScenarioInput, type DataField, type ParkingRow, type Scenario } from '@/engine';
import { loadScenario, store } from '@/lib/console';
import { cleanGroupsToArrivalRows } from '@/lib/registrations/apply';
import type { CleanGroup, GateInfo } from '@/lib/registrations/types';
import { nextId, sampleOwnerVenue, trusted, type OwnerGate, type OwnerTrust, type OwnerVenue } from './types';

const KEY = 'pravaah:owner:venue:v1';

export function loadOwnerVenue(): OwnerVenue {
  if (typeof window === 'undefined') return sampleOwnerVenue();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return sampleOwnerVenue();
    const v = JSON.parse(raw) as OwnerVenue;
    if (!v?.gates?.length) return sampleOwnerVenue();
    return v;
  } catch {
    return sampleOwnerVenue();
  }
}

export function saveOwnerVenueDraft(v: OwnerVenue) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* private browsing/quota — the draft just won't survive a reload */
  }
}

/** claimed/document-checked → tagged 'estimated' (self-reported or on-paper, not confirmed on the
 *  ground); verified → 'real'. document-checked earns 'real' too once it's actually matched against
 *  a safety document (slice 3); until then it's still just a claim with paperwork attached. */
function trustToStatus(t: OwnerTrust): 'real' | 'estimated' {
  return t === 'verified' ? 'real' : 'estimated';
}
function trustNote(t: OwnerTrust): string {
  if (t === 'verified') return 'confirmed on site by the venue owner';
  if (t === 'document-checked') return 'matches a document on file, not yet confirmed on site';
  return 'claimed by the venue owner, unconfirmed';
}

const GLOBAL_LANE_RATE = 28; // engine/venueImport/buildGraph.ts VENUE_DEFAULTS.laneRate — the one global rate every gate's lanes multiply

/** Gate throughput is lanes × one global lane-rate in this engine (Scenario.laneRate is a single
 *  constant, not per-gate) — shown as a computed reference number, not a second editable field.
 *  See docs/DECISIONS.md. */
export function gatePeoplePerMin(g: OwnerGate): number {
  return g.lanes.value * GLOBAL_LANE_RATE;
}

function toMin(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  return m ? +m[1] * 60 + +m[2] : 16 * 60;
}

/** No registrations uploaded yet: split the venue's capacity across its gates by lane share, one
 *  arrival group per gate, clearly tagged as a placeholder — every gate number the owner enters
 *  still visibly moves the simulation (more lanes there ⇒ that gate's share/handling changes),
 *  but it's honest about not being real arrival data. Replaced wholesale once registrations are
 *  uploaded (lib/registrations/apply.ts's cleanGroupsToArrivalRows). */
export function buildFallbackArrivalRows(v: OwnerVenue): ArrivalRow[] {
  // split evenly by GATE COUNT, deliberately not by lane share: the whole point of this screen is
  // "how many lanes a gate has" is the thing the owner is testing, so the crowd assigned to that
  // gate must not shrink in lockstep with its lanes, or cutting lanes would silently cancel itself
  // out and the risk readout would never move (a real bug this slice's own live verification
  // caught — see docs/DECISIONS.md).
  const gOpen = toMin(v.gatesOpen);
  const show = toMin(v.showStart);
  const mid = Math.round(gOpen + (show - gOpen) * 0.6);
  const hh = String(Math.floor(mid / 60) % 24).padStart(2, '0');
  const mm = String(mid % 60).padStart(2, '0');
  const perGate = Math.max(1, Math.round(v.capacity.value / (v.gates.length || 1)));
  return v.gates.map((g) => ({
    group: `All arrivals via ${g.name}`,
    size: String(perGate),
    share_pct: '',
    mode: 'rail',
    origin: `${g.name} approach`,
    preferred_gate: g.id,
    ticket_gate: g.id,
    mean_arrival_time: `${hh}:${mm}`,
    // narrow enough that a gate genuinely short on lanes or forecourt shows real crush minutes,
    // wide enough that a well-provisioned default venue stays calm — tuned the same way the
    // flagship's own sample data was (docs/PROGRESS.md, 2026-09-27), verified against this exact
    // sample venue (see lib/owner/__tests__/store.test.ts)
    spread_min: '14',
    pulse_period_min: '6',
    status: 'estimated',
    source_note: 'even split across your gates — no registrations uploaded yet',
  }));
}

export function buildCsvInput(v: OwnerVenue, arrivals: ArrivalRow[]): CsvScenarioInput {
  const parking: ParkingRow[] = v.parking.map((p) => ({
    name: p.name,
    capacity_vehicles: String(p.capacityVehicles.value),
    area_m2: String(p.areaM2.value),
    status: trustToStatus(p.areaM2.trust),
    source_note: trustNote(p.areaM2.trust),
  }));
  return {
    event: [
      {
        name: v.name,
        date: v.date,
        gates_open: v.gatesOpen,
        match_start: v.showStart,
        capacity: String(v.capacity.value),
        expected_turnout_pct: '100',
        venue_lat: '19.0760',
        venue_lng: '72.8777',
        status: trustToStatus(v.capacity.trust),
        source_note: `${trustNote(v.capacity.trust)} · map position is a placeholder, no exact coordinates entered`,
      },
    ],
    gates: v.gates.map((g) => ({
      gate_id: g.id,
      name: g.name,
      side: g.side,
      lanes: String(g.lanes.value),
      forecourt_area_m2: String(g.forecourtAreaM2.value),
      stands_served: '',
      vip_gate: 'false',
      accessible_lane: 'false',
      status: trustToStatus(g.lanes.trust),
      source_note: trustNote(g.lanes.trust),
    })),
    tickets: [],
    arrivals,
    hotels: [],
    resources: [],
    parking,
  };
}

export interface OwnerSaveResult {
  ok: true;
  before: RiskReadout;
  after: RiskReadout;
  fields: DataField[];
}
export type OwnerSaveOutcome = OwnerSaveResult | { ok: false; errors: string[] };

export interface RiskReadout {
  status: 'Calm' | 'Watch' | 'Act now';
  crushMin: number;
}
export function statusWord(crushMin: number): RiskReadout['status'] {
  if (crushMin <= 0) return 'Calm';
  if (crushMin < 15) return 'Watch';
  return 'Act now';
}
export function readout(scn: Scenario): RiskReadout {
  const crushMin = simulate(scn, [], { lite: true }).crushMin;
  return { status: statusWord(crushMin), crushMin };
}

/** Save: validates, builds the Scenario, and — the whole point of this slice — hands it to the
 *  exact same seam /setup already uses (lib/console.ts's loadScenario), so /live changes for real. */
export function saveOwnerVenue(v: OwnerVenue, arrivals?: ArrivalRow[]): OwnerSaveOutcome {
  const before = readout(store.getState().scn);
  const input = buildCsvInput(v, arrivals ?? buildFallbackArrivalRows(v));
  const res = loadScenarioFromRows(input, { venueLabel: v.name });
  if (!res.ok) return { ok: false, errors: res.errors };
  saveOwnerVenueDraft(v);
  loadScenario({ scenario: res.data.scenario, source: 'custom', fields: res.data.fields, confidence: res.data.confidence, resources: res.data.resources, matchDateISO: v.date });
  const after = readout(res.data.scenario);
  return { ok: true, before, after, fields: res.data.fields };
}

export function newGate(v: OwnerVenue): OwnerGate {
  const n = v.gates.length + 1;
  return { id: nextId('G'), name: `Gate ${n}`, side: 'north', lanes: trusted(4), forecourtAreaM2: trusted(1000) };
}

/** the venue's current gates, as lib/registrations needs them (matching, and proportional
 *  distribution when a registration gives no gate hint) */
export function ownerGateInfos(v: OwnerVenue = loadOwnerVenue()): GateInfo[] {
  return v.gates.map((g) => ({ id: g.id, name: g.name, lanes: g.lanes.value }));
}

/** Slice 2's "Use these groups": replaces the arrivals wholesale with what the registrations
 *  actually said, on top of the same owner venue (gates/parking/entrances untouched), and re-runs
 *  the evening — the same seam saveOwnerVenue() already uses, so /live changes for real. */
export function applyRegistrationGroups(groups: CleanGroup[]): OwnerSaveOutcome {
  const v = loadOwnerVenue();
  const arrivals = cleanGroupsToArrivalRows(groups, v.gatesOpen, v.showStart);
  return saveOwnerVenue(v, arrivals);
}
