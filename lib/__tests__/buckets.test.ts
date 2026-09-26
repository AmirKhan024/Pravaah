/*
 * Six-bucket coverage map: pins the honesty tag (simulated vs. playbook) per bucket — that tag is
 * a promise to the user about what's real, so it must not silently drift — and sanity-checks the
 * status/number plumbing against a real simulate() run rather than a hand-built fake result.
 */
import { describe, expect, it } from 'vitest';
import { dyPatil, probeWaits, simulate } from '@/engine';
import { bucketStatuses } from '../buckets';

const waits = probeWaits(dyPatil);
const base = simulate(dyPatil, [], { waits });

describe('bucketStatuses()', () => {
  const info = bucketStatuses({ scn: dyPatil, cur: base, base, whatIf: null }, 0);

  it('returns exactly the six named buckets, in a stable order', () => {
    expect(info.map((b) => b.id)).toEqual(['crowd', 'transport', 'hotels', 'weather', 'vip', 'money']);
  });

  it('tags coverage honestly: crowd/transport/hotels/weather are simulated, vip/money are playbook', () => {
    const cov = Object.fromEntries(info.map((b) => [b.id, b.coverage]));
    expect(cov).toEqual({ crowd: 'simulated', transport: 'simulated', hotels: 'simulated', weather: 'simulated', vip: 'playbook', money: 'playbook' });
  });

  it('every bucket has a status, a plain-language headline and at least one risk line', () => {
    for (const b of info) {
      expect(['safe', 'watch', 'act']).toContain(b.status);
      expect(b.headline.length).toBeGreaterThan(0);
      expect(b.risks.length).toBeGreaterThan(0);
    }
  });

  it('VIP is safe with no note, and watch once a staff report flags one', () => {
    const none = bucketStatuses({ scn: dyPatil, cur: base, base, whatIf: null }, 0).find((b) => b.id === 'vip')!;
    expect(none.status).toBe('safe');
    const flagged = bucketStatuses({ scn: dyPatil, cur: base, base, whatIf: null, vipNote: 'VIP convoy running late' }, 0).find((b) => b.id === 'vip')!;
    expect(flagged.status).toBe('watch');
    expect(flagged.headline).toBe('VIP convoy running late');
  });

  it('hotels is "act" only once the plan actually leaves people unhoused', () => {
    const withUnhoused = bucketStatuses({ scn: dyPatil, cur: { ...base, unhoused: 42 }, base, whatIf: null }, 0).find((b) => b.id === 'hotels')!;
    expect(withUnhoused.status).toBe('act');
    const clean = bucketStatuses({ scn: dyPatil, cur: { ...base, unhoused: 0, housed: true }, base, whatIf: null }, 0).find((b) => b.id === 'hotels')!;
    expect(clean.status).toBe('safe');
  });

  it('weather is safe with no active what-if, watch/act only once one is applied', () => {
    const idle = bucketStatuses({ scn: dyPatil, cur: base, base, whatIf: null }, 0).find((b) => b.id === 'weather')!;
    expect(idle.status).toBe('safe');
    const worseRun = { ...base, crushMin: base.crushMin + 20 };
    const active = bucketStatuses({ scn: dyPatil, cur: worseRun, base, whatIf: { label: 'Heavy rain' } }, 0).find((b) => b.id === 'weather')!;
    expect(active.status).toBe('act');
  });

  it('money reflects the real rupees and missed count from the SimResult, never a made-up figure', () => {
    const m = info.find((b) => b.id === 'money')!;
    expect(m.risks.join(' ')).toContain(base.rupees ? `₹${Math.round(base.rupees).toLocaleString('en-IN')}` : '₹0');
    expect(m.risks.join(' ')).toContain(Math.round(base.missed).toLocaleString('en-IN'));
  });
});
