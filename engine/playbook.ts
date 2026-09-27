/*
 * The Timeline slice's "do by" dates (SOURCE_OF_TRUTH-adjacent, additive). A small, editable table
 * of standing operational actions (data/playbooks.csv) — action/owner/lead_days/trigger, each
 * tagged 'playbook' (SOURCE_OF_TRUTH §honesty: a playbook row is never presented as simulated).
 * A handful of rows also carry a `lever_type`, which lets code (never the row itself) test that
 * action against whichever snapshot/scenario is currently loaded and report a real, simulated
 * "removes ~N dangerous minutes" benefit — the row stays 'playbook'; only the benefit number, if
 * present, is 'simulated'. Pure TS, no fs/DOM — callers parse CSV text with engine/csv.ts.
 */
import type { Intervention, Scenario, SimOptions, SimResult } from './types';
import { simulate } from './simulate';

export type PlaybookLeverType = '' | 'house' | 'lanes';

export interface PlaybookRow {
  action: string;
  owner: string;
  lead_days: string;
  trigger: string;
  lever_type: string;
  status: string;
  source_note: string;
}

export interface PlaybookAction {
  id: string;
  action: string;
  owner: string;
  /** null = not tied to a fixed day count before match (a rare row; none of the bundled rows use this today) */
  leadDays: number | null;
  trigger: string;
  leverType: PlaybookLeverType;
}

export function parsePlaybook(rows: PlaybookRow[]): PlaybookAction[] {
  return rows
    .map((r, i) => {
      const lead = Number(r.lead_days);
      const lt = (r.lever_type || '').trim();
      return {
        id: 'pb_' + i,
        action: r.action?.trim() || '',
        owner: r.owner?.trim() || '',
        leadDays: Number.isFinite(lead) && r.lead_days?.trim() ? lead : null,
        trigger: r.trigger?.trim() || '',
        leverType: (lt === 'house' || lt === 'lanes' ? lt : '') as PlaybookLeverType,
      };
    })
    .filter((a) => a.action);
}

/** Calendar-date arithmetic on plain "YYYY-MM-DD" strings, UTC-anchored so a day is always a day
 *  regardless of the browser's local timezone/DST. */
export function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.parse(fromISO + 'T00:00:00Z');
  const b = Date.parse(toISO + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}
export function addDays(iso: string, days: number): string {
  const d = new Date(Date.parse(iso + 'T00:00:00Z') + days * 86400000);
  return d.toISOString().slice(0, 10);
}
/** the brief's own default: 60 days out from "today", never in the past */
export function defaultMatchDateISO(todayISO: string): string {
  return addDays(todayISO, 60);
}

export interface DoByAction extends PlaybookAction {
  doByISO: string;
  daysUntilDue: number;
  /** true once the do-by date itself has passed (still shown — a late action is more urgent, never hidden) */
  overdue: boolean;
  /** dangerous minutes this action would remove if applied now, against whichever scenario/snapshot
   *  is currently loaded — present only for rows with a leverType; a real simulate() run, not a guess */
  benefitMin: number | null;
}

/** Picks the gate with the longest peak wait right now — the "busiest gate" a lanes-type playbook
 *  row targets, so the benefit is computed against whatever the loaded data actually shows, never
 *  a hardcoded gate id. */
function busiestGate(base: SimResult): string | null {
  let best: string | null = null,
    bestWait = -1;
  for (const [gate, wait] of Object.entries(base.gateWaitPeak)) {
    if (wait > bestWait) {
      bestWait = wait;
      best = gate;
    }
  }
  return bestWait > 0 ? best : null;
}

/** The one simulate() call a benefit-bearing playbook row needs: apply its lever to `scn` from
 *  `fromTick` onward and diff against `base`'s dangerous minutes. Returns null (never presented as
 *  simulated) when the row has no leverType, or (for `lanes`) no gate is actually under pressure. */
export function playbookBenefit(scn: Scenario, base: SimResult, action: PlaybookAction, fromTick: number, opts: SimOptions = {}): number | null {
  let iv: Intervention | null = null;
  if (action.leverType === 'house') iv = { type: 'house', decisionTick: fromTick, label: action.action };
  else if (action.leverType === 'lanes') {
    const gate = busiestGate(base);
    if (!gate) return null;
    iv = { type: 'lanes', gate, n: 3, from: fromTick, label: action.action };
  }
  if (!iv) return null;
  const r = simulate(scn, [iv], opts);
  return Math.max(0, base.crushMin - r.crushMin);
}

/** Every action whose do-by date falls within `windowDays` of `todayISO` (default: everything not
 *  yet done), nearest-due first, each carrying its benefit if the row is simulate-able. This is
 *  what Live Ops's Timeline row shows as "the next 1 to 3 actions with DATE deadlines." */
export function dueActions(actions: PlaybookAction[], matchDateISO: string, todayISO: string, scn: Scenario, base: SimResult, fromTick: number, opts: SimOptions = {}): DoByAction[] {
  return actions
    .filter((a) => a.leadDays != null)
    .map((a) => {
      const doByISO = addDays(matchDateISO, -(a.leadDays as number));
      const daysUntilDue = daysBetween(todayISO, doByISO);
      return {
        ...a,
        doByISO,
        daysUntilDue,
        overdue: daysUntilDue < 0,
        benefitMin: playbookBenefit(scn, base, a, fromTick, opts),
      };
    })
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}
