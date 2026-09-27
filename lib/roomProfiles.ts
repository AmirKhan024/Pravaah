/*
 * Realistic per-cohort attendee profiles for The Room (room-upgrade brief §6-8): origin, arrival
 * time, transport mode and initial route, derived once from the *real* Scenario/Cohort when the
 * room opens — not invented copy. Per-participant variation (group size) lives in seededGroup.ts.
 */
import { clockFor, type Cohort, type Scenario } from '@/engine';
import { gateOfPath, zoneName } from './messages';

const ORIGIN: Record<string, string> = {
  nerul_rail: 'Nerul station',
  seawoods_rail: 'Seawoods Darave station',
  taxi_drop: 'Navi Mumbai (cab pickup)',
  late_book: 'Nearby hotel (booked late)',
};

const TRANSPORT: Record<string, string> = {
  nerul_rail: 'Local train',
  seawoods_rail: 'Local train',
  taxi_drop: 'Cab / auto',
  late_book: 'Cab (late booking)',
};

function transportFallback(id: string): string {
  if (id.includes('rail')) return 'Local train';
  if (id.includes('taxi')) return 'Cab / auto';
  if (id.includes('self_drive')) return 'Self-drive';
  if (id.includes('htl')) return 'Hotel coach';
  return 'On foot';
}

function originFallback(label: string): string {
  return label.replace(/^Harbour line via /, '').split(',')[0].trim();
}

export interface RoomCohortProfile {
  originLabel: string;
  transportMode: string;
  arrivalLabel: string;
  initialRoute: string;
}

export function deriveRoomCohortProfile(scn: Scenario, c: Cohort): RoomCohortProfile {
  // the MAIN gate first: a freshly-joined phone has not been redirected by anything yet, so its
  // "initial route" must be the gate it's actually on, never the alt/redirect gate that a plan
  // might later send it to — this was backwards (alt-first) and showed every nudge-eligible
  // cohort its own redirect target as if it were already in force (see docs/DECISIONS.md)
  const gateId = gateOfPath(scn, c.path) || gateOfPath(scn, c.alt);
  return {
    originLabel: ORIGIN[c.id] || originFallback(c.label),
    transportMode: TRANSPORT[c.id] || transportFallback(c.id),
    arrivalLabel: clockFor(scn, c.mean),
    initialRoute: zoneName(scn, gateId) || 'Nearest gate',
  };
}
