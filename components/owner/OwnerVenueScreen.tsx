'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, Card, Logo, cx } from '@/components/ui';
import { loadOwnerVenue, saveOwnerVenue, type OwnerSaveResult } from '@/lib/owner/store';
import { sampleOwnerVenue, type OwnerVenue } from '@/lib/owner/types';
import { EntrancesTable } from './EntrancesTable';
import { GatesTable } from './GatesTable';
import { ParkingTable } from './ParkingTable';
import { RiskReadout } from './RiskReadout';
import { VenueBasics } from './VenueBasics';

export function OwnerVenueScreen() {
  const [v, setV] = useState<OwnerVenue>(() => sampleOwnerVenue());
  const [saved, setSaved] = useState<OwnerSaveResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // avoid a server/client hydration mismatch: render the deterministic sample first, then swap in
  // whatever the owner had saved before, once we're actually in the browser
  useEffect(() => {
    setV(loadOwnerVenue());
  }, []);

  function save() {
    setErrors([]);
    setBusy(true);
    try {
      const res = saveOwnerVenue(v);
      if (!res.ok) return setErrors(res.errors);
      setSaved(res);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-ink px-5 py-10 text-text">
      <div className="mx-auto flex max-w-[820px] flex-col gap-6">
        <div className="flex items-center gap-2.5 text-brass">
          <Logo className="size-6" />
          <span className="text-[13px] font-semibold tracking-[0.2em] text-text">PRAVAAH — VENUE OWNER</span>
          <span className="ml-auto flex gap-3 text-[12px] text-dimmer">
            <Link href="/owner/registrations" className="hover:text-text">
              Registrations →
            </Link>
            <Link href="/live" className="hover:text-text">
              Live Ops →
            </Link>
          </span>
        </div>

        <div>
          <h1 className="font-display text-[28px] leading-tight">Your venue</h1>
          <p className="mt-1 text-[13.5px] text-dim">Gates, parking and entrances — every number here feeds tonight&apos;s simulation directly.</p>
        </div>

        {errors.length ? (
          <Card tone="danger">
            <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-danger-soft">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </Card>
        ) : null}

        <RiskReadout before={saved?.before} after={saved?.after} />

        <Card>
          <VenueBasics v={v} onChange={setV} />
        </Card>
        <Card>
          <GatesTable v={v} onChange={setV} />
        </Card>
        <Card>
          <ParkingTable v={v} onChange={setV} />
        </Card>
        <Card>
          <EntrancesTable v={v} onChange={setV} />
        </Card>

        <div className="flex items-center gap-3">
          <Button variant="solid" size="lg" disabled={busy} onClick={save}>
            {busy ? 'Saving…' : 'Save →'}
          </Button>
          <Button
            size="lg"
            onClick={() => {
              setV(sampleOwnerVenue());
              setSaved(null);
            }}
          >
            Use sample venue
          </Button>
          {saved ? <span className="text-[12px] text-dimmer">Saved — /live now reflects this venue.</span> : null}
        </div>

        <p className={cx('text-center text-[11.5px] text-dimmer')}>Nothing here leaves your browser until you choose to send an order later on.</p>
      </div>
    </div>
  );
}
