'use client';
import { Delta, Pill } from '@/components/ui';
import type { RiskReadout as Readout } from '@/lib/owner/store';

const TONE: Record<Readout['status'], 'safe' | 'brass' | 'danger'> = { Calm: 'safe', Watch: 'brass', 'Act now': 'danger' };

/** The demo moment: "changing gate lanes changes tonight's risk," proven, not asserted — this
 *  reads a real simulate() run of the whole evening, same engine as /live, nothing invented. */
export function RiskReadout({ before, after }: { before?: Readout; after?: Readout }) {
  return (
    <div className="rounded-xl border border-brass-dim/40 bg-[#1d1c14] p-4">
      <p className="text-[13.5px] text-text">Changing gate lanes changes tonight&apos;s risk.</p>
      {after ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Pill tone={TONE[after.status]}>{after.status}</Pill>
          <Delta from={before ? `${before.crushMin}` : `${after.crushMin}`} to={`${after.crushMin}`} unit="dangerous min" />
        </div>
      ) : (
        <p className="mt-2 text-[12.5px] text-dimmer">Save to see tonight&apos;s status and dangerous minutes, run live from your numbers.</p>
      )}
    </div>
  );
}
