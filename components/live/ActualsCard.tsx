'use client';
/*
 * Slice 3 — "predicted vs actual, the learning loop." One card in the main view (brief: "a plain
 * sentence... plus a small overlay chart... Details behind More"). Predictions are frozen at
 * approval (lib/console.ts's freezePredictionNow, hooked into approve()); actuals come from either
 * the demo-feed generator or a pasted/uploaded scan log, mapped through the same
 * Groq-maps-columns/code-counts discipline the registrations upload already uses (lib/scans/*).
 */
import { useState } from 'react';
import Link from 'next/link';
import { useSlice } from '@/lib/createStore';
import { generateDemoActualFeed, recalibrateNow, store, submitActualScans } from '@/lib/console';
import { parseCsv } from '@/engine';
import { applyScanMapping, bucketizeScanRows } from '@/lib/scans/apply';
import { fuzzyScanColumnMapping } from '@/lib/scans/fuzzyMap';
import type { ScanColumnMapping } from '@/lib/scans/types';
import type { GateInfo } from '@/lib/registrations/types';
import { Button, cx, Pill } from '@/components/ui';

function gateName(gateId: string): string {
  return store.getState().scn.zones.find((z) => z.id === gateId)?.name ?? gateId;
}

async function mapScanColumns(headers: string[], sample: Record<string, string>[]): Promise<{ mapping: ScanColumnMapping; source: 'groq' | 'fuzzy' }> {
  try {
    const r = await fetch('/api/llm/scans', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ headers, sample }) }).then((x) => x.json());
    if (r.ok) return { mapping: r.mapping, source: 'groq' };
  } catch {
    /* fall through to the offline fallback */
  }
  return { mapping: fuzzyScanColumnMapping(headers), source: 'fuzzy' };
}

function PasteBox({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const rows = parseCsv(text);
      const headers = rows.length ? Object.keys(rows[0]) : [];
      if (!rows.length || !headers.length) {
        setMsg('Could not read that as a table — first line should be a header row (e.g. gate,time,count).');
        return;
      }
      const { mapping, source } = await mapScanColumns(headers, rows.slice(0, 10));
      if (!mapping.gate || !mapping.time || !mapping.count) {
        setMsg(`Could not find gate/time/count columns${source === 'fuzzy' ? ' (offline mode — try clearer headers)' : ''}.`);
        return;
      }
      const s = store.getState();
      const gates: GateInfo[] = s.scn.zones.filter((z) => z.type === 'gate').map((z) => ({ id: z.id, name: z.name, lanes: z.lanes ?? 0 }));
      const { rows: scanRows, rejected } = applyScanMapping(rows, mapping, gates, s.scn.t0Min, s.scn.horizon);
      if (!scanRows.length) {
        setMsg('None of the rows resolved to a real gate/time/count — check the values against your gate names.');
        return;
      }
      const nBuckets = Math.max(1, Math.ceil(s.scn.horizon / 10));
      const buckets = bucketizeScanRows(scanRows, gates.map((g) => g.id), 10, nBuckets);
      submitActualScans(buckets, scanRows.length, rejected);
      setText('');
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Paste a gate scan log — any column names, e.g.:\ngate,time,count\nGate 3,18:10,412\nGate 3,18:20,388'}
        rows={4}
        className="rounded-lg border border-line bg-panel-2 px-3 py-2 text-[12.5px] text-text placeholder:text-dimmer focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="solid" disabled={busy} onClick={submit}>
          {busy ? 'Reading…' : 'Load scan log'}
        </Button>
        {msg ? <span className="text-[11.5px] text-danger-soft">{msg}</span> : null}
      </div>
    </div>
  );
}

