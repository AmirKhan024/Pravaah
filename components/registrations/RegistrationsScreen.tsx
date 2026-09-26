'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Button, Card, Delta, Logo, Pill, cx } from '@/components/ui';
import { store } from '@/lib/console';
import { applyRegistrationGroups, ownerGateInfos, readout, type OwnerSaveResult } from '@/lib/owner/store';
import { detectAndParse, firstSample } from '@/lib/registrations/parse';
import { applyColumnMapping, applyExtractedRows } from '@/lib/registrations/apply';
import { fuzzyColumnMapping, fuzzyExtractRows } from '@/lib/registrations/fuzzyMap';
import type { ApplyResult, ColumnMapping, MappingResult, ParsedInput } from '@/lib/registrations/types';
import { CleanGroupsOut } from './CleanGroupsOut';
import { MappingTable } from './MappingTable';
import { MessyPreview } from './MessyPreview';

type Step = 'input' | 'mapping' | 'groups';

export function RegistrationsScreen() {
  const [step, setStep] = useState<Step>('input');
  const [paste, setPaste] = useState('');
  const [parsed, setParsed] = useState<ParsedInput | null>(null);
  const [mapping, setMapping] = useState<MappingResult | null>(null);
  const [offline, setOffline] = useState(false);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [saved, setSaved] = useState<OwnerSaveResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const gates = ownerGateInfos();
  // frozen once, at the moment this screen opened — NOT re-read on every render, or it would
  // silently start showing the post-apply scenario the instant "Use these groups" mutates the
  // shared store (a real bug this slice's own live verification caught: the status pill flipped
  // to the new, calmer state while the number next to it still showed the true old one)
  const [before] = useState<ReturnType<typeof readout>>(() => readout(store.getState().scn));

  async function proceedWith(text: string) {
    setError(null);
    const p = detectAndParse(text);
    if (!p.totalRows) return setError('Could not find any rows or lines in that — try another file or paste some text.');
    setParsed(p);
    setBusy('Reading how Pravaah understands it…');
    try {
      const sample = firstSample(p, 20);
      const res = await fetch('/api/llm/registrations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ headers: p.headers, sample, gates: gates.map((g) => ({ id: g.id, name: g.name })) }),
      })
        .then((r) => r.json())
        .catch(() => null);
      if (res?.ok) {
        setMapping(res.result as MappingResult);
        setOffline(false);
      } else if (p.headers) {
        setMapping({ kind: 'columns', mapping: fuzzyColumnMapping(p.headers), normalize: { mode: {}, gate: {} }, source: 'fuzzy' });
        setOffline(true);
      } else {
        setMapping({ kind: 'rows', rows: fuzzyExtractRows(p.lines.slice(0, 200), gates), source: 'fuzzy' });
        setOffline(true);
      }
      setStep('mapping');
    } finally {
      setBusy(null);
    }
  }

  async function loadMessySample(which: 'csv' | 'whatsapp') {
    setBusy('Loading the sample…');
    try {
      const j = await fetch(`/api/sample/messy?which=${which}`).then((r) => r.json());
      if (j.ok) await proceedWith(j.text);
      else setError('Could not load the sample.');
    } finally {
      setBusy(null);
    }
  }

  async function handleFile(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    await proceedWith(await f.text());
  }

  function confirmMapping() {
    if (!parsed || !mapping) return;
    const applied = mapping.kind === 'columns' ? applyColumnMapping(parsed, mapping.mapping, mapping.normalize, gates) : applyExtractedRows(mapping.rows, gates);
    setResult(applied);
    setSaved(null);
    setStep('groups');
  }

  function useTheseGroups() {
    if (!result) return;
    const out = applyRegistrationGroups(result.groups);
    if (!out.ok) return setError(out.errors.join(' '));
    setSaved(out);
  }

  function reset() {
    setStep('input');
    setPaste('');
    setParsed(null);
    setMapping(null);
    setResult(null);
    setSaved(null);
    setError(null);
  }

  return (
    <div className="min-h-dvh bg-ink px-5 py-10 text-text">
      <div className="mx-auto flex max-w-[820px] flex-col gap-6">
        <div className="flex items-center gap-2.5 text-brass">
          <Logo className="size-6" />
          <span className="text-[13px] font-semibold tracking-[0.2em] text-text">PRAVAAH — REGISTRATIONS</span>
          <span className="ml-auto flex gap-3 text-[12px] text-dimmer">
            <Link href="/owner/venue" className="hover:text-text">
              ← Your venue
            </Link>
            <Link href="/live" className="hover:text-text">
              Live Ops →
            </Link>
          </span>
        </div>

        <div>
          <h1 className="font-display text-[28px] leading-tight">Turn a messy list into arrival groups</h1>
          <p className="mt-1 text-[13.5px] text-dim">Any shape works — a spreadsheet export, a pasted WhatsApp list, free text. Pravaah maps it, you confirm, the evening re-runs.</p>
        </div>

        {error ? (
          <Card tone="danger">
            <p className="text-[13px] text-danger-soft">{error}</p>
          </Card>
        ) : null}

        {step === 'input' ? (
          <Card>
            <p className="mb-2 text-[13px] text-dim">Paste anything — copied spreadsheet rows, a WhatsApp list, free text:</p>
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              rows={6}
              placeholder="Rohan from Kharghar, 4 of us, taking a cab…"
              className="w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-[13px] text-text outline-none focus:border-brass-dim"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="solid" disabled={!paste.trim() || !!busy} onClick={() => proceedWith(paste)}>
                {busy ?? 'Understand this →'}
              </Button>
              <input ref={fileInput} type="file" accept=".csv,.txt,.json" className="hidden" onChange={(e) => handleFile(e.target.files)} />
              <Button disabled={!!busy} onClick={() => fileInput.current?.click()}>
                Choose a file…
              </Button>
              <Button disabled={!!busy} onClick={() => loadMessySample('csv')}>
                Try a messy sample (spreadsheet) →
              </Button>
              <Button disabled={!!busy} onClick={() => loadMessySample('whatsapp')}>
                Try a messy sample (WhatsApp list) →
              </Button>
            </div>
          </Card>
        ) : null}

        {parsed && step !== 'input' ? (
          <Card>
            <MessyPreview parsed={parsed} />
          </Card>
        ) : null}

        {parsed && mapping && (step === 'mapping' || step === 'groups') ? (
          <Card>
            <MappingTable
              parsed={parsed}
              mapping={mapping}
              offline={offline}
              onChangeMapping={(m: ColumnMapping) => mapping.kind === 'columns' && setMapping({ ...mapping, mapping: m })}
            />
            {step === 'mapping' ? (
              <Button variant="solid" className="mt-3" onClick={confirmMapping}>
                Confirm →
              </Button>
            ) : null}
          </Card>
        ) : null}

        {result && step === 'groups' ? (
          <>
            <Card>
              <CleanGroupsOut result={result} />
            </Card>
            <Card tone="brass">
              <p className="text-[13.5px] text-text">Before/after risk, run live from these groups:</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Pill tone={before.status === 'Calm' ? 'safe' : before.status === 'Watch' ? 'brass' : 'danger'}>before: {before.status}</Pill>
                {saved ? (
                  <>
                    <Pill tone={saved.after.status === 'Calm' ? 'safe' : saved.after.status === 'Watch' ? 'brass' : 'danger'}>after: {saved.after.status}</Pill>
                    <Delta from={`${saved.before.crushMin}`} to={`${saved.after.crushMin}`} unit="dangerous min" />
                  </>
                ) : (
                  <span className="text-[12.5px] text-dimmer">— apply the groups to see the after number</span>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="solid" onClick={useTheseGroups}>
                  Use these groups →
                </Button>
                <Button onClick={reset}>Start over</Button>
              </div>
              {saved ? <p className="mt-2 text-[12px] text-dimmer">Saved — /live now reflects these arrival groups.</p> : null}
            </Card>
          </>
        ) : null}

        <p className={cx('text-center text-[11.5px] text-dimmer')}>Groq only maps columns or cites rows — every count, sum and group above is plain code, never the model.</p>
      </div>
    </div>
  );
}
