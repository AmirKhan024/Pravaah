/*
 * Every dynamic Telegram message is built from real data (a lever, a SimResult, a deadline) —
 * pinning that no message text contains a placeholder, an undefined, or a number that didn't come
 * from an argument the caller supplied.
 */
import { describe, expect, it } from 'vitest';
import { dyPatil } from '@/engine';
import { actionExpiringAlert, actionStoppedWorkingAlert, decisionRecordedAlert, newActionAlert, statusChangedAlert, tripwireFiredAlert } from '../telegramMessages';

const lever = { type: 'lanes', gate: 'gate3', n: 8, from: 120, label: 'Open 8 more screening lanes at Gate 3 from 18:20' } as const;

describe('telegram alert builders', () => {
  it('newActionAlert includes the lever label and, when given one, the deadline clock time', () => {
    const a = newActionAlert(dyPatil, lever, 300, 'Re-ranked from 17:50 under what has been observed.');
    expect(a.title).toContain(lever.label);
    expect(a.text).toContain(lever.label);
    expect(a.text).toMatch(/\d{2}:\d{2}/);
    expect(a.kind).toBe('new_action');
  });
  it('newActionAlert omits a deadline clause when there is no deadline', () => {
    const a = newActionAlert(dyPatil, lever, null, 'Reason.');
    expect(a.text).not.toContain('Best before');
  });
  it('actionExpiringAlert states the real deadline and minutes left, not a placeholder', () => {
    const a = actionExpiringAlert(dyPatil, lever, 300, 12);
    expect(a.text).toContain('12 minutes');
    expect(a.title).toBe(`Expiring: ${lever.label}`);
  });
  it('statusChangedAlert names the real status word', () => {
    const act = statusChangedAlert('act', 'A move needs a decision now.');
    expect(act.title).toBe('Status: Act now');
    const watch = statusChangedAlert('watch', 'A move is coming due soon.');
    expect(watch.title).toBe('Status: Watch');
  });
  it('tripwireFiredAlert carries the real fail rate and the real backup levers, never invented ones', () => {
    const a = tripwireFiredAlert('heavy rain', 78, ['Open 8 more screening lanes at Gate 3 from 18:20']);
    expect(a.text).toContain('78%');
    expect(a.text).toContain('Open 8 more screening lanes at Gate 3 from 18:20');
    expect(a.kind).toBe('tripwire_fired');
  });
  it('actionStoppedWorkingAlert states the real before/after crush-minute counts', () => {
    const a = actionStoppedWorkingAlert('Zero rupees', 12, 27);
    expect(a.text).toContain('12 dangerous minutes');
    expect(a.text).toContain('now 27');
  });
  it('decisionRecordedAlert distinguishes approved vs. skipped', () => {
    const approved = decisionRecordedAlert(lever.label, 'approved', 250, dyPatil);
    expect(approved.text).toContain('approved');
    const skipped = decisionRecordedAlert(lever.label, 'skipped', 250, dyPatil);
    expect(skipped.text).toContain('skipped');
  });
});
