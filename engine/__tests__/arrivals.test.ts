import { describe, expect, it } from 'vitest';
import { dyPatil, peakPulseBurst } from '../index';

describe('peakPulseBurst — the one place the "trains discharge ~N people every M minutes" figure is computed', () => {
  it('matches what DY Patil actually produces, not a remembered figure', () => {
    // Regression for Phase 1: copy across the app and docs said "~900 people every 6 minutes,"
    // but this scenario's real peak burst (Nerul rail) is ~2,000. Pin the real number so any
    // future scenario-data edit that changes it is caught here, not discovered in a screenshot.
    const b = peakPulseBurst(dyPatil);
    expect(b).not.toBeNull();
    expect(b!.cohortId).toBe('nerul_rail');
    expect(b!.every).toBe(6);
    expect(b!.rounded).toBe(2000);
    expect(b!.size).toBeGreaterThan(1900);
    expect(b!.size).toBeLessThan(2100);
  });

  it('returns null for a scenario with no pulsed cohorts', () => {
    const flat = { horizon: 100, cohorts: [{ id: 'a', label: 'A', size: 100, mean: 50, std: 10, ps: 0.5, lang: 'en' as const, path: ['x'] }] };
    expect(peakPulseBurst(flat)).toBeNull();
  });
});
