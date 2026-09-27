/*
 * Slice 2 (Weather) — real data, honest at every horizon. No API key: Open-Meteo's forecast API
 * (hourly precipitation/precipitation_probability, up to 16 days out) and its historical archive
 * API (ERA5 reanalysis, back to 1940) are both free and public; verified against
 * https://open-meteo.com/en/docs and https://open-meteo.com/en/docs/historical-weather-api before
 * writing this (2026-09-27). Offline (NEXT_PUBLIC_DEMO_OFFLINE=1): a bundled, clearly labelled
 * sample reading — no network call at all.
 *
 * Nothing here invents a rain/no-rain call: forecast and climatology are both real, sourced,
 * labelled numbers; the only "decision" (crossesThreshold) is a plain, visible, single-config
 * comparison, and the existing engine rain lever (engine/whatif.ts's applyRain, already wired
 * through lib/monitor.ts's observed/WhatIfSpec) is what actually changes the simulated evening —
 * this file only ever decides *whether* to call `reportObserved({ rain: true }, ...)`, never
 * touches a simulated number itself.
 */
import { daysBetweenISO, todayISO } from './timeline';

export type WeatherSource = 'forecast' | 'climatology' | 'sample';

export interface WeatherReading {
  source: WeatherSource;
  /** 0-100: forecast's own probability, or (climatology) the % of the last N years it rained */
  chancePct: number;
  /** mm: forecast's expected total in the gates-open..kickoff+3h window, or climatology's average */
  amountMm: number;
  /** one plain sentence, ready to show as-is */
  label: string;
  yearsRained?: number;
  yearsChecked?: number;
}

/** Kept in one place, per the brief — every "is this bad enough to act on" call in the app reads
 *  this same config, never a second copy of the numbers. */
export interface WeatherThreshold {
  probabilityPct: number;
  amountMm: number;
}
export const WEATHER_THRESHOLD: WeatherThreshold = { probabilityPct: 60, amountMm: 4 };

/** Open-Meteo's hourly forecast covers up to 16 days; stay one day inside that so `end_date`
 *  (same as start_date here — a single match day) is always resolvable. */
const FORECAST_HORIZON_DAYS = 15;
const HISTORICAL_YEARS = 10;
/** a day counts as "it rained" in the climatology count at or above this many mm — matches a
 *  light-drizzle-doesn't-count, real-rain-does bar; independent of WEATHER_THRESHOLD, which is
 *  about whether the RISK is big enough to act on, not whether a past day counted as wet */
const RAIN_DAY_MM = 1;

export const weatherEnabled = () => typeof process === 'undefined' || process.env.NEXT_PUBLIC_DEMO_OFFLINE !== '1';

export function crossesThreshold(w: WeatherReading, t: WeatherThreshold = WEATHER_THRESHOLD): boolean {
  return w.chancePct >= t.probabilityPct && w.amountMm >= t.amountMm;
}

const SAMPLE_WEATHER: WeatherReading = {
  source: 'sample',
  chancePct: 12,
  amountMm: 0.3,
  label: 'Sample weather (offline demo): low rain risk on this date — this time of year is usually dry here.',
};

function hourOf(isoTime: string): number {
  return Number(isoTime.slice(11, 13));
}

async function fetchForecast(lat: number, lng: number, matchDateISO: string, gatesOpenMin: number, showStartMin: number): Promise<WeatherReading> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=precipitation_probability,precipitation&start_date=${matchDateISO}&end_date=${matchDateISO}&timezone=auto`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('forecast fetch failed: ' + r.status);
  const j = (await r.json()) as { hourly?: { time?: string[]; precipitation_probability?: number[]; precipitation?: number[] } };
  const times = j.hourly?.time ?? [];
  const probs = j.hourly?.precipitation_probability ?? [];
  const amounts = j.hourly?.precipitation ?? [];
  const startHour = Math.floor(gatesOpenMin / 60);
  const endHour = Math.min(23, Math.floor(showStartMin / 60) + 3);
  let maxProb = 0,
    totalMm = 0;
  times.forEach((t, i) => {
    const h = hourOf(t);
    if (h >= startHour && h <= endHour) {
      maxProb = Math.max(maxProb, probs[i] ?? 0);
      totalMm += amounts[i] ?? 0;
    }
  });
  totalMm = Math.round(totalMm * 10) / 10;
  return {
    source: 'forecast',
    chancePct: Math.round(maxProb),
    amountMm: totalMm,
    label: `Forecast: ${Math.round(maxProb)}% chance of rain, ${totalMm}mm expected from gates-open to kickoff+3h.`,
  };
}

async function fetchClimatology(lat: number, lng: number, matchDateISO: string): Promise<WeatherReading> {
  const [, mm, dd] = matchDateISO.split('-');
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: HISTORICAL_YEARS }, (_, i) => thisYear - 1 - i);
  const readings = await Promise.all(
    years.map(async (y) => {
      const date = `${y}-${mm}-${dd}`;
      try {
        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${date}&end_date=${date}&daily=precipitation_sum&timezone=auto`;
        const r = await fetch(url);
        if (!r.ok) return null;
        const j = (await r.json()) as { daily?: { precipitation_sum?: (number | null)[] } };
        const v = j.daily?.precipitation_sum?.[0];
        return typeof v === 'number' ? v : null;
      } catch {
        return null;
      }
    }),
  );
  const valid = readings.filter((v): v is number => v != null);
  if (!valid.length) throw new Error('no historical data available for this window');
  const rainyYears = valid.filter((v) => v >= RAIN_DAY_MM).length;
  const avgMm = Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
  return {
    source: 'climatology',
    chancePct: Math.round((rainyYears / valid.length) * 100),
    amountMm: avgMm,
    yearsRained: rainyYears,
    yearsChecked: valid.length,
    label: `It rained in ${rainyYears} of the last ${valid.length} years around this date.`,
  };
}

/** The one entry point: picks forecast vs. climatology vs. sample by horizon, and never throws —
 *  a network hiccup falls back to the sample reading rather than blocking the UI. */
export async function fetchWeather(lat: number, lng: number, matchDateISO: string, gatesOpenMin: number, showStartMin: number): Promise<WeatherReading> {
  if (!weatherEnabled()) return SAMPLE_WEATHER;
  try {
    const daysOut = daysBetweenISO(todayISO(), matchDateISO);
    if (daysOut >= 0 && daysOut <= FORECAST_HORIZON_DAYS) return await fetchForecast(lat, lng, matchDateISO, gatesOpenMin, showStartMin);
    return await fetchClimatology(lat, lng, matchDateISO);
  } catch {
    return SAMPLE_WEATHER;
  }
}
