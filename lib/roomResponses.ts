/*
 * The response taxonomy for The Room's realism upgrade, and the deterministic, hand-set config
 * that turns it into an acceptance estimate (SOURCE_OF_TRUTH §8.1, room-upgrade brief §9/§11/§18).
 *
 * A real crowd doesn't just say yes/no: some accept, some decline, some never answer, some answer
 * after the window closed, some say they'd already moved before the message even arrived. This
 * file is the one place that maps those states to a compliance estimate and decides how much a
 * small sample of real phones should move the model's own number — illustrative and documented,
 * exactly like the nudge acceptance model's own hand-calibrated constants (engine/simulate.ts).
 */

export type ResponseKind = 'accept' | 'decline' | 'ignore' | 'too_late' | 'already_moved';
export type GroupResponse = 'all' | 'individual' | 'none';

export const RESPONSE_KINDS: ResponseKind[] = ['accept', 'decline', 'already_moved', 'too_late', 'ignore'];
export const GROUP_RESPONSES: GroupResponse[] = ['all', 'individual', 'none'];

/**
 * Illustrative mapping from a response to an estimated compliance weight. Not fitted to field
 * data — a deliberately simple, documented placeholder. "Accepted" and "already moved" both count
 * as compliant; declining, staying silent, and answering too late do not.
 */
export const COMPLIANCE_WEIGHT: Record<ResponseKind, number> = {
  accept: 1,
  already_moved: 1,
  decline: 0,
  ignore: 0,
  too_late: 0,
};

/** For anything that still reads a plain yes/no (the phone's own footer tally, publishOutcome). */
export function deriveChoice(response: ResponseKind): 'yes' | 'no' {
  return COMPLIANCE_WEIGHT[response] > 0 ? 'yes' : 'no';
}

/** Below this many settled responses, the room's observed rate carries no weight at all (§18). */
export const MIN_RESPONSES_FOR_OVERRIDE = 5;
/** At or above this many, the observed rate fully replaces the model's estimate (§18). */
export const STRONG_SAMPLE_THRESHOLD = 20;
/** Below this many timed responses, a response-time figure is not shown (§15). */
export const RESPONSE_TIME_MIN_SAMPLE = 5;

/** 0 below MIN_RESPONSES_FOR_OVERRIDE, ramping linearly to 1 at STRONG_SAMPLE_THRESHOLD. */
export function blendWeight(n: number): number {
  if (n < MIN_RESPONSES_FOR_OVERRIDE) return 0;
  if (n >= STRONG_SAMPLE_THRESHOLD) return 1;
  return (n - MIN_RESPONSES_FOR_OVERRIDE) / (STRONG_SAMPLE_THRESHOLD - MIN_RESPONSES_FOR_OVERRIDE);
}

export function parseResponse(x: unknown): ResponseKind | null {
  return typeof x === 'string' && (RESPONSE_KINDS as string[]).includes(x) ? (x as ResponseKind) : null;
}
export function parseGroupResponse(x: unknown): GroupResponse | null {
  return typeof x === 'string' && (GROUP_RESPONSES as string[]).includes(x) ? (x as GroupResponse) : null;
}

/**
 * Server-side reclassification — never trust the client for timing (§29). A submitted
 * accept/decline that arrives after the broadcast's countdown closed becomes too_late.
 * already_moved is a claim about something that already happened, not a timeliness-dependent
 * choice, so it is left as-is: a deliberate judgment call, not an oversight.
 */
export function classifyServerResponse(submitted: ResponseKind, now: number, closesAt: number): ResponseKind {
  if (submitted === 'already_moved' || submitted === 'ignore' || submitted === 'too_late') return submitted;
  return now > closesAt ? 'too_late' : submitted;
}
