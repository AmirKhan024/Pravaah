'use client';
/*
 * Zone 1 — one word: Calm / Watch / Act now. Reuses DecisionClock's own hero band shell (Band)
 * and the exact same decisionDeadline()/urgent-threshold logic the Decision Clock counts down
 * with (lib/console.ts's opsStatus()) — this word and the full console's countdown can never
 * disagree about how much trouble the evening is in, because they read the same computed state.
 */
import { useSlice } from '@/lib/createStore';
import { clock, opsStatus, store } from '@/lib/console';
import { Band } from '@/components/console/DecisionClock';

/* One status word + one sentence, max 12 words (brief: "ONE sentence, max 12 words") — the
 * deadline itself lives on the one action card below, as its countdown, not spelled out twice. */
const COPY = {
  calm: { word: 'Calm', tone: 'safe' as const, sub: 'Nothing due right now.' },
  watch: { word: 'Watch', tone: 'brass' as const, sub: 'A move is coming due soon.' },
  act: { word: 'Act now', tone: 'danger' as const, sub: 'A move needs a decision now.' },
};

export default function StatusBand() {
  const s = useSlice(store, (s) => ({ status: opsStatus(s), approved: s.approved, board: !!s.board }));
  if (!s.board)
    return (
      <Band tone="idle">
        <span className="kicker !mb-0">Live Ops</span>
        <span className="text-[13px] text-dim">testing every plan against 12 rough nights…</span>
      </Band>
    );
  const c = COPY[s.status];
  return (
    <Band tone={c.tone}>
      <span className="font-display text-[40px] leading-none tracking-tight" style={{ color: c.tone === 'safe' ? 'var(--color-safe)' : c.tone === 'danger' ? 'var(--color-danger-soft)' : 'var(--color-brass)' }}>
        {c.word}
      </span>
      <span className="text-[14px] font-medium text-text">{s.approved ? `In force since ${clock(s.approved.tick)}.` : c.sub}</span>
    </Band>
  );
}
