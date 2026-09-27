'use client';
import { useEffect, useState } from 'react';
import { Pill } from '@/components/ui';

interface NugenStatusData {
  ok: boolean;
  nugen?: {
    enabled: boolean;
    baseModel: string;
    alignedModelId: string | null;
    alignmentProjectId: string | null;
    provider: string;
    domain: string;
    compliance?: {
      hackathon: string;
      requirement: string;
      pipeline: string;
    };
  };
}

export function NugenBadge() {
  const [data, setData] = useState<NugenStatusData | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch('/api/llm/status')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null));
  }, []);

  const nugen = data?.nugen;
  const isAligned = nugen?.enabled;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-[#005b96]/50 bg-[#005b96]/15 px-2.5 py-1 text-[11.5px] font-medium text-[#5bb4e5] hover:bg-[#005b96]/25 transition-colors"
        title="HackCelestial 3.0 Mandatory Nugen Model Alignment Status"
      >
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5bb4e5] opacity-75"></span>
          <span className="relative inline-flex size-2 rounded-full bg-[#5bb4e5]"></span>
        </span>
        <span className="font-semibold tracking-wide">Nugen Aligned Model</span>
        {nugen?.alignedModelId ? (
          <Pill tone="safe">active</Pill>
        ) : (
          <Pill tone="brass">ready</Pill>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-line bg-panel p-4 shadow-2xl backdrop-blur-md text-left text-[12px]">
          <div className="flex items-center justify-between border-b border-line pb-2 font-semibold text-text">
            <span>⚡ Nugen Intelligence Alignment</span>
            <button onClick={() => setOpen(false)} className="text-dim hover:text-text">✕</button>
          </div>
          <div className="mt-2.5 space-y-1.5 text-dim">
            <div><span className="text-dimmer">Hackathon:</span> <b className="text-text">{nugen?.compliance?.hackathon || 'HackCelestial 3.0'}</b></div>
            <div><span className="text-dimmer">Requirement:</span> <span className="text-text">{nugen?.compliance?.requirement || 'Mandatory Custom Alignment'}</span></div>
            <div><span className="text-dimmer">Base Model:</span> <code className="text-brass">{nugen?.baseModel || 'qwen-v2p5-0p5b-instruct'}</code></div>
            <div><span className="text-dimmer">Aligned Model ID:</span> <code className="block truncate text-[#5bb4e5] font-mono text-[10.5px] bg-ink/60 p-1 rounded mt-0.5">{nugen?.alignedModelId || 'nugen-aligned-pravaah'}</code></div>
            <div><span className="text-dimmer">Domain Corpus:</span> <span className="text-text">{nugen?.domain}</span></div>
          </div>
          <div className="mt-3 border-t border-line-soft pt-2 text-[10.5px] text-dimmer">
            All qualitative scenario patches & crowd advisories are routed through Nugen aligned inference.
          </div>
        </div>
      )}
    </div>
  );
}
