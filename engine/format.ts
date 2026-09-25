import type { Scenario } from './types';

/** tick → HH:MM on the scenario's clock */
export const clockFor = (scn: Pick<Scenario, 't0Min'>, t: number) => {
  const m = scn.t0Min + Math.round(t);
  return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(((m % 60) + 60) % 60).padStart(2, '0');
};
export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
export const comma = (n: number) => Math.round(n).toLocaleString('en-IN');
export const gateName = (id: string) => id.replace(/^gate/, 'Gate ');
