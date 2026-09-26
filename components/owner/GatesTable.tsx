'use client';
import { Button, Kicker } from '@/components/ui';
import { gatePeoplePerMin } from '@/lib/owner/store';
import { nextId, SIDES, trusted, type OwnerGate, type OwnerVenue } from '@/lib/owner/types';
import { TrustPill } from './TrustPill';

const cell = 'rounded-md border border-line bg-panel-2 px-2 py-1.5 text-[13px] text-text w-full';

/** Gates: lanes and forecourt m² are the two real, editable numbers that feed the simulation
 *  directly. "People/min" is shown but computed (lanes × the engine's one global lane-rate) — see
 *  docs/DECISIONS.md for why this isn't a second per-gate editable field. */
export function GatesTable({ v, onChange }: { v: OwnerVenue; onChange: (v: OwnerVenue) => void }) {
  const set = (id: string, patch: Partial<OwnerGate>) => onChange({ ...v, gates: v.gates.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
  const remove = (id: string) => v.gates.length > 1 && onChange({ ...v, gates: v.gates.filter((g) => g.id !== id) });
  const add = () => onChange({ ...v, gates: [...v.gates, { id: nextId('G'), name: `Gate ${v.gates.length + 1}`, side: 'north', lanes: trusted(4), forecourtAreaM2: trusted(1000) }] });

  return (
    <div>
      <Kicker right={<span>{v.gates.length} gate{v.gates.length === 1 ? '' : 's'}</span>}>Gates</Kicker>
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-[1.4fr_1fr_0.9fr_0.9fr_1fr_auto] gap-2 px-1 text-[10.5px] uppercase tracking-[.1em] text-dimmer">
          <span>Name</span>
          <span>Side</span>
          <span>Lanes</span>
          <span>Forecourt m²</span>
          <span>People/min</span>
          <span />
        </div>
        {v.gates.map((g) => (
          <div key={g.id} className="grid grid-cols-[1.3fr_0.9fr_1fr_1.1fr_0.8fr_auto] items-start gap-2 rounded-lg border border-line-soft bg-panel/40 p-1.5">
            <input className={cell} value={g.name} onChange={(e) => set(g.id, { name: e.target.value })} />
            <select className={cell} value={g.side} onChange={(e) => set(g.id, { side: e.target.value as OwnerGate['side'] })}>
              {SIDES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <div className="flex flex-col items-start gap-1">
              <input
                className={cell}
                inputMode="numeric"
                value={g.lanes.value}
                onChange={(e) => set(g.id, { lanes: trusted(Math.max(1, Math.round(Number(e.target.value) || 1)), g.lanes.trust) })}
              />
              <TrustPill trust={g.lanes.trust} onChange={(trust) => set(g.id, { lanes: trusted(g.lanes.value, trust) })} />
            </div>
            <div className="flex flex-col items-start gap-1">
              <input
                className={cell}
                inputMode="numeric"
                value={g.forecourtAreaM2.value}
                onChange={(e) => set(g.id, { forecourtAreaM2: trusted(Math.max(1, Math.round(Number(e.target.value) || 1)), g.forecourtAreaM2.trust) })}
              />
              <TrustPill trust={g.forecourtAreaM2.trust} onChange={(trust) => set(g.id, { forecourtAreaM2: trusted(g.forecourtAreaM2.value, trust) })} />
            </div>
            <span className="num px-2 py-1.5 text-[13px] text-dim">{gatePeoplePerMin(g).toLocaleString('en-IN')}</span>
            <Button size="sm" variant="quiet" onClick={() => remove(g.id)} disabled={v.gates.length <= 1}>
              ✕
            </Button>
          </div>
        ))}
      </div>
      <Button size="sm" className="mt-2" onClick={add}>
        + Add gate
      </Button>
    </div>
  );
}
