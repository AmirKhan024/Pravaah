'use client';
import { Button, Kicker } from '@/components/ui';
import { nextId, type OwnerEntrance, type OwnerVenue } from '@/lib/owner/types';
import { TrustPill } from './TrustPill';

const cell = 'rounded-md border border-line bg-panel-2 px-2 py-1.5 text-[13px] text-text w-full';

/** Display-only: which named entrance feeds which gate. Doesn't feed the simulation on its own —
 *  ps8's gates.csv already IS the entrance (see docs/DECISIONS.md) — but it's real information for
 *  staff/signage and it earns its own trust pill like everything else here. */
export function EntrancesTable({ v, onChange }: { v: OwnerVenue; onChange: (v: OwnerVenue) => void }) {
  const set = (id: string, patch: Partial<OwnerEntrance>) => onChange({ ...v, entrances: v.entrances.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const remove = (id: string) => onChange({ ...v, entrances: v.entrances.filter((e) => e.id !== id) });
  const add = () => v.gates[0] && onChange({ ...v, entrances: [...v.entrances, { id: nextId('E'), name: `Entrance ${v.entrances.length + 1}`, gateId: v.gates[0].id, trust: 'claimed' }] });

  return (
    <div>
      <Kicker right={<span>{v.entrances.length} entrance{v.entrances.length === 1 ? '' : 's'}</span>}>Entrances</Kicker>
      {v.entrances.length ? (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[1.4fr_1fr_auto_auto] gap-2 px-1 text-[10.5px] uppercase tracking-[.1em] text-dimmer">
            <span>Name</span>
            <span>Feeds gate</span>
            <span>Trust</span>
            <span />
          </div>
          {v.entrances.map((e) => (
            <div key={e.id} className="grid grid-cols-[1.4fr_1fr_auto_auto] items-center gap-2 rounded-lg border border-line-soft bg-panel/40 p-1.5">
              <input className={cell} value={e.name} onChange={(ev) => set(e.id, { name: ev.target.value })} />
              <select className={cell} value={e.gateId} onChange={(ev) => set(e.id, { gateId: ev.target.value })}>
                {v.gates.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <TrustPill trust={e.trust} onChange={(trust) => set(e.id, { trust })} />
              <Button size="sm" variant="quiet" onClick={() => remove(e.id)}>
                ✕
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12.5px] text-dimmer">No named entrances yet — gates are used directly.</p>
      )}
      <Button size="sm" className="mt-2" onClick={add} disabled={!v.gates.length}>
        + Add entrance
      </Button>
    </div>
  );
}
