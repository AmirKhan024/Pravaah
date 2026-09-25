// Wankhede Stadium, Churchgate, Mumbai — cached VenueSpec for "Any venue in 60 seconds" (§8.5).
// Positions are approximate (public maps). Everything else is an estimate; see `notes`.
import type { VenueSpec } from '../../venueImport/buildGraph';

export const wankhede: VenueSpec = {
  id: 'wankhede',
  name: 'Cricket night — Wankhede Stadium, Churchgate',
  city: 'Mumbai',
  venueLabel: 'Wankhede Stadium',
  capacity: 33000,
  center: { lat: 18.9386, lng: 72.8254 },
  t0Min: 14 * 60, // 14:00
  gatesOpenMin: 16 * 60 + 30, // 16:30
  showMin: 19 * 60 + 30, // 19:30
  gates: [
    { id: 'gate_vm', name: 'Vinoo Mankad gate', lat: 18.9374, lng: 72.8259, lanes: 8 },
    { id: 'gate_droad', name: 'D Road gate', lat: 18.9389, lng: 72.8268, lanes: 6 },
    { id: 'gate_north', name: 'North Stand gate', lat: 18.9399, lng: 72.8252, lanes: 6 },
    { id: 'gate_md', name: 'Marine Drive gate', lat: 18.9385, lng: 72.824, lanes: 6 },
  ],
  stations: [
    { name: 'Churchgate station', lat: 18.9353, lng: 72.8272, kind: 'rail', weight: 0.62 },
    { name: 'Marine Lines station', lat: 18.9455, lng: 72.824, kind: 'rail', weight: 0.38 },
  ],
  parking: [{ name: 'Nariman Point pay-and-park', lat: 18.9262, lng: 72.8233, areaM2: 3000 }],
  dropoffs: [{ name: 'Marine Drive cab drop', lat: 18.9408, lng: 72.8236 }],
  hotels: [
    { name: 'InterContinental Marine Drive', lat: 18.9337, lng: 72.8236, rooms: 58 },
    { name: 'Hotel Marine Plaza', lat: 18.9322, lng: 72.8238, rooms: 68 },
    { name: 'Trident Nariman Point', lat: 18.9276, lng: 72.8207, rooms: 550 },
    { name: 'Taj Mahal Palace', lat: 18.9217, lng: 72.8331, rooms: 560 },
    { name: 'Bandra hotels', lat: 19.0596, lng: 72.8295, rooms: 900 },
    { name: 'Andheri East hotels', lat: 19.1136, lng: 72.8697, rooms: 1400 },
  ],
  split: { rail: 0.55, road: 0.22, selfDrive: 0.08, hotel: 0.15 },
  notes: [
    'Stadium, station and hotel positions are approximate, from public maps.',
    'Four gate groups are modelled (Vinoo Mankad gate is the main public entrance); their exact positions and lane counts (8/6/6/6) are guessed.',
    'Forecourt areas (2,000 m²) and gate areas (400 m²) are defaults, not surveyed.',
    'Rail share 55% (heavy local-train crowd) and the 62/38 Churchgate/Marine Lines split are guesses.',
    'Room counts for Bandra and Andheri are illustrative cluster totals; occupancy is assumed (near hotels 95% full, far 60%).',
    'Walking times use straight-line distance × 1.25 at 75 m/min; road times at 350 m/min.',
  ],
};
