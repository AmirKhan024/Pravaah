/*
 * Slice 1's "do by" dates: the playbook table (data/playbooks.csv) parses cleanly, calendar
 * arithmetic is exact, and a leverType row's benefit is a real simulate() diff, not a guess.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCsv } from '../csv';
import { loadScenarioFromRows, type ArrivalRow, type CsvScenarioInput, type EventRow, type GateRow, type HotelRow, type ResourceRow, type TicketRow } from '../dataLoader';
import { addDays, daysBetween, defaultMatchDateISO, dueActions, parsePlaybook, playbookBenefit, type PlaybookRow } from '../playbook';
import { probeWaits, simulate } from '../simulate';

const DIR = join(__dirname, '../../data/sample/dy-patil');
const readRows = <T>(file: string): T[] => parseCsv(readFileSync(join(DIR, file), 'utf8')) as unknown as T[];

function sampleInput(): CsvScenarioInput {
  return {
    event: readRows<EventRow>('event.csv'),
    gates: readRows<GateRow>('gates.csv'),
    tickets: readRows<TicketRow>('tickets.csv'),
    arrivals: readRows<ArrivalRow>('arrivals.csv'),
    hotels: readRows<HotelRow>('hotels.csv'),
    resources: readRows<ResourceRow>('resources.csv'),
  };
}
function playbookRows(): PlaybookRow[] {
  return parseCsv(readFileSync(join(__dirname, '../../data/playbooks.csv'), 'utf8')) as unknown as PlaybookRow[];
}

describe('calendar arithmetic', () => {
  it('addDays/daysBetween round-trip across a month boundary', () => {
    expect(addDays('2026-09-27', 60)).toBe('2026-11-26');
    expect(daysBetween('2026-09-27', '2026-11-26')).toBe(60);
    expect(daysBetween('2026-11-26', '2026-09-27')).toBe(-60);
  });
  it('defaultMatchDateISO is exactly 60 days out — never in the past by construction', () => {
    expect(defaultMatchDateISO('2026-09-27')).toBe('2026-11-26');
  });
});

describe('parsePlaybook (data/playbooks.csv)', () => {
  const actions = parsePlaybook(playbookRows());
  it('parses every bundled row, matching the brief\'s own worked examples', () => {
    expect(actions.length).toBeGreaterThanOrEqual(4);
    const byLead = new Map(actions.map((a) => [a.leadDays, a.action]));
    expect(byLead.get(30)).toMatch(/hotel/i);
    expect(byLead.get(14)).toBeDefined();
    expect(byLead.get(3)).toMatch(/staff/i);
    expect(byLead.get(7)).toMatch(/guide/i);
  });
  it('leaves leverType empty for rows with no lever_type column value', () => {
    const staffBrief = actions.find((a) => a.leadDays === 3)!;
    expect(staffBrief.leverType).toBe('');
  });
});

describe('playbookBenefit + dueActions (against the real sample scenario)', () => {
  const res = loadScenarioFromRows(sampleInput(), { venueLabel: 'DY Patil Stadium (sample fixture)' });
  if (!res.ok) throw new Error('sample fixture failed to load: ' + res.errors.join('; '));
  const scn = res.data.scenario;
  const waits = probeWaits(scn);
  const base = simulate(scn, [], { waits });
  const actions = parsePlaybook(playbookRows());

  it('a house-type row never reports a benefit worse than doing nothing', () => {
    const houseRow = actions.find((a) => a.leverType === 'house')!;
    const benefit = playbookBenefit(scn, base, houseRow, scn.gatesOpenTick, { waits });
    expect(benefit).not.toBeNull();
    expect(benefit!).toBeGreaterThanOrEqual(0);
  });
  it('a non-simulated row (no leverType) always reports a null benefit — never presented as simulated', () => {
    const staffBrief = actions.find((a) => a.leadDays === 3)!;
    expect(playbookBenefit(scn, base, staffBrief, scn.gatesOpenTick, { waits })).toBeNull();
  });
  it('dueActions sorts nearest-due first and flags a past do-by date as overdue', () => {
    const due = dueActions(actions, '2026-12-25', '2026-12-20', scn, base, scn.gatesOpenTick, { waits });
    for (let i = 1; i < due.length; i++) expect(due[i].daysUntilDue).toBeGreaterThanOrEqual(due[i - 1].daysUntilDue);
    const staffBrief = due.find((a) => a.leadDays === 3)!; // do-by 2026-12-22, today 2026-12-20 -> not yet overdue
    expect(staffBrief.overdue).toBe(false);
    const lateCheck = dueActions(actions, '2026-12-25', '2026-12-24', scn, base, scn.gatesOpenTick, { waits }).find((a) => a.leadDays === 3)!;
    expect(lateCheck.overdue).toBe(true); // do-by 2026-12-22 has passed by 2026-12-24
  });

  it('trigger-conditional rows (no lead_days — the weather/postponement playbook items) are hidden unless weatherTriggered is true', () => {
    const withoutWeather = dueActions(actions, '2026-12-25', '2026-12-20', scn, base, scn.gatesOpenTick, { waits }, false);
    expect(withoutWeather.some((a) => a.leadDays == null)).toBe(false);
    const withWeather = dueActions(actions, '2026-12-25', '2026-12-20', scn, base, scn.gatesOpenTick, { waits }, true);
    const triggered = withWeather.filter((a) => a.leadDays == null);
    expect(triggered.length).toBeGreaterThanOrEqual(3); // hotel-extension window, refund policy, re-entry rule
    expect(triggered.every((a) => a.doByISO === '2026-12-20' && a.daysUntilDue === 0 && !a.overdue)).toBe(true);
    expect(triggered.some((a) => /hotel-extension/i.test(a.action))).toBe(true);
    expect(triggered.some((a) => /refund/i.test(a.action))).toBe(true);
    expect(triggered.some((a) => /re-entry/i.test(a.action))).toBe(true);
  });
});
