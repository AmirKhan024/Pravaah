'use client';
import { Button, Kicker, Pill } from '@/components/ui';
import type { ColumnMapping, MappingResult, ParsedInput } from '@/lib/registrations/types';

const FIELD_LABELS: Record<keyof ColumnMapping, string> = { origin: 'Origin', mode: 'Travel mode', gate: 'Gate preference', partySize: 'Group size' };
const cell = 'rounded-md border border-line bg-panel-2 px-2 py-1.5 text-[13px] text-text';

/** Step 2: "How Pravaah understood it" — the mapping (or, for free text, the extracted rows) as a
 *  small, editable table with one confirm button. */
export function MappingTable({
  parsed,
  mapping,
  onChangeMapping,
  offline,
}: {
  parsed: ParsedInput;
  mapping: MappingResult;
  onChangeMapping: (m: ColumnMapping) => void;
  offline: boolean;
}) {
  return (
    <div>
      <Kicker right={<span>{offline ? 'Offline mode — fuzzy matching' : mapping.source === 'groq' ? 'Groq' : 'Fuzzy matching'}</span>}>How Pravaah understood it</Kicker>
      {mapping.kind === 'columns' ? (
        <div className="flex flex-col gap-2">
          {(Object.keys(FIELD_LABELS) as (keyof ColumnMapping)[]).map((f) => (
            <div key={f} className="grid grid-cols-[1fr_1.4fr] items-center gap-2 rounded-lg border border-line-soft bg-panel/40 p-2">
              <span className="text-[13px] text-dim">{FIELD_LABELS[f]}</span>
              <select className={cell} value={mapping.mapping[f] ?? ''} onChange={(e) => onChangeMapping({ ...mapping.mapping, [f]: e.target.value || null })}>
                <option value="">— not present —</option>
                {(parsed.headers || []).map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {Object.keys(mapping.normalize.mode).length ? (
            <p className="text-[11.5px] text-dimmer">
              Travel-mode normalisation: {Object.entries(mapping.normalize.mode).map(([k, v]) => `"${k}" → ${v}`).join(', ')}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line-soft">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-line-soft bg-panel/60 text-dimmer">
                <th className="px-2 py-1.5 font-medium">Origin</th>
                <th className="px-2 py-1.5 font-medium">Mode</th>
                <th className="px-2 py-1.5 font-medium">Gate</th>
                <th className="px-2 py-1.5 font-medium">Size</th>
                <th className="px-2 py-1.5 font-medium">Source line</th>
              </tr>
            </thead>
            <tbody>
              {mapping.rows.slice(0, 20).map((r, i) => (
                <tr key={i} className="border-b border-line-soft/60 last:border-0">
                  <td className="px-2 py-1.5 text-dim">{r.origin}</td>
                  <td className="px-2 py-1.5 text-dim">{r.mode || '—'}</td>
                  <td className="px-2 py-1.5 text-dim">{r.gate || '—'}</td>
                  <td className="px-2 py-1.5 text-dim">{r.partySize}</td>
                  <td className="max-w-[260px] truncate px-2 py-1.5 text-dimmer" title={r.sourceLine}>
                    {r.sourceLine}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {mapping.rejected ? <p className="mt-1 text-[11.5px] text-dimmer">{mapping.rejected} extracted row(s) dropped — their number didn&apos;t appear in the quoted text.</p> : null}
        </div>
      )}
      {offline ? <Pill tone="brass">offline mode — matched by header/word patterns, not Groq</Pill> : null}
    </div>
  );
}
