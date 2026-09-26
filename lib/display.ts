/*
 * Display-only alignment. The engine never reads coordinates, so nudging where a zone is DRAWN
 * cannot change any number. DY Patil's stadium cluster (from the prototype) sits ~330 m north-west
 * of the real stadium on the basemap; this snaps the bowl, its gates and forecourts onto it.
 */
import type { Scenario } from '@/engine';

export interface DisplayShift {
  ids: string[];
  dLat: number;
  dLng: number;
}

const SHIFTS: Record<string, DisplayShift> = {
  dyPatil: { ids: ['bowl', 'gate1', 'gate3', 'gate5', 'fc_west', 'fc_north', 'fc_east', 'food_west', 'food_east'], dLat: -0.003, dLng: 0.0013 },
};

export function displayLatLng(scn: Scenario, z: { id: string; lat: number; lng: number }) {
  const s = scn.id ? SHIFTS[scn.id] : undefined;
  if (s && s.ids.indexOf(z.id) >= 0) return { lat: z.lat + s.dLat, lng: z.lng + s.dLng };
  return { lat: z.lat, lng: z.lng };
}
