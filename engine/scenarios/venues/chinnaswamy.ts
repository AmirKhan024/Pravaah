// M. Chinnaswamy Stadium, Bengaluru — cached VenueSpec (§8.5). Estimates listed in `notes`.
import type { VenueSpec } from '../../venueImport/buildGraph';

export const chinnaswamy: VenueSpec = {
  id: 'chinnaswamy',
  name: 'Cricket night — M. Chinnaswamy Stadium, Bengaluru',
  city: 'Bengaluru',
  venueLabel: 'M. Chinnaswamy Stadium',
  capacity: 33000,
  center: { lat: 12.9788, lng: 77.5996 },
  t0Min: 14 * 60,
  gatesOpenMin: 16 * 60 + 30,
  showMin: 19 * 60 + 30,
  gates: [
    { id: 'gate_queens', name: 'Queens Road gates (1–8)', lat: 12.9797, lng: 77.598, lanes: 10 },
    { id: 'gate_cubbon', name: 'Cubbon Road gates (18–20)', lat: 12.9802, lng: 77.6005, lanes: 6 },
    { id: 'gate_link', name: 'Link Road gates (17–21)', lat: 12.9786, lng: 77.6013, lanes: 6 },
    { id: 'gate_mg', name: 'MG Road side gates', lat: 12.9774, lng: 77.5992, lanes: 6 },
  ],
  stations: [
    { name: 'Cubbon Park metro', lat: 12.9811, lng: 77.5969, kind: 'metro', weight: 0.6 },
    { name: 'MG Road metro', lat: 12.9755, lng: 77.6068, kind: 'metro', weight: 0.4 },
  ],
  parking: [{ name: 'Kanteerava / UB City parking', lat: 12.971, lng: 77.596, areaM2: 5000 }],
  dropoffs: [{ name: 'Queens Road cab drop', lat: 12.9812, lng: 77.5985 }],
  hotels: [
    { name: 'JW Marriott Vittal Mallya Road', lat: 12.9721, lng: 77.5953, rooms: 281 },
    { name: 'ITC Gardenia', lat: 12.9667, lng: 77.5946, rooms: 292 },
    { name: 'Taj West End', lat: 12.9837, lng: 77.5847, rooms: 117 },
    { name: 'The Oberoi, MG Road', lat: 12.9731, lng: 77.6186, rooms: 160 },
    { name: 'Whitefield hotels', lat: 12.9698, lng: 77.7499, rooms: 1800 },
    { name: 'Hebbal hotels', lat: 13.0358, lng: 77.597, rooms: 1200 },
  ],
  split: { rail: 0.4, road: 0.3, selfDrive: 0.12, hotel: 0.18 },
  notes: [
    'Gate numbering (1–8 Queens Road, 17–21 Link Road, 18–20 Cubbon Road) is from public match-day advisories; positions are approximate.',
    'Gates are grouped into four; lane counts (10/6/6/6) are guessed.',
    'Metro share 40% and the 60/40 Cubbon Park/MG Road split are guesses.',
    'Whitefield and Hebbal room counts are illustrative cluster totals; occupancy assumed.',
    'Forecourt areas (2,000 m²) are defaults; the real streets outside are narrower.',
  ],
};
