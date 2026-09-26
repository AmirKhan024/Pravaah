'use client';
import { useSlice } from '@/lib/createStore';
import { clock, rehearse, store } from '@/lib/console';
import { scenarioFacts } from '@/lib/facts';
import { comma } from '@/engine';
import { Button } from '@/components/ui';
import { StepHead } from './StepHead';

export default function Rehearse() {
  const s = useSlice(store, (s) => ({ scn: s.scn, mode: s.mode }));
  const f = scenarioFacts(s.scn);
  const blocks = [
    {
      k: 'Beds',
      body: (
        <>
          {comma(f.rooms)} rooms in {f.hotels.length} clusters. {f.fullNear.map((h) => h.name.replace(' hotels', '').replace('CBD ', '')).join(' and ')} {f.fullNear.length > 1 ? 'are' : 'is'} full; <b className="text-text">{comma(f.freeFar)} rooms sit empty</b> in{' '}
          {f.emptyFar.map((h) => h.name.replace(' hotels', '')).join(' and ')}. {f.lateBookings ? <b className="text-text">{comma(f.lateBookings)} late bookings have nothing near the venue.</b> : null}
        </>
      ),
    },
    {
      k: 'Transport',
      body: (
        <>
          {comma(f.railPeople)} people come by train. At the busiest moment, a train puts about <b className="text-text">{comma(f.burst)} people</b> onto the {f.burstLink?.name} every {f.burstEvery} minutes. {f.roads} road corridors carry the rest.
        </>
      ),
    },
    {
      k: 'Gates',
      body: (
        <>
          {f.gates.length} gates, {f.lanes} bag-check lanes, <b className="text-text">{comma(f.throughput)} people a minute</b> in total. Enough for {comma(f.capacity)}, if they arrive evenly. They will not.
        </>
      ),
    },
  ];
  return (
    <div className="flex flex-col gap-5">
      <StepHead n={1} verb="Rehearse" title={`Tonight at ${f.venueName}`}>
        {comma(f.capacity)} people. Gates at {clock(s.scn.gatesOpenTick)}, show at {clock(s.scn.showStartTick)}. Almost everyone arrives in the ninety minutes before it.
      </StepHead>
      <div className="flex flex-col gap-3">
        {blocks.map((b) => (
          <div key={b.k} className="rounded-xl border border-line bg-panel-2/60 px-4 py-3">
            <div className="kicker mb-1">{b.k}</div>
            <div className="text-[13.5px] leading-relaxed text-dim">{b.body}</div>
          </div>
        ))}
      </div>
      {s.mode === 'intro' ? (
        <div className="flex flex-col gap-2">
          <Button variant="solid" size="lg" onClick={rehearse}>
            Rehearse the evening
          </Button>
          <p className="text-center text-[12px] text-dimmer">Pravaah runs the whole evening, minute by minute, before anyone leaves home.</p>
        </div>
      ) : s.mode === 'story' ? (
        <div className="rounded-xl border border-line px-4 py-3 text-[12.5px] text-dim">Rehearsing… watch the map. Every dot is a crowd moving along a real corridor.</div>
      ) : null}
    </div>
  );
}
