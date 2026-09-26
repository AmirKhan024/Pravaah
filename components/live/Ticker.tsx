'use client';
/*
 * "What changed" ticker — one line, the latest Black Box entry re-read as plain text. Not a new
 * log: the ledger (lib/ledger.ts) already records every forecast/warning/plan/expiry/report in
 * order, so the ticker is just its own last line, kept in sync for free.
 */
import { useSlice } from '@/lib/createStore';
import { store } from '@/lib/console';

export default function Ticker() {
  const last = useSlice(store, (s) => s.ledger[s.ledger.length - 1]);
  return (
    <div className="no-print flex items-center gap-2 border-t border-line bg-ink/60 px-4 py-1.5 text-[11.5px] text-dimmer">
      <span className="kicker !mb-0 shrink-0">What changed</span>
      <span className="truncate">{last ? `${last.simClock} · ${last.summary}` : 'Nothing yet — Pravaah is still working out tonight’s plan.'}</span>
    </div>
  );
}
