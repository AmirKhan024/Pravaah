'use client';
/*
 * Slice 4 — /owner/documents. Step A (extract text, deterministic) -> Step B (Groq proposes
 * claimed figures + exact quotes, for the 4 fields that exist on the owner venue screen) -> Step C
 * (code re-verifies every quote is actually in the text and the number is in the quote) -> Step D
 * (code compares against what the owner entered). Groq never sees the owner's own values, and its
 * output is never trusted past Step C. "Pravaah checks that your numbers match your papers. It
 * does not certify safety."
 */
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { compareToOwnerValues, fuzzyExtractClaims, verifyClaimedFigures, type ClaimedFigure, type DocCheckField, type DocCheckRow } from '@/engine';
import { loadOwnerVenue, saveOwnerVenue, applyDocumentValue, docCheckOwnerValues } from '@/lib/owner/store';
import type { OwnerVenue } from '@/lib/owner/types';
import { Button, Card, Kicker, Logo, Pill, cx } from '@/components/ui';

async function fileToBase64(f: File): Promise<string> {
  const buf = await f.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function extractClaims(text: string): Promise<{ claims: ClaimedFigure[]; source: 'groq' | 'fuzzy' }> {
  try {
    const r = await fetch('/api/llm/document', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) }).then((x) => x.json());
    if (r.ok) return { claims: r.claims, source: 'groq' };
  } catch {
    /* fall through */
  }
  return { claims: fuzzyExtractClaims(text), source: 'fuzzy' };
}

const STATUS_TONE: Record<DocCheckRow['status'], 'safe' | 'danger' | 'default'> = { match: 'safe', mismatch: 'danger', 'not-found': 'default' };
const STATUS_LABEL: Record<DocCheckRow['status'], string> = { match: 'matches', mismatch: 'mismatch', 'not-found': 'claimed — not found in document' };

