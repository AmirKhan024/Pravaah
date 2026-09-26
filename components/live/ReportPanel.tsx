'use client';
/*
 * "Quick staff reports (chips + typed text)" — the brief's observed-input mechanism. Chips are
 * already-structured, no parsing needed; the typed field goes through the same clamp-and-validate
 * pattern as a what-if question (app/api/llm/report, lib/whatifParse.ts), never straight to the
 * engine unchecked. Every report merges into the running `observed` patch (lib/monitor.ts) and
 * immediately runs one pass of the monitor loop (lib/console.ts's reportObserved()).
 */
import { useState } from 'react';
import { useSlice } from '@/lib/createStore';
import { clearObserved, clock, reportObserved, store } from '@/lib/console';
import { describeSpec } from '@/lib/whatifParse';
import { Button, cx, Pill } from '@/components/ui';

const CHIPS: { label: string; patch: () => Record<string, unknown> }[] = [
  { label: 'Rain has started', patch: () => ({ rain: true }) },
  { label: 'Rail line delayed', patch: () => ({ railFailAt: store.getState().scn.t0Min + Math.floor(store.getState().tick) }) },
  { label: 'Gates running late', patch: () => ({ gatesLateMin: 30 }) },
  { label: 'More people than expected', patch: () => ({ turnoutPct: 15 }) },
  { label: 'Fewer people than expected', patch: () => ({ turnoutPct: -15 }) },
  { label: 'Scanners/lanes slow', patch: () => ({ slowLanes: true }) },
];

export default function ReportPanel() {
  const s = useSlice(store, (st) => ({ observed: st.observed, tick: Math.floor(st.tick) }));
  const firstGate = useSlice(store, (st) => st.scn.zones.find((z) => z.type === 'gate')?.name ?? 'Gate 1');
  const reports = useSlice(store, (st) => st.ledger.filter((e) => e.type === 'staff_report').slice(-5).reverse());
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const active = describeSpec(s.observed).label;

  const sendChip = (c: (typeof CHIPS)[number]) => {
    const patch = c.patch();
    reportObserved(patch, `Staff report at ${clock(s.tick)}: ${c.label}.`);
  };

  const sendText = async () => {
    if (!q.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/llm/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q }) }).then((x) => x.json());
      if (r.ok) {
        reportObserved(r.spec, `Staff report at ${clock(s.tick)}: "${q}" — read as ${r.label.toLowerCase()}.`);
        setQ('');
      } else setMsg(r.message || 'Could not read that as a report.');
    } catch {
      setMsg('Could not reach the parser. Try one of the chips instead.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {CHIPS.map((c) => (
          <button key={c.label} onClick={() => sendChip(c)} className="rounded-full border border-line bg-panel-2/60 px-3 py-1.5 text-[12.5px] text-dim hover:border-brass-dim hover:text-text">
            {c.label}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendText();
        }}
        className="flex items-center gap-2 rounded-full border border-line bg-ink/60 pl-3 pr-1"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Type what you're seeing: e.g. ${firstGate} scanners are down`}
          className="h-9 flex-1 bg-transparent text-[13px] text-text placeholder:text-dimmer focus:outline-none"
        />
        <Button size="sm" variant="solid" disabled={busy}>
          {busy ? '…' : 'Report'}
        </Button>
      </form>
      {msg ? <div className="text-[12px] text-danger-soft">{msg}</div> : null}

      <div className="rounded-xl border border-line bg-panel-2/40 p-3">
        <div className="kicker !mb-1.5">Observed right now</div>
        <div className="flex items-center gap-2">
          <span className={cx('text-[13px]', active ? 'text-text' : 'text-dim')}>{active || 'Nothing reported — the plain evening.'}</span>
          {active ? (
            <Pill tone="brass">
              <button onClick={clearObserved} className="hover:underline">
                clear
              </button>
            </Pill>
          ) : null}
        </div>
      </div>

      {reports.length ? (
        <div>
          <div className="kicker !mb-1.5">Recent reports</div>
          <ul className="flex flex-col gap-1 text-[12px] text-dimmer">
            {reports.map((r) => (
              <li key={r.seq}>
                {r.simClock} · {r.summary}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
