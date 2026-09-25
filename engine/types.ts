export type ZoneType = 'transit' | 'parking' | 'hotel' | 'plaza' | 'gate' | 'venue' | 'food';
export type Lang = 'mr' | 'hi' | 'en';

export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  lat: number;
  lng: number;
  /** transit/parking/plaza/gate/venue — density = occ / areaM2 */
  areaM2?: number;
  /** gate: screening lanes */
  lanes?: number;
  /** venue */
  capacity?: number;
  rooms?: number;
  occupied?: number;
  price?: number;
  near?: string;
  stalls?: number;
  serviceRate?: number;
  /** marks a value that was derived automatically and should be checked by a human */
  estimated?: boolean;
}

export type LinkMode = 'walk' | 'road' | 'shuttle' | 'gate';
export interface Link {
  id: string;
  from: string;
  to: string;
  name: string;
  mode: LinkMode;
  /** people/min (non-gate) */
  cap?: number;
  /** free-flow travel minutes (non-gate) */
  ff?: number;
  /** walk links: density on the link itself */
  areaM2?: number;
  /** gate links: which gate zone supplies lanes */
  gate?: string;
}

export interface Pulse {
  period: number;
  width: number;
  offset: number;
}

export interface Cohort {
  id: string;
  label: string;
  size: number;
  mean: number;
  std: number;
  ps: number;
  lang: Lang;
  pulse?: Pulse;
  path: string[];
  alt?: string[];
  altExtraMin?: number;
  housed?: string[];
}

export interface Scenario {
  id?: string;
  name: string;
  sub: string;
  venueLabel: string;
  t0Min: number;
  horizon: number;
  gatesOpenTick: number;
  showStartTick: number;
  laneRate: number;
  lateBookings: number;
  mapZones?: string[];
  zones: Zone[];
  links: Link[];
  cohorts: Cohort[];
}

export type Intervention =
  | { type: 'lanes'; gate: string; n: number; from: number; label?: string }
  | { type: 'shuttle'; link: string; add: number; vehicles: number; from: number; label?: string }
  | { type: 'stagger'; cohort: string; delta: number; decisionTick?: number; label?: string }
  | { type: 'house'; decisionTick?: number; label?: string }
  | {
      type: 'nudge';
      cohort: string;
      ask: 'reroute' | 'shift';
      rupees: number;
      delta?: number;
      decisionTick?: number;
      label?: string;
    }
  | { type: 'food'; zone: string; n: number; from: number; label?: string };

export type InterventionType = Intervention['type'];

export interface CapPatch {
  capMult: Partial<Record<LinkMode, number>>;
  fromTick?: number;
}

export interface SimOptions {
  lite?: boolean;
  waits?: Record<string, number>;
  patch?: CapPatch;
  forceDivert?: Record<string, number>;
  noPulse?: boolean;
  /**
   * The Room (SOURCE_OF_TRUTH §8.1): replaces the nudge acceptance probability `p`
   * for a cohort with the live acceptance rate measured from real phones.
   * Absent → default behaviour, identical to the prototype.
   */
  acceptOverride?: Record<string, number>;
  /**
   * Per-link capacity multiplier from a tick onward (used by Red Team's rail-failure-at-T nights).
   * Absent → default behaviour, identical to the prototype.
   */
  linkCapMult?: Record<string, { mult: number; fromTick: number }>;
}

export interface Frame {
  zoneOcc: Float32Array;
  zoneDen: Float32Array;
  linkOcc: Float32Array;
  linkDen: Float32Array;
  linkSat: Float32Array;
  linkFlow: Float32Array;
  linkTT: Float32Array;
  arrived: number;
  gateWait: Record<string, number>;
  foodWait: Record<string, number>;
  crush: number;
}

export interface NudgeInfo {
  cohort: string;
  label: string;
  rupees: number;
  p: number;
  accepted: number;
  ask: 'reroute' | 'shift';
  lang: Lang;
  saved: number;
  /** true when `p` came from The Room instead of the model */
  fromRoom?: boolean;
  /** the model's own p, kept for "the room said X, the model predicted Y" */
  modelP?: number;
}

export interface SimResult {
  crushMin: number;
  missed: number;
  waitHours: number;
  unhoused: number;
  housed: boolean;
  rupees: number;
  inconvenience: number;
  peakDen: number[];
  peakLinkDen: number[];
  frames: Frame[];
  nudgeInfo: NudgeInfo[];
  maxDenSeries: Float32Array;
  crushSeries: Float32Array;
  gateWaitPeak: Record<string, number>;
  foodWaitPeak: Record<string, number>;
  maxGateWait: number;
  worst: { zone: number; den: number; tick: number };
  interventions: Intervention[];
}
