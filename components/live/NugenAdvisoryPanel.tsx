'use client';
import { useState } from 'react';
import { useSlice } from '@/lib/createStore';
import { clock, store, viewTick } from '@/lib/console';
import { Button, cx, Pill } from '@/components/ui';

export interface AlignedAdvisoryOutput {
  risk: string;
  cause: string;
  recommended_action: string;
  priority: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  deadline_minutes: number;
  expected_effect: string;
  confidence: number;
}

export interface NugenAdvisoryApiResponse {
  ok: boolean;
  source: 'nugen' | 'llm' | 'fallback';
  model: string;
  confidenceScore: number | null;
  advisory: AlignedAdvisoryOutput;
  alignmentMeta?: {
    alignmentId: string;
    modelId: string;
    domain: string;
  };
  error?: string;
}

export function NugenAdvisoryCard() {
  const s = useSlice(store, (st) => ({
    t: viewTick(st),
    cur: st.cur,
    scn: st.scn,
    approved: st.approved,
    expired: st.expired,
    board: st.board,
  }));

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<NugenAdvisoryApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestAdvisory = async () => {
    setLoading(true);
    setError(null);

    // Extract REAL current operational state from the simulation frame
    const frameIndex = Math.min(Math.floor(s.t), s.cur.frames.length - 1);
    const frame = s.cur.frames[frameIndex] || s.cur.frames[0];

    // Find most crowded spot & density
    let maxDen = 0;
    let worstLocation = s.scn.name;
    frame.zoneDen.forEach((den, i) => {
      if (den > maxDen) {
        maxDen = den;
        worstLocation = s.scn.zones[i]?.name || worstLocation;
      }
    });
    frame.linkDen.forEach((den, i) => {
      if (den > maxDen) {
        maxDen = den;
        worstLocation = s.scn.links[i]?.name || worstLocation;
      }
    });

    const venueCap = s.scn.zones.find((z) => z.type === 'venue')?.capacity || 50000;
    const currentCrowd = frame.arrived;
    const queueGrowth = Math.round(frame.crush * 10);
    const densityStr = `${maxDen.toFixed(1)} persons/m² — ${maxDen >= 5.0 ? 'CRITICAL' : maxDen >= 4.0 ? 'HIGH' : maxDen >= 2.5 ? 'MODERATE' : 'NORMAL'}`;

    // Available alternate gates from scenario
    const alternateGates = s.scn.zones
      .filter((z) => z.type === 'gate')
      .slice(1)
      .map((g) => ({ gate: g.name, capacity_available: 150 }));

    const payload = {
      location: worstLocation,
      crowd: currentCrowd,
      arrival_rate: Math.round((currentCrowd / Math.max(1, s.t)) * 10),
      capacity_per_minute: 120,
      queue_growth: queueGrowth,
      density: densityStr,
      transport_conditions: `Simulated state at ${clock(s.t)} (horizon ${s.scn.horizon}m)`,
      alternate_gates: alternateGates,
    };

    try {
      const res = await fetch('/api/llm/advisory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const data: NugenAdvisoryApiResponse = await res.json();
      setResponse(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to query advisory endpoint';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityTone = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
      case 'HIGH':
        return 'danger';
      case 'MEDIUM':
      case 'LOW':
        return 'brass';
      case 'NONE':
      default:
        return 'safe';
    }
  };

  const getSourceBadge = (source: 'nugen' | 'llm' | 'fallback') => {
    switch (source) {
      case 'nugen':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#005b96]/60 bg-[#005b96]/20 px-2.5 py-0.5 text-[10.5px] font-bold text-[#5bb4e5] uppercase tracking-wider">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5bb4e5] opacity-75"></span>
              <span className="relative inline-flex size-2 rounded-full bg-[#5bb4e5]"></span>
            </span>
            ⚡ Nugen Aligned Model
          </span>
        );
      case 'llm':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brass-dim/60 bg-brass-dim/20 px-2.5 py-0.5 text-[10.5px] font-semibold text-brass uppercase tracking-wider">
            🤖 LLM Fallback (Groq)
          </span>
        );
      case 'fallback':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel-2 px-2.5 py-0.5 text-[10.5px] font-semibold text-dimmer uppercase tracking-wider">
            ⚙️ Deterministic Rule Engine
          </span>
        );
    }
  };

  return (
    <div className="rounded-xl border border-[#005b96]/40 bg-[#002b49]/30 p-4 transition-all">
      <div className="flex items-center justify-between gap-2 border-b border-[#005b96]/30 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-bold text-[#5bb4e5] tracking-wide">Nugen Advisory AI</span>
        </div>
        <Button
          size="sm"
          variant="solid"
          disabled={loading}
          onClick={requestAdvisory}
          className="!bg-[#005b96] hover:!bg-[#0073bc] !text-white font-medium text-[12px] h-7 px-3"
        >
          {loading ? 'Analyzing...' : 'Get Nugen Advisory'}
        </Button>
      </div>

      {!response && !error && !loading && (
        <p className="mt-2.5 text-[12px] text-dim leading-relaxed">
          Request real-time Nugen Intelligence advisory based on current crowd density, ingress rates & gate queue dynamics.
        </p>
      )}

      {error && (
        <div className="mt-2.5 rounded-lg border border-danger/40 bg-danger/10 p-2.5 text-[12px] text-danger-soft">
          ✕ {error}
        </div>
      )}

      {response && response.advisory && (
        <div className="mt-3 space-y-2.5 text-[12.5px] text-text fadein">
          {/* Source and Model Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-ink/60 p-2 rounded-lg border border-line-soft">
            {getSourceBadge(response.source)}
            <span className="text-[11px] font-mono text-dimmer truncate max-w-[160px]" title={response.model}>
              {response.model}
            </span>
          </div>

          {/* Risk & Priority */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-dimmer font-semibold">Identified Risk</div>
              <div className="font-semibold text-[13.5px] text-text leading-snug">{response.advisory.risk}</div>
            </div>
            <Pill tone={getPriorityTone(response.advisory.priority)}>
              {response.advisory.priority}
            </Pill>
          </div>

          {/* Cause */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-dimmer font-semibold">Root Cause</div>
            <div className="text-dim leading-snug">{response.advisory.cause}</div>
          </div>

          {/* Recommended Action */}
          <div className="rounded-lg border border-brass-dim/40 bg-[#1e1c12] p-2.5">
            <div className="text-[11px] uppercase tracking-wider text-brass font-bold">Recommended Operational Action</div>
            <div className="font-medium text-text mt-0.5 leading-snug">{response.advisory.recommended_action}</div>
          </div>

          {/* Metrics grid: Deadline, Effect, Confidence */}
          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-line-soft text-center text-[11.5px]">
            <div className="bg-ink/40 p-1.5 rounded">
              <span className="block text-[10px] text-dimmer uppercase">Deadline</span>
              <span className="font-semibold text-brass num">{response.advisory.deadline_minutes} min</span>
            </div>
            <div className="bg-ink/40 p-1.5 rounded">
              <span className="block text-[10px] text-dimmer uppercase">Confidence</span>
              <span className="font-semibold text-safe num">
                {response.confidenceScore ?? response.advisory.confidence}%
              </span>
            </div>
            <div className="bg-ink/40 p-1.5 rounded col-span-1">
              <span className="block text-[10px] text-dimmer uppercase">Source</span>
              <span className="font-mono text-[10.5px] uppercase text-[#5bb4e5]">
                {response.source}
              </span>
            </div>
          </div>

          {/* Expected Effect */}
          <div className="text-[11.5px] text-dim bg-panel/60 p-2 rounded border border-line-soft">
            <span className="font-semibold text-dimmer">Expected Effect: </span>
            {response.advisory.expected_effect}
          </div>
        </div>
      )}
    </div>
  );
}
