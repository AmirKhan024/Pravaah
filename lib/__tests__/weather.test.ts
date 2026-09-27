/*
 * Slice 2 (Weather): forecast vs. climatology vs. sample selection by horizon, threshold logic,
 * and a network failure never blocking the UI. `fetch` is mocked here — these test this module's
 * own request-shaping and result-summarising logic, not Open-Meteo itself.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crossesThreshold, fetchWeather, WEATHER_THRESHOLD, type WeatherReading } from '../weather';

const REAL_FETCH = global.fetch;
afterEach(() => {
  global.fetch = REAL_FETCH;
  vi.useRealTimers();
});

function mockJson(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body });
}

describe('crossesThreshold', () => {
  it('requires both probability AND amount to be at or above the configured threshold', () => {
    const highProbLowAmount: WeatherReading = { source: 'forecast', chancePct: 90, amountMm: 0.1, label: '' };
    const lowProbHighAmount: WeatherReading = { source: 'forecast', chancePct: 10, amountMm: 20, label: '' };
    const both: WeatherReading = { source: 'forecast', chancePct: WEATHER_THRESHOLD.probabilityPct, amountMm: WEATHER_THRESHOLD.amountMm, label: '' };
    expect(crossesThreshold(highProbLowAmount)).toBe(false);
    expect(crossesThreshold(lowProbHighAmount)).toBe(false);
    expect(crossesThreshold(both)).toBe(true);
  });
});

describe('fetchWeather', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-27T00:00:00Z'));
  });

  it('uses the forecast endpoint within the ~16-day horizon, restricted to the gates-open..kickoff+3h window', async () => {
    const calls: string[] = [];
    global.fetch = vi.fn(async (url: string) => {
      calls.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          hourly: {
            time: ['2026-10-05T14:00', '2026-10-05T18:00', '2026-10-05T23:00'],
            precipitation_probability: [10, 80, 90],
            precipitation: [0.1, 5, 9],
          },
        }),
      } as never;
    }) as never;
    const w = await fetchWeather(19.04, 73.02, '2026-10-05', 16 * 60, 19 * 60 + 30); // gates 16:00, kickoff 19:30 -> window 16:00-22:30
    expect(calls[0]).toContain('api.open-meteo.com/v1/forecast');
    expect(w.source).toBe('forecast');
    expect(w.chancePct).toBe(80); // the 23:00 reading (90%) falls outside the window
    expect(w.amountMm).toBe(5);
  });

  it('uses the historical archive beyond the forecast horizon, and reports "X of the last N years"', async () => {
    let n = 0;
    global.fetch = vi.fn(async (url: string) => {
      n++;
      expect(url).toContain('archive-api.open-meteo.com/v1/archive');
      const rained = n <= 4; // 4 of 10 years "rained"
      return { ok: true, status: 200, json: async () => ({ daily: { precipitation_sum: [rained ? 6 : 0] } }) } as never;
    }) as never;
    const w = await fetchWeather(19.04, 73.02, '2026-12-25', 16 * 60, 19 * 60 + 30); // ~89 days out -> beyond horizon
    expect(w.source).toBe('climatology');
    expect(w.yearsChecked).toBe(10);
    expect(w.yearsRained).toBe(4);
    expect(w.chancePct).toBe(40);
    expect(w.label).toContain('4 of the last 10 years');
  });

  it('falls back to the labelled sample reading if the network call fails, never throwing', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline')) as never;
    const w = await fetchWeather(19.04, 73.02, '2026-10-05', 960, 1170);
    expect(w.source).toBe('sample');
    expect(w.label.toLowerCase()).toContain('sample');
  });

  it('returns the sample reading under DEMO_OFFLINE without calling fetch at all', async () => {
    const spy = vi.fn();
    global.fetch = spy as never;
    const prev = process.env.NEXT_PUBLIC_DEMO_OFFLINE;
    process.env.NEXT_PUBLIC_DEMO_OFFLINE = '1';
    try {
      const w = await fetchWeather(19.04, 73.02, '2026-10-05', 960, 1170);
      expect(w.source).toBe('sample');
      expect(spy).not.toHaveBeenCalled();
    } finally {
      process.env.NEXT_PUBLIC_DEMO_OFFLINE = prev;
    }
  });
});
