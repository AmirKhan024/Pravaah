import { describe, expect, it } from 'vitest';
import { clockFor, dyPatil } from '../../engine';
import { deriveRoomCohortProfile } from '../roomProfiles';
import { seededGroupSize } from '../seededGroup';

describe('seededGroupSize — deterministic per participant (§12)', () => {
  it('is the same for the same pid every time', () => {
    expect(seededGroupSize('p-abc123')).toBe(seededGroupSize('p-abc123'));
  });
  it('is always in range 1-4', () => {
    for (const pid of ['a', 'b', 'c', 'sim-0', 'sim-1', 'p-xyz', 'p-very-different-id']) {
      const n = seededGroupSize(pid);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(4);
    }
  });
  it('varies across different pids (not a constant)', () => {
    const sizes = new Set(Array.from({ length: 30 }, (_, i) => seededGroupSize('sim-' + i)));
    expect(sizes.size).toBeGreaterThan(1);
  });
});

describe('deriveRoomCohortProfile — real values off the real Scenario/Cohort, not invented copy', () => {
  it('the arrival label matches clockFor(scn, cohort.mean)', () => {
    const nerul = dyPatil.cohorts.find((c) => c.id === 'nerul_rail')!;
    const profile = deriveRoomCohortProfile(dyPatil, nerul);
    expect(profile.arrivalLabel).toBe(clockFor(dyPatil, nerul.mean));
  });
  it('every nudge-eligible cohort gets a non-empty profile', () => {
    for (const c of dyPatil.cohorts.filter((c) => c.alt)) {
      const profile = deriveRoomCohortProfile(dyPatil, c);
      expect(profile.originLabel).toBeTruthy();
      expect(profile.transportMode).toBeTruthy();
      expect(profile.arrivalLabel).toBeTruthy();
      expect(profile.initialRoute).toBeTruthy();
    }
  });
});
