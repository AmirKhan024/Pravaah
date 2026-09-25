/*
 * Incident replay (SOURCE_OF_TRUTH §8.4): M. Chinnaswamy Stadium, Bengaluru, 4 June 2025.
 *
 * Reconstruction from public reporting. Illustrative, not a finding of fact.
 * Every number that is not directly reported is an estimate and is listed in
 * `bengaluru2025Meta.assumptions`. Zones whose areas, lane counts or positions are
 * guessed carry `estimated: true`.
 *
 * What is modelled: the people who tried to reach the stadium gates that afternoon, their
 * routes from the two nearest metro stations, from the surrounding streets and from the
 * Vidhana Soudha felicitation, the narrow roads in front of three groups of gates, and the
 * gates themselves. Tick 0 = 13:00.
 *
 * What is NOT modelled: the wider crowd in the Central Business District that never came
 * close to the gates, the Vidhana Soudha event itself, the rain shortly before 17:30, and
 * any individual decision on the day. The engine has one gate-opening time for all gates,
 * so staggered openings are represented by a single midpoint (see assumptions).
 */
import type { Scenario } from '../types';

export const bengaluru2025: Scenario = {
  id: 'bengaluru2025',
  name: 'Victory celebration — M. Chinnaswamy Stadium, Bengaluru (4 June 2025)',
  lateBookings: 0,
  sub: 'Reconstruction · ~35,000 seats · ~90,000 people head for the gates (estimated) · gates ~15:45 · event ~17:30',
  venueLabel: 'M. Chinnaswamy Stadium',
  mapZones: ['cubbon_stn', 'mgroad_stn', 'vidhana_soudha', 'city_west', 'city_north', 'city_south', 'queens_rd', 'cubbon_rd', 'mg_rd', 'gate7', 'gate17', 'gate1', 'bowl'],
  // 13:00 → 18:00. Gates: one opening time at 15:45 (reports range 15:00 to 16:30).
  // Event inside the stadium: about 17:30 (state status report).
  t0Min: 780,
  horizon: 300,
  gatesOpenTick: 165,
  showStartTick: 270,
  // People per minute through one gate lane. DY Patil uses 28 for a screened lane of a
  // purpose-built entry. Here the gates are narrow (reported "small gates"), people had to show
  // physical passes, and there was little marshalling at the gates, so we use 20. With 13 lanes
  // that is 260 people a minute, which fills the ~35,000 seats in about 135 minutes — the time
  // between our gate-opening midpoint (15:45) and the end of the modelled window (18:00).
  // The engine does not stop entry at capacity, so we sized gates so the modelled evening
  // cannot admit many more people than there are seats.
  laneRate: 20,
  zones: [
    // Arrival points
    { id: 'cubbon_stn', name: 'Cubbon Park metro station', type: 'transit', lat: 12.9811, lng: 77.5973, areaM2: 2500, estimated: true },
    { id: 'mgroad_stn', name: 'MG Road metro station', type: 'transit', lat: 12.9755, lng: 77.6067, areaM2: 2500, estimated: true },
    { id: 'vidhana_soudha', name: 'Vidhana Soudha (felicitation crowd)', type: 'transit', lat: 12.9795, lng: 77.5907, areaM2: 20000, estimated: true },
    { id: 'city_west', name: 'Streets west of the stadium (Queens Road side)', type: 'transit', lat: 12.9818, lng: 77.5950, areaM2: 12000, estimated: true },
    { id: 'city_north', name: 'Streets north of the stadium (Cubbon Road side)', type: 'transit', lat: 12.9835, lng: 77.6010, areaM2: 12000, estimated: true },
    { id: 'city_south', name: 'Streets south of the stadium (MG Road side)', type: 'transit', lat: 12.9748, lng: 77.6010, areaM2: 12000, estimated: true },
    // The roads directly in front of each group of gates
    { id: 'queens_rd', name: 'Road outside Gates 6–7 (Queens Road side)', type: 'plaza', lat: 12.9796, lng: 77.5978, areaM2: 1500, estimated: true },
    { id: 'cubbon_rd', name: 'Road outside Gates 17–21 (Cubbon Road side)', type: 'plaza', lat: 12.9808, lng: 77.6005, areaM2: 2600, estimated: true },
    { id: 'mg_rd', name: 'Road outside Gates 1–2A (MG Road side)', type: 'plaza', lat: 12.9772, lng: 77.6000, areaM2: 3000, estimated: true },
    // Gate groups (lanes = narrow openings in use, estimated)
    { id: 'gate7', name: 'Gates 6–7', type: 'gate', lat: 12.9794, lng: 77.5983, areaM2: 150, lanes: 3, estimated: true },
    { id: 'gate17', name: 'Gates 17–21', type: 'gate', lat: 12.9803, lng: 77.6002, areaM2: 200, lanes: 5, estimated: true },
    { id: 'gate1', name: 'Gates 1–2A', type: 'gate', lat: 12.9777, lng: 77.5998, areaM2: 200, lanes: 5, estimated: true },
    { id: 'bowl', name: 'Stadium stands', type: 'venue', lat: 12.9788, lng: 77.5996, areaM2: 20000, capacity: 35000 },
  ],
  links: [
    { id: 'B1', from: 'cubbon_stn', to: 'queens_rd', name: 'Cubbon Park station to Queens Road', mode: 'walk', cap: 300, ff: 4, areaM2: 1500 },
    { id: 'B2', from: 'city_west', to: 'queens_rd', name: 'Queens Road approach', mode: 'walk', cap: 300, ff: 5, areaM2: 2000 },
    { id: 'B3', from: 'vidhana_soudha', to: 'queens_rd', name: 'Through Cubbon Park to Queens Road', mode: 'walk', cap: 450, ff: 14, areaM2: 6000 },
    { id: 'B4', from: 'city_north', to: 'cubbon_rd', name: 'Cubbon Road approach', mode: 'walk', cap: 350, ff: 5, areaM2: 2400 },
    { id: 'B5', from: 'mgroad_stn', to: 'mg_rd', name: 'MG Road station to the stadium', mode: 'walk', cap: 350, ff: 8, areaM2: 3000 },
    { id: 'B6', from: 'city_south', to: 'mg_rd', name: 'MG Road approach', mode: 'walk', cap: 350, ff: 5, areaM2: 2400 },
    { id: 'G7', from: 'queens_rd', to: 'gate7', name: 'Gates 6–7 entry', mode: 'gate', gate: 'gate7' },
    { id: 'G17', from: 'cubbon_rd', to: 'gate17', name: 'Gates 17–21 entry', mode: 'gate', gate: 'gate17' },
    { id: 'G1', from: 'mg_rd', to: 'gate1', name: 'Gates 1–2A entry', mode: 'gate', gate: 'gate1' },
    { id: 'C7', from: 'gate7', to: 'bowl', name: 'West stands', mode: 'walk', cap: 600, ff: 2, areaM2: 1500 },
    { id: 'C17', from: 'gate17', to: 'bowl', name: 'North stands', mode: 'walk', cap: 600, ff: 2, areaM2: 1500 },
    { id: 'C1', from: 'gate1', to: 'bowl', name: 'South stands', mode: 'walk', cap: 600, ff: 2, areaM2: 1500 },
    // Walking round the stadium to another group of gates
    { id: 'P1', from: 'queens_rd', to: 'cubbon_rd', name: 'Round the north-west corner', mode: 'walk', cap: 200, ff: 6, areaM2: 1200 },
    { id: 'P2', from: 'cubbon_stn', to: 'cubbon_rd', name: 'Cubbon Park station to Cubbon Road', mode: 'walk', cap: 250, ff: 8, areaM2: 1800 },
    { id: 'P3', from: 'vidhana_soudha', to: 'mg_rd', name: 'Kasturba Road to MG Road', mode: 'walk', cap: 350, ff: 20, areaM2: 5000 },
  ],
  cohorts: [
    // Metro: the Purple Line ran through the afternoon; Cubbon Park and Vidhana Soudha stations
    // were closed from about 16:30–17:10. Trains discharge in bursts every ~4 min (estimated).
    { id: 'cubbon_rail', label: 'Metro riders at Cubbon Park', size: 16000, mean: 150, std: 35, ps: 0.5, lang: 'en', pulse: { period: 4, width: 1, offset: 0 }, path: ['B1', 'G7', 'C7'], alt: ['P2', 'G17', 'C17'], altExtraMin: 4 },
    { id: 'mgroad_rail', label: 'Metro riders at MG Road', size: 12000, mean: 150, std: 35, ps: 0.5, lang: 'en', pulse: { period: 4, width: 1, offset: 2 }, path: ['B5', 'G1', 'C1'] },
    // On foot, by two-wheeler and by bus, into the streets around the stadium.
    { id: 'walk_west', label: 'People arriving on foot, Queens Road side', size: 14000, mean: 150, std: 40, ps: 0.5, lang: 'en', path: ['B2', 'G7', 'C7'], alt: ['B2', 'P1', 'G17', 'C17'], altExtraMin: 6 },
    { id: 'walk_north', label: 'People arriving on foot, Cubbon Road side', size: 16000, mean: 150, std: 40, ps: 0.5, lang: 'en', path: ['B4', 'G17', 'C17'] },
    { id: 'walk_south', label: 'People arriving on foot, MG Road side', size: 12000, mean: 150, std: 40, ps: 0.5, lang: 'en', path: ['B6', 'G1', 'C1'] },
    // After the felicitation at Vidhana Soudha (~16:00–17:00) part of that crowd walked on to the stadium.
    { id: 'vs_crowd', label: 'Crowd walking from Vidhana Soudha', size: 20000, mean: 235, std: 25, ps: 0.5, lang: 'en', path: ['B3', 'G7', 'C7'], alt: ['P3', 'G1', 'C1'], altExtraMin: 6 },
  ],
};

