/*
 * Slice 1's T-90..Match night step list, built from the real sample dataset — checks the step
 * order, the synthetic "Match night" step, and the plain "when does it become a problem" sentence.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCsv, type ArrivalRow, type CsvScenarioInput, type EventRow, type GateRow, type HotelRow, type ResourceRow, type TicketRow } from '@/engine';
import { buildTimelineData, daysBetweenISO, stepForDate, timelineSentence } from '../timeline';

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

describe('buildTimelineData', () => {
  const tl = buildTimelineData(sampleInput(), '2026-12-25', 'DY Patil Stadium (sample fixture)')!;

  it('derives all 5 tickets.csv snapshots plus a synthetic Match night step, in descending days order', () => {
    expect(tl).not.toBeNull();
    expect(tl.steps.map((s) => s.label)).toEqual(['T-90', 'T-60', 'T-30', 'T-7', 'T-1', 'Match night']);
    expect(tl.steps.map((s) => s.days)).toEqual([90, 60, 30, 7, 1, 0]);
  });

  it('rebases each step\'s date relative to the match date, not to tickets.csv\'s own absolute snapshot_date', () => {
    // sample tickets.csv's own snapshot_date for T-90 is 2026-09-26 -- a different match date must rebase it
    const t90 = tl.steps.find((s) => s.label === 'T-90')!;
    expect(t90.dateISO).toBe('2026-09-26'); // 2026-12-25 - 90 days
    expect(tl.steps.find((s) => s.label === 'Match night')!.dateISO).toBe('2026-12-25');
  });

  it('"Match night" carries the same dangerous-minute count as the final (T-1) snapshot', () => {
    const t1 = tl.steps.find((s) => s.label === 'T-1')!;
    const matchNight = tl.steps.find((s) => s.label === 'Match night')!;
    expect(matchNight.crushMin).toBe(t1.crushMin);
  });

  it('dangerous minutes are non-decreasing as the match approaches, in this calibrated sample', () => {
    const planning = tl.steps.filter((s) => s.label !== 'Match night');
    for (let i = 1; i < planning.length; i++) expect(planning[i].crushMin).toBeGreaterThanOrEqual(planning[i - 1].crushMin);
  });

  it('stepForDate snaps to the latest step at or before the given date, defaulting to the earliest step if none qualify', () => {
    expect(stepForDate(tl, '2026-11-20').label).toBe('T-60'); // between T-60 (10-26) and T-30 (11-25)
    expect(stepForDate(tl, '2026-01-01').label).toBe('T-90'); // before any snapshot -> earliest, not null
    expect(stepForDate(tl, '2026-12-25').label).toBe('Match night');
  });

  it('timelineSentence names the earliest step with dangerous minutes, in plain language', () => {
    const sentence = timelineSentence(tl);
    expect(sentence).toMatch(/T-\d+/);
    expect(sentence.toLowerCase()).toContain('dangerous minute');
  });
});

describe('daysBetweenISO', () => {
  it('is symmetric and exact', () => {
    expect(daysBetweenISO('2026-09-27', '2026-12-25')).toBe(89);
    expect(daysBetweenISO('2026-12-25', '2026-09-27')).toBe(-89);
  });
});