function Row({ row, onAccept, onKeep }: { row: DocCheckRow; onAccept: () => void; onKeep: () => void }) {
  const [showSnippet, setShowSnippet] = useState(false);
  return (
    <div className="rounded-lg border border-line bg-panel-2/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13.5px] font-medium text-text">{row.label}</span>
        <Pill tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Pill>
      </div>
      {row.status === 'mismatch' ? (
        <p className="mt-1.5 text-[13px] text-dim">
          Document says <span className="num text-text">{row.documentValue}</span>; you entered <span className="num text-text">{row.ownerValue}</span>.
        </p>
      ) : (
        <p className="mt-1.5 text-[12.5px] text-dimmer">
          You entered <span className="num text-text">{row.ownerValue}</span>
          {row.documentValue != null ? (
            <>
              , document says <span className="num text-text">{row.documentValue}</span>
            </>
          ) : null}
          .
        </p>
      )}
      {row.snippet ? (
        <button className="mt-1 text-[11.5px] text-dim underline hover:text-text" onClick={() => setShowSnippet((v) => !v)}>
          {showSnippet ? 'Hide snippet' : 'View snippet →'}
        </button>
      ) : null}
      {showSnippet && row.snippet ? <blockquote className="mt-1.5 rounded-md border-l-2 border-brass-dim bg-ink/60 px-3 py-2 text-[12px] italic text-dim">&ldquo;{row.snippet}&rdquo;</blockquote> : null}
      {row.status === 'mismatch' ? (
        <div className="mt-2 flex gap-1.5">
          <Button size="sm" variant="solid" onClick={onAccept}>
            Use document value
          </Button>
          <Button size="sm" variant="quiet" onClick={onKeep}>
            Keep mine
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function DocumentsScreen() {
  const [v, setV] = useState<OwnerVenue>(() => loadOwnerVenue());
  const [text, setText] = useState('');
  const [docLabel, setDocLabel] = useState<string | null>(null);
  const [verified, setVerified] = useState<ClaimedFigure[] | null>(null);
  const [source, setSource] = useState<'groq' | 'fuzzy' | null>(null);
  const [dismissed, setDismissed] = useState<Set<DocCheckField>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    if (!verified) return null;
    return compareToOwnerValues(verified, docCheckOwnerValues(v)).filter((r) => !dismissed.has(r.field));
  }, [verified, v, dismissed]);

  async function runCheck(nextText: string) {
    setBusy('Reading the document…');
    setMsg(null);
    try {
      const { claims, source: src } = await extractClaims(nextText);
      const ok = verifyClaimedFigures(nextText, claims);
      setVerified(ok);
      setSource(src);
      setDismissed(new Set());
      if (!ok.length) setMsg('Could not verify any claimed figures against this document — every figure stays "claimed."');
    } finally {
      setBusy(null);
    }
  }

  async function loadSample() {
    setBusy('Loading the sample document…');
    try {
      const r = await fetch('/api/sample/safety-doc').then((x) => x.json());
      setText(r.text);
      setDocLabel('sample, illustrative — not a real certificate');
      await runCheck(r.text);
    } catch {
      setMsg('Could not load the sample document.');
    } finally {
      setBusy(null);
    }
  }

  async function handleUpload(f: File | null) {
    if (!f) return;
    setBusy('Extracting text…');
    setMsg(null);
    try {
      const base64 = await fileToBase64(f);
      const r = await fetch('/api/documents/extract', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ filename: f.name, base64 }) }).then((x) => x.json());
      if (!r.ok) {
        setMsg(r.reason || 'Could not read that file.');
        return;
      }
      setText(r.text);
      setDocLabel(f.name);
      await runCheck(r.text);
    } catch {
      setMsg('Could not read that file — try pasting the text instead.');
    } finally {
      setBusy(null);
    }
  }

  function accept(row: DocCheckRow) {
    if (row.documentValue == null) return;
    const nv = applyDocumentValue(v, row.field, row.documentValue);
    setV(nv);
    saveOwnerVenue(nv);
    setMsg(`Updated "${row.label}" from the document, and re-ran the evening — /live now reflects it.`);
  }
  function keep(field: DocCheckField) {
    setDismissed((s) => new Set(s).add(field));
  }

  return (
    <div className="min-h-dvh bg-ink px-5 py-10 text-text">
      <div className="mx-auto flex max-w-[720px] flex-col gap-6">
        <div className="flex items-center gap-2.5 text-brass">
          <Logo className="size-6" />
          <span className="text-[13px] font-semibold tracking-[0.2em] text-text">PRAVAAH — VENUE OWNER</span>
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
          <h1 className="font-display text-[28px] leading-tight">Safety-document check</h1>
          <p className="mt-1 text-[13.5px] text-dim">Upload or paste a safety/fire-NOC excerpt — Pravaah checks it against the 4 numbers on your venue screen.</p>
        </div>

        {msg ? (
          <Card>
            <p className="text-[13px] text-dim">{msg}</p>
          </Card>
        ) : null}

        <Card>
          <Kicker>Your document</Kicker>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a safety/fire-NOC excerpt here…"
            rows={5}
            className="w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-[12.5px] text-text placeholder:text-dimmer focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="solid" disabled={!!busy || !text.trim()} onClick={() => runCheck(text)}>
              {busy ?? 'Check this text'}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept=".txt,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                handleUpload(f);
                e.target.value = '';
              }}
            />
            <Button size="sm" disabled={!!busy} onClick={() => fileInput.current?.click()}>
              Upload .txt or .pdf
            </Button>
            <Button size="sm" disabled={!!busy} onClick={loadSample}>
              Use the sample document →
            </Button>
            {docLabel ? <Pill>{docLabel}</Pill> : null}
          </div>
        </Card>

        {rows ? (
          <Card>
            <Kicker right={source ? <span>{source === 'groq' ? 'Groq-assisted' : 'offline mode'}</span> : undefined}>Checked against your venue screen</Kicker>
            <div className={cx('flex flex-col gap-2')}>
              {rows.map((r) => (
                <Row key={r.field} row={r} onAccept={() => accept(r)} onKeep={() => keep(r.field)} />
              ))}
            </div>
          </Card>
        ) : null}

        <p className="text-center text-[11.5px] text-dimmer">Pravaah checks that your numbers match your papers. It does not certify safety.</p>
      </div>
    </div>
  );
}
