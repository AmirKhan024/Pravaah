/*
 * Venue-owner data model (ported from ../pravaah-v2's OwnerScreen/contract, adapted to ps8's own
 * CSV-row loader — see docs/DECISIONS.md for what was reused vs. rewritten). Pure types + plain
 * localStorage persistence, client-only: nothing here calls a server.
 */

/** Reuses v2's trust ladder and colours; "document-checked"/"verified" are this brief's own
 *  wording for v2's "documented"/"observed". */
export type OwnerTrust = 'claimed' | 'document-checked' | 'verified';

export interface Trusted<T> {
  value: T;
  trust: OwnerTrust;
}
export const trusted = <T>(value: T, trust: OwnerTrust = 'claimed'): Trusted<T> => ({ value, trust });

export type Side = 'north' | 'northeast' | 'east' | 'southeast' | 'south' | 'southwest' | 'west' | 'northwest';
export const SIDES: Side[] = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];

export interface OwnerGate {
  id: string;
  name: string;
  side: Side;
  lanes: Trusted<number>;
  forecourtAreaM2: Trusted<number>;
}

export interface OwnerParking {
  id: string;
  name: string;
  capacityVehicles: Trusted<number>;
  areaM2: Trusted<number>;
}

/** Display-only: which gate a named entrance feeds. ps8's gates.csv already conflates
 *  entrance+gate (§ engine/dataLoader.ts); this is a thin, honest naming layer over it, not a new
 *  engine concept (see docs/DECISIONS.md). */
export interface OwnerEntrance {
  id: string;
  name: string;
  gateId: string;
  trust: OwnerTrust;
}

export interface OwnerVenue {
  name: string;
  city: string;
  capacity: Trusted<number>;
  /** Slice 4 (safety-document check): the 4th checkable field, alongside capacity, total gate
   *  lanes and total parking spaces. Never feeds the simulation (the engine has no exits/egress
   *  model yet — SOURCE_OF_TRUTH's own documented gap) — this is a paperwork/compliance number
   *  only, exactly matching the brief's "Pravaah checks that your numbers match your papers. It
   *  does not certify safety." */
  exits: Trusted<number>;
  date: string; // YYYY-MM-DD
  gatesOpen: string; // HH:MM
  showStart: string; // HH:MM
  gates: OwnerGate[];
  parking: OwnerParking[];
  entrances: OwnerEntrance[];
}

let seq = 0;
export const nextId = (prefix: string) => `${prefix}${++seq}_${Math.random().toString(36).slice(2, 6)}`;

export function sampleOwnerVenue(): OwnerVenue {
  const g1 = 'G1';
  const g2 = 'G2';
  const g3 = 'G3';
  return {
    name: 'Riverside Grounds',
    city: 'Navi Mumbai',
    capacity: trusted(20000, 'claimed'),
    exits: trusted(8, 'claimed'),
    date: '2026-01-17',
    gatesOpen: '16:00',
    showStart: '19:00',
    gates: [
      { id: g1, name: 'Gate 1 (Main)', side: 'north', lanes: trusted(6, 'verified'), forecourtAreaM2: trusted(1400, 'verified') },
      { id: g2, name: 'Gate 2', side: 'east', lanes: trusted(4, 'document-checked'), forecourtAreaM2: trusted(1000, 'document-checked') },
      { id: g3, name: 'Gate 3', side: 'south', lanes: trusted(3, 'claimed'), forecourtAreaM2: trusted(800, 'claimed') },
    ],
    parking: [{ id: 'P1', name: 'North lot', capacityVehicles: trusted(600, 'claimed'), areaM2: trusted(9000, 'claimed') }],
    entrances: [
      { id: 'E1', name: 'Main entrance', gateId: g1, trust: 'verified' },
      { id: 'E2', name: 'East entrance', gateId: g2, trust: 'claimed' },
    ],
  };
}
