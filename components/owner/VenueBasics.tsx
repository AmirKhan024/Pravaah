'use client';
import { Kicker } from '@/components/ui';
import { trusted, type OwnerVenue } from '@/lib/owner/types';
import { TrustPill } from './TrustPill';

const input = 'rounded-lg border border-line bg-panel-2 px-3 py-2 text-text w-full';
const label = 'flex flex-col gap-1 text-[13px] text-dim';

export function VenueBasics({ v, onChange }: { v: OwnerVenue; onChange: (v: OwnerVenue) => void }) {
  return (
    <div>
      <Kicker>Venue</Kicker>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          Name
          <input className={input} value={v.name} onChange={(e) => onChange({ ...v, name: e.target.value })} />
        </label>
        <label className={label}>
          City
          <input className={input} value={v.city} onChange={(e) => onChange({ ...v, city: e.target.value })} />
        </label>
        <label className={label}>
          <span className="flex items-center justify-between">
            Capacity (expected turnout) <TrustPill trust={v.capacity.trust} onChange={(trust) => onChange({ ...v, capacity: trusted(v.capacity.value, trust) })} />
          </span>
          <input
            className={input}
            inputMode="numeric"
            value={v.capacity.value}
            onChange={(e) => onChange({ ...v, capacity: trusted(Math.max(0, Math.round(Number(e.target.value) || 0)), v.capacity.trust) })}
          />
        </label>
        <label className={label}>
          <span className="flex items-center justify-between">
            Number of exits <TrustPill trust={v.exits.trust} onChange={(trust) => onChange({ ...v, exits: trusted(v.exits.value, trust) })} />
          </span>
          <input
            className={input}
            inputMode="numeric"
            value={v.exits.value}
            onChange={(e) => onChange({ ...v, exits: trusted(Math.max(0, Math.round(Number(e.target.value) || 0)), v.exits.trust) })}
          />
        </label>
        <label className={label}>
          Date
          <input type="date" className={input} value={v.date} onChange={(e) => onChange({ ...v, date: e.target.value })} />
        </label>
        <label className={label}>
          Gates open
          <input className={input} placeholder="HH:MM" value={v.gatesOpen} onChange={(e) => onChange({ ...v, gatesOpen: e.target.value })} />
        </label>
        <label className={label}>
          Show start
          <input className={input} placeholder="HH:MM" value={v.showStart} onChange={(e) => onChange({ ...v, showStart: e.target.value })} />
        </label>
      </div>
    </div>
  );
}
