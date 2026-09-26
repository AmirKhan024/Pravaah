import { describe, expect, it } from 'vitest';
import { dyPatil, optimiseProfile, probeWaits, runRedTeam } from '../index';

describe('red team', () => {
  it('stress-tests the recommended plan and finds a backup for the worst night', () => {
    const waits = probeWaits(dyPatil);
    const plan = optimiseProfile(dyPatil, 'Zero rupees', waits).chosen;
    const t0 = performance.now();
    const rt = runRedTeam(dyPatil, plan);
    const ms = performance.now() - t0;
    console.log('red team', rt.survived, '/', rt.total, 'headline', rt.headline, 'ms', Math.round(ms));
    console.log('worst', rt.worst.labels, rt.worst.planCrush, 'none', rt.worst.noneCrush);
    console.log('breaks when', rt.breaksWhen);
    console.log('backup', rt.backup && rt.backup.chosen.map((c) => c.label), rt.backup && rt.backup.crush);
    expect(rt.total).toBe(192);
    expect(rt.survived).toBeGreaterThan(0);
    console.log('tiers', rt.tiers);
    expect(rt.tiers.safe + rt.tiers.better + rt.tiers.same + rt.tiers.worse).toBe(192);
    // the worst night must get a backup that beats the plan on that night
    expect(rt.backup).not.toBeNull();
    expect(rt.backup!.crush).toBeLessThan(rt.worst.planCrush);
  });
});
