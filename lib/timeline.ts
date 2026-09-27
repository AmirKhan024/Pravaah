/*
 * Live Ops's Timeline row (Slice 1: "N days to match" + a T-90..Match night stepper). Pure data
 * shaping on top of engine/dataLoader.ts's already-built snapshot rescaling (opts.snapshot) and
 * engine/playbook.ts's do-by dates — this file just derives the step list from tickets.csv and
 * pre-runs one do-nothing simulate() per step for the "when does it become a problem?" chart.
 * lib/, not engine/, because it composes engine functions with CsvScenarioInput plumbing; no
 * fs/DOM either way.
 */
import { loadScenarioFromRows, probeWaits, simulate, type CsvScenarioInput } from '@/engine';

export interface TimelineStepPoint {
  label: string;
  /** days_before_match; 0 for the synthetic "Match night" step */
  days: number;
  dateISO: string;
  /** dangerous minutes in the do-nothing evening rebuilt at this snapshot's cohort sizes */
  crushMin: number;
}

export interface TimelineData {
  matchDateISO: string;
  venueLabel: string;
  /** descending by `days` — T-90 first, "Match night" (days: 0) last */
  steps: TimelineStepPoint[];
}

function distinctSnapshots(tickets: CsvScenarioInput['tickets']): { label: string; days: number }[] {
  const seen = new Map<string, number>();
  for (const t of tickets) {
    const d = Number(t.days_before_match);
    if (!t.snapshot_label || !Number.isFinite(d)) continue;
    if (!seen.has(t.snapshot_label)) seen.set(t.snapshot_label, d);
  }
  return [...seen.entries()].map(([label, days]) => ({ label, days })).sort((a, b) => b.days - a.days);
}

export function addDaysISO(iso: string, days: number): string {
  return new Date(Date.parse(iso + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
}
export function daysBetweenISO(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(toISO + 'T00:00:00Z') - Date.parse(fromISO + 'T00:00:00Z')) / 86400000);
}
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const defaultMatchDateISO = (today: string) => addDaysISO(today, 60);

/** Null when `input.tickets` carries no usable snapshot column (e.g. a bring-your-own dataset that
 *  only ever fills in the final snapshot) — the Timeline row then shows "Match night" only. */
export function buildTimelineData(input: CsvScenarioInput, matchDateISO: string, venueLabel: string): TimelineData | null {
  const snaps = distinctSnapshots(input.tickets);
  if (snaps.length < 2) return null; // one snapshot alone can't show "when does it become a problem"
  const steps: TimelineStepPoint[] = [];
  for (const { label, days } of snaps) {
    const res = loadScenarioFromRows(input, { snapshot: label, venueLabel });
    if (!res.ok) continue;
    const waits = probeWaits(res.data.scenario);
    const base = simulate(res.data.scenario, [], { waits });
    steps.push({ label, days, dateISO: addDaysISO(matchDateISO, -days), crushMin: base.crushMin });
  }
  if (!steps.length) return null;
  const final = steps[steps.length - 1]; // smallest days = closest to match, per dataLoader's own pickFinalSnapshot
  steps.push({ label: 'Match night', days: 0, dateISO: matchDateISO, crushMin: final.crushMin });
  return { matchDateISO, venueLabel, steps };
}

/** The step a given calendar date falls into: the latest step whose date is <= `dateISO` (i.e. "the
 *  most recent snapshot we actually have data for"), defaulting to the earliest step if the date is
 *  further out than any snapshot. */
export function stepForDate(tl: TimelineData, dateISO: string): TimelineStepPoint {
  const sorted = [...tl.steps].sort((a, b) => (a.dateISO < b.dateISO ? -1 : a.dateISO > b.dateISO ? 1 : 0));
  let pick = sorted[0];
  for (const s of sorted) {
    if (s.dateISO <= dateISO) pick = s;
  }
  return pick;
}

/** "Gate 3 becomes a problem around T-30." — the plain sentence under the chart, built from the
 *  data: the earliest step (closest to T-90) whose dangerous minutes are already >0. */
export function timelineSentence(tl: TimelineData): string {
  const planning = tl.steps.filter((s) => s.label !== 'Match night').sort((a, b) => b.days - a.days);
  const firstDanger = planning.find((s) => s.crushMin > 0);
  if (!firstDanger) return 'No step before match night shows any dangerous minutes in the do-nothing evening.';
  return `The do-nothing evening becomes a problem around ${firstDanger.label} (${firstDanger.crushMin} dangerous minute${firstDanger.crushMin === 1 ? '' : 's'}).`;
}
