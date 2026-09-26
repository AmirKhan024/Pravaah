// Pillai University / Pillai College campus, New Panvel — the hackathon venue (§8.5).
// Modelled as a campus ground/auditorium event of a few thousand. Estimates listed in `notes`.
import type { VenueSpec } from '../../venueImport/buildGraph';

export const pillai: VenueSpec = {
  id: 'pillai',
  name: 'Campus event — Pillai University, New Panvel',
  city: 'Navi Mumbai (Panvel)',
  venueLabel: 'Pillai campus ground',
  capacity: 4000,
  center: { lat: 18.9904, lng: 73.1281 },
  t0Min: 11 * 60 + 30, // 11:30
  gatesOpenMin: 15 * 60, // 15:00
  showMin: 17 * 60, // 17:00
  gates: [
    { id: 'gate_main', name: 'Main gate', lat: 18.9901, lng: 73.1269, lanes: 3, plazaM2: 600 },
    { id: 'gate_side', name: 'Side gate', lat: 18.9913, lng: 73.1288, lanes: 2, plazaM2: 400 },
  ],
  stations: [
    { name: 'Panvel station', lat: 18.9894, lng: 73.1216, kind: 'rail', weight: 0.85, areaM2: 1500 },
    { name: 'Khandeshwar station', lat: 19.0073, lng: 73.0949, kind: 'rail', weight: 0.15, areaM2: 1200 },
  ],
  parking: [{ name: 'Sector 16 roadside parking', lat: 18.9918, lng: 73.13, areaM2: 1500 }],
  dropoffs: [{ name: 'Auto stand, Sector 16', lat: 18.9897, lng: 73.1258, areaM2: 400 }],
  hotels: [
    { name: 'Panvel station area hotels', lat: 18.988, lng: 73.118, rooms: 150 },
    { name: 'Kharghar hotels', lat: 19.033, lng: 73.065, rooms: 400 },
    { name: 'Kalamboli hotels', lat: 19.028, lng: 73.103, rooms: 200 },
  ],
  split: { rail: 0.5, road: 0.3, selfDrive: 0.1, hotel: 0.1 },
  notes: [
    'Campus position is from public references (18.9904 N, 73.1281 E); the two gate positions, lane counts (3/2) and forecourt sizes are guessed.',
    'Event size (4,000) and timing (gates 15:00, show 17:00) are illustrative.',
    'Panvel station is about 700 m away and takes 85% of rail arrivals; Khandeshwar 15%. Both shares guessed.',
    'Hotel clusters are illustrative totals, not a real inventory; occupancy assumed.',
    'Station and drop-off holding areas are reduced from defaults to match campus streets; still estimates.',
  ],
};
