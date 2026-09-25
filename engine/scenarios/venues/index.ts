/*
 * Pre-cached venues for "Any venue in 60 seconds" (§8.5). Cached venues must always work offline.
 * DY Patil is the hand-built flagship; the others are auto-built from a VenueSpec.
 */
import type { Scenario } from '../../types';
import { buildVenueScenario, type VenueSpec } from '../../venueImport/buildGraph';
import { chinnaswamy } from './chinnaswamy';
import { dyPatilVenue } from './dyPatil';
import { narendraModi } from './narendraModi';
import { pillai } from './pillai';
import { wankhede } from './wankhede';

export interface VenueEntry {
  id: string;
  name: string;
  city: string;
  capacity: number;
  blurb: string;
  /** the editable spec; null for the hand-built flagship */
  spec: VenueSpec | null;
  build: () => Scenario;
}

const fromSpec = (spec: VenueSpec, blurb: string): VenueEntry => ({
  id: spec.id,
  name: spec.venueLabel,
  city: spec.city,
  capacity: spec.capacity,
  blurb,
  spec,
  build: () => buildVenueScenario(spec),
});

export const VENUE_SPECS: VenueSpec[] = [wankhede, narendraModi, chinnaswamy, pillai];

export const VENUES: VenueEntry[] = [
  {
    id: dyPatilVenue.id,
    name: 'DY Patil Stadium',
    city: 'Navi Mumbai',
    capacity: 84000,
    blurb: 'The flagship. Hand-built: 84,000 people, three gates, the Nerul skywalk.',
    spec: null,
    build: () => dyPatilVenue.scenario,
  },
  fromSpec(wankhede, 'Churchgate station is across the road. Most of the crowd comes by local train.'),
  fromSpec(narendraModi, 'The largest cricket ground in the world. Most people drive or take a cab.'),
  fromSpec(chinnaswamy, 'Central Bengaluru. Two metro stations close by, tight streets outside.'),
  fromSpec(pillai, 'The hackathon venue. A campus event of a few thousand, near Panvel station.'),
];

export { wankhede, narendraModi, chinnaswamy, pillai };
