import { simulate, type Intervention, type Scenario, type SimResult } from '@/engine';

const cache = new Map<string, SimResult>();
/** lite run of a plan on the main thread (~8 ms), memoised by lever labels */
export function planResult(scn: Scenario, ivs: Intervention[], waits: Record<string, number>): SimResult {
  const key = scn.id + '|' + JSON.stringify(ivs);
  let r = cache.get(key);
  if (!r) {
    r = simulate(scn, ivs, { waits, lite: true });
    cache.set(key, r);
    if (cache.size > 200) cache.delete(cache.keys().next().value!);
  }
  return r;
}
