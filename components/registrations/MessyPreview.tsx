'use client';
import { Kicker } from '@/components/ui';
import type { ParsedInput } from '@/lib/registrations/types';

/** Step 1: "Messy file in" — five raw rows/lines, exactly as they came in. */
export function MessyPreview({ parsed }: { parsed: ParsedInput }) {
  const rows = parsed.kind === 'text' ? parsed.lines.slice(0, 5) : parsed.rows.slice(0, 5);
  return (
    <div>
      <Kicker right={<span>{parsed.totalRows} row{parsed.totalRows === 1 ? '' : 's'} detected · {parsed.kind.toUpperCase()}</span>}>Messy file in</Kicker>
      {parsed.kind === 'text' ? (
        <div className="flex flex-col gap-1 rounded-lg border border-line-soft bg-panel/40 p-3 font-mono text-[12px] text-dim">
          {(rows as string[]).map((l, i) => (
            <div key={i} className="truncate">
              {l}
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line-soft">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-line-soft bg-panel/60 text-dimmer">
                {(parsed.headers || []).map((h) => (
                  <th key={h} className="whitespace-nowrap px-2 py-1.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(rows as Record<string, string>[]).map((r, i) => (
                <tr key={i} className="border-b border-line-soft/60 last:border-0">
                  {(parsed.headers || []).map((h) => (
                    <td key={h} className="whitespace-nowrap px-2 py-1.5 text-dim">
                      {r[h]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
