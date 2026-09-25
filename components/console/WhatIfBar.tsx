'use client';
import { useState } from 'react';
import { useSlice } from '@/lib/createStore';
import { clearWhatIf, runWhatIf, runWhatIfSpec, store, toast } from '@/lib/console';
import { WHATIFS, comma } from '@/engine';
import { cx } from '@/components/ui';

export default function WhatIfBar() {
  const s = useSlice(store, (s) => ({ w: s.whatIf, base: s.base, mode: s.mode, hasPlan: !!s.approved || !!s.plans['Zero rupees'] }));
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  if (s.mode === 'intro' || s.mode === 'story') return null;

  const ask = async () => {
    if (!q.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/llm/whatif', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q }) }).then((x) => x.json());
      if (r.ok) {
        runWhatIfSpec(r.spec, r.label, r.say, r.source);
        setQ('');
      } else toast(r.message || 'Pravaah could not turn that into a scenario.');
    } catch {
      toast('Could not reach the parser. Try one of the chips.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pointer-events-auto flex max-w-[640px] flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="kicker !mb-0 mr-1">What if</span>
        {WHATIFS.map((w) => (
          <button
            key={w.id}
            onClick={() => (s.w?.id === w.id ? clearWhatIf() : runWhatIf(w.id))}
            className={cx(
              'rounded-full border px-3 py-1 text-[12px] backdrop-blur-[2px] transition-colors',
              s.w?.id === w.id ? 'border-brass bg-[#1d1c14] text-brass' : 'border-line bg-ink/80 text-dim hover:border-brass-dim hover:text-text',
            )}
          >
            {w.label}
          </button>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
          className="flex min-w-[240px] flex-1 items-center rounded-full border border-line bg-ink/80 pl-3 pr-1 focus-within:border-brass-dim"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask: what if 20% more people come and it rains?"
            className="h-7 flex-1 bg-transparent text-[12px] text-text placeholder:text-dimmer focus:outline-none"
            aria-label="Ask a what-if question"
          />
          <button type="submit" disabled={busy} className="rounded-full px-2.5 py-0.5 text-[11.5px] text-brass disabled:opacity-40">
            {busy ? '…' : 'Run'}
          </button>
        </form>
      </div>
      {s.w ? (
        <div className="rise flex items-start gap-3 rounded-xl border border-line bg-ink/90 px-4 py-3 backdrop-blur-[3px]">
          <div className="flex-1">
            <div className="text-[13px] font-semibold">
              {s.w.label}
              {s.w.id === 'custom' ? <span className="ml-2 text-[10.5px] font-normal text-dimmer">{s.w.source === 'llm' ? 'question parsed by the language model · numbers by the engine' : 'question parsed by word matching · numbers by the engine'}</span> : null}
            </div>
            <div className="mt-0.5 text-[12px] leading-snug text-dim">{s.w.say}</div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
              <span className="text-dim">
                Doing nothing: <b className="num text-danger-soft">{s.w.none.crushMin}</b> dangerous min · <span className="num">{comma(s.w.none.missed)}</span> outside at showtime
              </span>
              {s.w.withPlan ? (
                <span className="text-dim">
                  With the plan: <b className={cx('num', s.w.withPlan.crushMin <= 5 ? 'text-safe' : 'text-danger-soft')}>{s.w.withPlan.crushMin}</b> dangerous min · <span className="num">{comma(s.w.withPlan.missed)}</span> outside
                </span>
              ) : null}
              <span className="text-dimmer">normal night, doing nothing: {s.base.crushMin}</span>
            </div>
          </div>
          <button onClick={clearWhatIf} className="text-[12px] text-dim hover:text-text" aria-label="Clear what-if">
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}