export interface IncidentMeta {
  label: string;
  timeline: { time: string; text: string; source: number }[];
  sources: { n: number; title: string; outlet: string; url: string; date?: string }[];
  assumptions: string[];
  watchZone: string;
}

export const bengaluru2025Meta: IncidentMeta = {
  label: 'Reconstruction from public reporting. Illustrative, not a finding of fact.',
  watchZone: 'queens_rd',
  timeline: [
    { time: '07:01', text: 'The team posts that there will be a victory parade and celebration, with free entry.', source: 2 },
    { time: '11:00', text: 'The state government announces a felicitation at Vidhana Soudha and a function at the stadium.', source: 3 },
    { time: '14:00', text: 'Crowds are forming outside the stadium. Traffic on nearby streets slows to a stop.', source: 1 },
    { time: '15:00', text: 'Some stadium gates open, later than the planned 13:45, according to a court filing. Other gates stay shut.', source: 5 },
    { time: '15:14', text: 'A new post says free passes are needed for limited entry. Many people are unsure how to get in.', source: 2 },
    { time: '15:30', text: 'People are pressed together at several gates. This continues for about two hours.', source: 1 },
    { time: '16:00', text: 'The players are at Vidhana Soudha. More than a lakh people are gathered there.', source: 3 },
    { time: '16:30', text: 'About 8 to 10 of the 21 gates are open. Metro stations near the stadium close to new riders.', source: 6 },
    { time: '17:30', text: 'The event inside the stadium begins and is kept short.', source: 7 },
  ],
  sources: [
    { n: 1, title: '2025 Bengaluru crowd crush', outlet: 'Wikipedia (compiles Deccan Herald, The Hindu, India Today, NDTV and others)', url: 'https://en.wikipedia.org/wiki/2025_Bengaluru_crowd_crush' },
    { n: 2, title: 'Karnataka Govt submits Chinnaswamy stampede status report to HC, RCB blamed for excessive turnout', outlet: 'The Tribune', url: 'https://www.tribuneindia.com/news/sports/karnataka-govt-subimits-chinnaswamy-stampede-status-report-to-hc-rcb-blamed-for-excessive-turnout', date: '2025-07-17' },
    { n: 3, title: 'Bengaluru stampede: What exactly happened? Timeline, and other details', outlet: 'The Federal', url: 'https://thefederal.com/category/states/south/karnataka/bengaluru-stampede-what-exactly-happened-timeline-and-other-details-190583', date: '2025-06-05' },
    { n: 4, title: 'Karnataka Cabinet accepts D’Cunha panel report on Chinnaswamy stampede', outlet: 'The South First', url: 'https://thesouthfirst.com/karnataka/karnataka-cabinet-accepts-dcunha-panel-report-on-chinnaswamy-stampede-rcb-ksca-police-officials-held-liable/', date: '2025-07-24' },
    { n: 5, title: 'Chinnaswamy stampede case: RCB moves Karnataka High Court to quash FIR', outlet: 'Business Standard', url: 'https://www.business-standard.com/india-news/chinnaswamy-stampede-case-rcb-moves-karnataka-high-court-to-quash-fir-in-bengaluru-stampede-case-125060900552_1.html', date: '2025-06-09' },
    { n: 6, title: 'Stampede at Chinnaswamy Stadium: Poor crowd management blamed for injuries', outlet: 'The Hans India', url: 'https://www.thehansindia.com/news/cities/bengaluru/stampede-at-chinnaswamy-stadium-poor-crowd-management-blamed-for-injuries-977378', date: '2025-06-05' },
    { n: 7, title: "Chinnaswamy stampede: 'Govt's reaction was both immediate and multifaceted', reads status report to HC", outlet: 'IANS via Prokerala', url: 'https://www.prokerala.com/news/articles/a1654347.html', date: '2025-07-17' },
    { n: 8, title: 'Metro services suspended in Cubbon Park and Vidhana Soudha stations', outlet: 'The News Minute', url: 'https://www.thenewsminute.com/karnataka/metro-services-suspended-in-cubbon-park-and-vidhana-soudha-stations', date: '2025-06-04' },
    { n: 9, title: 'Kohli "absolutely gutted" as 11 die in Bengaluru cricket stadium stampede', outlet: 'Al Jazeera', url: 'https://www.aljazeera.com/sports/2025/6/5/kohli-absolutely-gutted-after-11-dead-in-bengaluru-stadium-stampede', date: '2025-06-05' },
    { n: 10, title: 'Bengaluru Stampede: Gate 7 of Chinnaswamy Stadium was the epicentre', outlet: 'Oneindia', url: 'https://www.oneindia.com/bengaluru/bengaluru-stampede-gate-7-of-chinnaswamy-was-the-epicentre-after-after-free-pass-rumours-went-viral-4172739.html', date: '2025-06-05' },
  ],
  assumptions: [
    'Stadium seats: reports give 32,000 to 40,000. We use 35,000, the figure given by the Chief Minister and most outlets [4, 9].',
    'Crowd: reports range from about 50,000 within 1 km (police, during the afternoon) to 2.5–3 lakh in the whole area (state report). We model 90,000 people who try to reach the gates. Everyone else in the area is not modelled. This is a deliberately low figure [1, 2, 9].',
    'Gate opening: reports range from 15:00 (some gates) to shortly after 16:30 (8 to 10 gates). The engine uses one opening time for every gate, so we use the midpoint, 15:45 [1, 5, 6].',
    'Gates are grouped into three: Gates 6–7 (Queens Road side), Gates 17–21 (Cubbon Road side) and Gates 1–2A (MG Road side). Deaths were reported near all three groups [1, 4]. Which road each gate faces is approximate; Gate 7 is reported on the Queens Road side [10].',
    'Lanes per gate group (3, 5 and 5) and 20 people a minute per lane are estimates. Together they let about 260 people a minute in, which fills the stands in about 135 minutes.',
    'Road areas in front of the gates (1,500, 2,600 and 3,000 m²) are estimates from typical road widths (about 10–15 m) and lengths. The Gates 6–7 lane is reported as narrow [10].',
    'Arrival split and timing are estimates: 28,000 by metro (Cubbon Park 16,000, MG Road 12,000), 42,000 on foot from the surrounding streets, 20,000 walking over from Vidhana Soudha after the felicitation.',
    'Metro and street arrivals peak around 15:30, after the crowds reported from 14:00 and the 15:14 post [1, 2]. Nearby metro stations closed to new riders from about 16:30 [8]; our metro arrivals are mostly over by then.',
    'Metro trains are assumed to arrive every 4 minutes, each bringing a burst of people.',
    'Walking capacities and times on each road are estimates for roads of that width.',
    'Rain shortly before 17:30 and the team bus arriving are not modelled.',
    'The engine does not stop people entering once the stands are full. Gate capacity was sized so the modelled evening cannot admit many more than 35,000. Plans that add gate lanes therefore overstate how many more people could safely be let in.',
  ],
};
