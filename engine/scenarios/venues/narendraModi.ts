// Narendra Modi Stadium, Motera, Ahmedabad — cached VenueSpec (§8.5). Estimates listed in `notes`.
import type { VenueSpec } from '../../venueImport/buildGraph';

export const narendraModi: VenueSpec = {
  id: 'narendraModi',
  name: 'Cricket night — Narendra Modi Stadium, Motera',
  city: 'Ahmedabad',
  venueLabel: 'Narendra Modi Stadium',
  capacity: 132000,
  center: { lat: 23.0914, lng: 72.5972 },
  t0Min: 14 * 60,
  gatesOpenMin: 16 * 60,
  showMin: 19 * 60 + 30,
  gates: [
    { id: 'gate_ne', name: 'North-east gates', lat: 23.0932, lng: 72.5993, lanes: 16 },
    { id: 'gate_e', name: 'East gates', lat: 23.0906, lng: 72.5998, lanes: 14 },
    { id: 'gate_s', name: 'South gates', lat: 23.0892, lng: 72.5968, lanes: 14 },
    { id: 'gate_w', name: 'West gates', lat: 23.0911, lng: 72.5945, lanes: 14 },
    { id: 'gate_n', name: 'North gates', lat: 23.0937, lng: 72.5963, lanes: 14 },
  ],
  stations: [
    { name: 'Motera Stadium metro', lat: 23.0965, lng: 72.6007, kind: 'metro', weight: 0.8 },
    { name: 'Sabarmati Railway Station metro', lat: 23.0775, lng: 72.5895, kind: 'metro', weight: 0.2 },
  ],
  parking: [
    { name: 'Stadium parking, east', lat: 23.0915, lng: 72.603, areaM2: 12000 },
    { name: 'Stadium parking, south', lat: 23.0868, lng: 72.596, areaM2: 12000 },
  ],
  dropoffs: [
    { name: 'Motera road cab drop', lat: 23.0948, lng: 72.596 },
    { name: 'Koteshwar road drop', lat: 23.088, lng: 72.599 },
  ],
  hotels: [
    { name: 'Motera and Chandkheda hotels', lat: 23.105, lng: 72.593, rooms: 600 },
    { name: 'Ashram Road hotels', lat: 23.039, lng: 72.568, rooms: 2200 },
    { name: 'SG Highway hotels', lat: 23.03, lng: 72.507, rooms: 3000 },
    { name: 'Gandhinagar hotels', lat: 23.216, lng: 72.64, rooms: 1500 },
  ],
  split: { rail: 0.22, road: 0.3, selfDrive: 0.33, hotel: 0.15 },
  notes: [
    'Stadium and Motera metro positions are from public references; gates are five estimated gate groups.',
    'Lane counts (14–16 per gate group) are guessed so that a 132,000 crowd can plausibly enter.',
    'Rail share 22% via metro (80% Motera, 20% Sabarmati) is a guess; most fans drive or take cabs.',
    'Parking areas (12,000 m²), drop-off points and hotel cluster sizes are illustrative; occupancy assumed.',
    'Forecourt areas (2,000 m²) and gate areas (400 m²) are defaults, not surveyed.',
  ],
};
