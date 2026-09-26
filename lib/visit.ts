/*
 * /visit — a single visitor's own card (no login, mobile-first). Pure, deterministic: same
 * RoomSnapshot + same choices -> same card, every number traced back to a real simulate() run
 * (the room's `plan`/`origins` were themselves computed from a SimResult — see lib/room.ts).
 * Framework-free on purpose so it's trivially unit-testable, same spirit as engine/ code.
 */
import { clockFor, type Lang } from '@/engine';
import type { RoomSnapshot, VisitOrigin } from './roomTypes';

export interface VisitProfile {
  lang: Lang;
  originId: string;
  mode: string;
  /** a hotel VisitOrigin's id if the visitor is staying overnight there, else null */
  stayingHotelId: string | null;
  partySize: number;
}

export interface VisitCard {
  gateName: string;
  redirected: boolean;
  leaveBy: string; // "HH:MM"
  route: string;
  tip: string;
}

export const STAY_TIP = 'Leave with your coach — they tend to fill up before the show starts.';
/** how much earlier than "usual" to leave, on top of whatever the gate's queue is currently costing */
const LEAVE_BUFFER_MIN = 10;

export function hotelOptions(origins: VisitOrigin[]): VisitOrigin[] {
  return origins.filter((o) => o.isHotel);
}

/** Every value here traces to `snap.origins`/`snap.plan`, both built from a real SimResult
 *  (lib/room.ts's visitOrigins()/planSnapshot()) — nothing is invented for the card itself. Party
 *  size and travel mode are the visitor's own words: shown back, never fed into the simulation
 *  (see docs/DECISIONS.md — this is a demo-level personal card, not a new cohort in the engine). */
export function buildVisitCard(snap: Pick<RoomSnapshot, 't0Min' | 'origins' | 'baseGateWaitPeak' | 'plan'>, profile: VisitProfile): VisitCard | null {
  const origin = snap.origins.find((o) => o.id === profile.originId);
  if (!origin) return null;
  const redirected = !!(origin.altGateId && snap.plan?.redirects[origin.id]);
  const gateId = redirected ? origin.altGateId! : origin.mainGateId;
  const gateName = redirected ? origin.altGateName! : origin.mainGateName;
  // before any plan exists, fall back to the real do-nothing wait — never a silent zero (a real
  // bug this feature's own live verification caught: see docs/DECISIONS.md)
  const gateWait = snap.plan?.gateWaitPeak[gateId] ?? snap.baseGateWaitPeak[gateId] ?? 0;
  const leaveTick = Math.max(0, Math.round(origin.meanTick - gateWait - LEAVE_BUFFER_MIN));
  const leaveBy = clockFor({ t0Min: snap.t0Min }, leaveTick);
  const route = `From ${origin.originLabel}, by ${profile.mode || origin.transportMode}, to ${gateName}.`;
  const tip = profile.stayingHotelId ? STAY_TIP : origin.tip;
  return { gateName, redirected, leaveBy, route, tip };
}
