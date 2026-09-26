/*
 * Dynamic Telegram messages for the monitor loop (SOURCE_OF_TRUTH §13/§14.4's rule extended to the
 * live-ops brief): every message is built from a structured payload of real state — a lever, a
 * SimResult, a deadline — never free text. Fixed English templates here; lib/console.ts's
 * sendTelegramAlert() may pass the built text through the existing number-safe reword endpoint
 * (app/api/llm/polish) for tone/language, which rejects any output that changes a number and falls
 * back to exactly this text. No message type here ever reaches attendees — these are ops-channel
 * only, the same channel lib/telegram.ts has always sent staff/transport/accommodation orders to.
 */
import { clockFor, type Lever, type Scenario } from '@/engine';

export type AlertKind = 'new_action' | 'action_expiring' | 'status_changed' | 'tripwire_fired' | 'action_stopped_working' | 'decision_recorded';

export interface TelegramAlert {
  kind: AlertKind;
  kindLabel: string;
  /** also the dedupe key — see lib/console.ts's sentOrders */
  title: string;
  text: string;
}

const clock = (scn: Scenario, t: number) => clockFor(scn, t);

export function newActionAlert(scn: Scenario, lever: Lever, deadlineTick: number | null, reason: string): TelegramAlert {
  return {
    kind: 'new_action',
    kindLabel: 'New move',
    title: `New move: ${lever.label}`,
    text: `${reason} Pravaah now recommends: ${lever.label}.${deadlineTick != null ? ` Best before ${clock(scn, deadlineTick)}.` : ''} Not yet approved — open Live Ops to act.`,
  };
}

export function actionExpiringAlert(scn: Scenario, lever: Lever, deadlineTick: number, minutesLeft: number): TelegramAlert {
  return {
    kind: 'action_expiring',
    kindLabel: 'Move expiring',
    title: `Expiring: ${lever.label}`,
    text: `"${lever.label}" closes at ${clock(scn, deadlineTick)}, ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'} from now, unanswered. If it passes unanswered, Pravaah will re-plan without it and log the closure. Open Live Ops to act or skip it.`,
  };
}

export function statusChangedAlert(status: 'watch' | 'act', sub: string): TelegramAlert {
  return {
    kind: 'status_changed',
    kindLabel: 'Status update',
    title: `Status: ${status === 'act' ? 'Act now' : 'Watch'}`,
    text: `Live Ops status is now "${status === 'act' ? 'Act now' : 'Watch'}". ${sub}`,
  };
}

export function tripwireFiredAlert(label: string, failRatePct: number, backupLevers: string[]): TelegramAlert {
  return {
    kind: 'tripwire_fired',
    kindLabel: 'Tripwire',
    title: `Tripwire: ${label}`,
    text: `Observed: ${label}. Red Team already found this breaks the current plan ${failRatePct}% of the time. Pravaah is proposing the backup it already found for a night like this: ${backupLevers.join('; ') || 'no backup levers needed'}. Not yet approved — open Live Ops to act.`,
  };
}

export function actionStoppedWorkingAlert(planName: string, wasCrush: number, nowCrush: number): TelegramAlert {
  return {
    kind: 'action_stopped_working',
    kindLabel: 'Stopped working',
    title: `Stopped working: ${planName}`,
    text: `"${planName}" stopped working: it was tracking ${wasCrush} dangerous minutes, now ${nowCrush} under what's actually been observed since. A new move is ready in Live Ops.`,
  };
}

export function decisionRecordedAlert(leverLabel: string, decision: 'approved' | 'skipped', atTick: number, scn: Scenario): TelegramAlert {
  return {
    kind: 'decision_recorded',
    kindLabel: 'Decision recorded',
    title: `Decision: ${decision} — ${leverLabel} @ ${clock(scn, atTick)}`,
    text: `Event head ${decision} "${leverLabel}" at ${clock(scn, atTick)}. Logged to the Black Box.`,
  };
}