export default function ActualsCard() {
  const [expanded, setExpanded] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const s = useSlice(store, (st) => ({
    predicted: st.predicted,
    actualBuckets: st.actualBuckets,
    actualsSource: st.actualsSource,
    comparison: st.comparison,
    recalibration: st.recalibration,
    gateTrust: st.gateTrust,
  }));

  if (!s.predicted)
    return (
      <div className="rounded-xl border border-line bg-panel-2/40 p-4 text-[12.5px] text-dim">
        Predicted vs actual: approve a plan to freeze a prediction, then load a scan log or a demo feed to compare.
      </div>
    );

  const worst = s.comparison?.[0];
  const busier = worst && worst.pctDiff > 0;

  return (
    <div className="rounded-xl border border-line bg-panel-2/60 p-4">
      <div className="kicker !mb-1.5">Predicted vs actual</div>
      {!s.comparison ? (
        <div className="flex flex-col gap-2">
          <p className="text-[12.5px] text-dim">No actuals loaded yet.</p>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="solid" onClick={generateDemoActualFeed}>
              Generate demo feed
            </Button>
            <Button size="sm" variant="quiet" onClick={() => setShowPaste((v) => !v)}>
              Paste a scan log
            </Button>
          </div>
          {showPaste ? <PasteBox onDone={() => setShowPaste(false)} /> : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-text">
            {worst
              ? `${gateName(worst.gateId)} ran ${Math.abs(worst.pctDiff)}% ${busier ? 'busier' : 'quieter'} than predicted${
                  worst.peakShiftMin ? `, peak ${Math.abs(worst.peakShiftMin)} min ${worst.peakShiftMin < 0 ? 'earlier' : 'later'}` : ''
                }.`
              : 'Predicted and actual match closely so far.'}
          </p>
          <Pill tone={s.actualsSource === 'demo-feed' ? 'brass' : 'safe'}>{s.actualsSource === 'demo-feed' ? 'demo feed' : 'real scan data'}</Pill>

          {worst ? (
            <div className="mt-1 flex h-14 items-end gap-1">
              {s.predicted.perGate[worst.gateId].map((v, i) => {
                const act = s.actualBuckets?.[worst.gateId]?.[i] ?? 0;
                const max = Math.max(1, ...s.predicted!.perGate[worst.gateId], ...(s.actualBuckets?.[worst.gateId] ?? []));
                return (
                  <div key={i} className="flex flex-1 items-end gap-0.5">
                    <div className="flex-1 rounded-t bg-dim/40" style={{ height: Math.max(1, Math.round((v / max) * 52)) }} title={`predicted: ${v}`} />
                    <div className="flex-1 rounded-t bg-brass/70" style={{ height: Math.max(1, Math.round((act / max) * 52)) }} title={`actual: ${act}`} />
                  </div>
                );
              })}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1.5 text-[11px] text-dimmer">
            <span className="inline-flex items-center gap-1">
              <i className="size-2 rounded-sm bg-dim/40" /> predicted
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="size-2 rounded-sm bg-brass/70" /> actual
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="quiet" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Less' : 'More'}
            </Button>
            {!s.recalibration ? (
              <Button size="sm" variant="solid" onClick={recalibrateNow}>
                Recalibrate
              </Button>
            ) : (
              <Pill tone="safe">
                error {s.recalibration.errorBefore}% → {s.recalibration.errorAfter}%
              </Pill>
            )}
            <Link href="/report" className="rounded-lg border border-line px-2.5 py-1 text-[12px] text-dim hover:border-brass-dim/60 hover:text-text">
              After-event report →
            </Link>
          </div>

          {expanded ? (
            <div className="mt-2 flex flex-col gap-1.5 border-t border-line pt-2">
              {s.comparison.map((c) => (
                <div key={c.gateId} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="text-text">{gateName(c.gateId)}</span>
                  <span className="text-dim">
                    {c.predictedTotal} predicted · {c.actualTotal} actual ({c.pctDiff > 0 ? '+' : ''}
                    {c.pctDiff}%)
                  </span>
                  <Pill tone={s.gateTrust[c.gateId] === 'verified' ? 'safe' : 'default'}>{s.gateTrust[c.gateId] === 'verified' ? 'verified by event' : 'claimed'}</Pill>
                </div>
              ))}
              <button className="mt-1 self-start text-[11.5px] text-dim underline hover:text-text" onClick={() => setShowPaste((v) => !v)}>
                {showPaste ? 'Hide' : 'Load a different scan log'}
              </button>
              {showPaste ? <PasteBox onDone={() => setShowPaste(false)} /> : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
