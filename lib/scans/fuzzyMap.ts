/* Offline/Groq-failure fallback for scan-log column mapping — same convention as
 * lib/registrations/fuzzyMap.ts's fuzzyColumnMapping. Deterministic, no network. */
import type { ScanColumnMapping } from './types';

const SYN: Record<keyof ScanColumnMapping, RegExp> = {
  gate: /gate|door|entrance|checkpoint|stand/i,
  time: /time|minute|timestamp|clock/i,
  count: /count|scan|footfall|entries|entered|people|total/i,
};

export function fuzzyScanColumnMapping(headers: string[]): ScanColumnMapping {
  const pick = (re: RegExp) => headers.find((h) => re.test(h)) ?? null;
  return { gate: pick(SYN.gate), time: pick(SYN.time), count: pick(SYN.count) };
}
