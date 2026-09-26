'use client';
import { Kicker, Pill } from '@/components/ui';
import type { ApplyResult } from '@/lib/registrations/types';

/** Step 3: "Clean groups out" — groups with sizes, tagged status=provided (real, from what was
 *  uploaded), plus a small honest count of what couldn't be mapped. */
export function CleanGroupsOut({ result }: { result: ApplyResult }) {
  return (
    <div>
      <Kicker right={<span>{result.keptPeople.toLocaleString('en-IN')} people in {result.groups.length} group{result.groups.length === 1 ? '' : 's'}</span>}>Clean groups out</Kicker>
      <div className="overflow-x-auto rounded-lg border border-line-soft">
        <table className="w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-line-soft bg-panel/60 text-dimmer">
              <th className="px-2 py-1.5 font-medium">Origin</th>
              <th className="px-2 py-1.5 font-medium">Mode</th>
              <th className="px-2 py-1.5 font-medium">Gate</th>
              <th className="px-2 py-1.5 font-medium">Size</th>
              <th className="px-2 py-1.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {result.groups.map((g) => (
              <tr key={g.key} className="border-b border-line-soft/60 last:border-0">
                <td className="px-2 py-1.5 text-text">{g.origin}</td>
                <td className="px-2 py-1.5 text-dim">{g.mode}</td>
                <td className="px-2 py-1.5 text-dim">{g.gateName}</td>
                <td className="num px-2 py-1.5 text-text">{g.size.toLocaleString('en-IN')}</td>
                <td className="px-2 py-1.5">
                  <Pill tone="safe">provided</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.needsReview.length ? (
        <p className="mt-2 text-[12px] text-dimmer">
          Needs review: {result.needsReview.map((r) => `${r.count} row${r.count === 1 ? '' : 's'} (${r.reason})`).join(', ')} — out of {result.totalRows} rows read.
        </p>
      ) : (
        <p className="mt-2 text-[12px] text-dimmer">All {result.totalRows} rows mapped cleanly.</p>
      )}
    </div>
  );
}
