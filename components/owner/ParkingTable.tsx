'use client';
import { Button, Kicker } from '@/components/ui';
import { nextId, trusted, type OwnerParking, type OwnerVenue } from '@/lib/owner/types';
import { TrustPill } from './TrustPill';

const cell = 'rounded-md border border-line bg-panel-2 px-2 py-1.5 text-[13px] text-text w-full';

export function ParkingTable({ v, onChange }: { v: OwnerVenue; onChange: (v: OwnerVenue) => void }) {
  const set = (id: string, patch: Partial<OwnerParking>) => onChange({ ...v, parking: v.parking.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const remove = (id: string) => onChange({ ...v, parking: v.parking.filter((p) => p.id !== id) });
  const add = () => onChange({ ...v, parking: [...v.parking, { id: nextId('P'), name: `Lot ${v.parking.length + 1}`, capacityVehicles: trusted(300), areaM2: trusted(5000) }] });

  return (
    <div>
      <Kicker right={<span>{v.parking.length} lot{v.parking.length === 1 ? '' : 's'}</span>}>Parking</Kicker>
      {v.parking.length ? (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_auto] gap-2 px-1 text-[10.5px] uppercase tracking-[.1em] text-dimmer">
            <span>Name</span>
            <span>Vehicles</span>
            <span>Area m²</span>
            <span />
          </div>
          {v.parking.map((p) => (
            <div key={p.id} className="grid grid-cols-[1.3fr_1fr_1.1fr_auto] items-start gap-2 rounded-lg border border-line-soft bg-panel/40 p-1.5">
              <input className={cell} value={p.name} onChange={(e) => set(p.id, { name: e.target.value })} />
              <div className="flex flex-col items-start gap-1">
                <input
                  className={cell}
                  inputMode="numeric"
                  value={p.capacityVehicles.value}
                  onChange={(e) => set(p.id, { capacityVehicles: trusted(Math.max(0, Math.round(Number(e.target.value) || 0)), p.capacityVehicles.trust) })}
                />
                <TrustPill trust={p.capacityVehicles.trust} onChange={(trust) => set(p.id, { capacityVehicles: trusted(p.capacityVehicles.value, trust) })} />
              </div>
              <div className="flex flex-col items-start gap-1">
                <input
                  className={cell}
                  inputMode="numeric"
                  value={p.areaM2.value}
                  onChange={(e) => set(p.id, { areaM2: trusted(Math.max(1, Math.round(Number(e.target.value) || 1)), p.areaM2.trust) })}
                />
                <TrustPill trust={p.areaM2.trust} onChange={(trust) => set(p.id, { areaM2: trusted(p.areaM2.value, trust) })} />
              </div>
              <Button size="sm" variant="quiet" onClick={() => remove(p.id)}>
                ✕
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12.5px] text-dimmer">No parking lots yet — self-drive arrivals use a default lot size until you add one.</p>
      )}
      <Button size="sm" className="mt-2" onClick={add}>
        + Add lot
      </Button>
    </div>
  );
}
