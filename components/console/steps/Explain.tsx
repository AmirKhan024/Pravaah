'use client';
import { useSlice } from '@/lib/createStore';
import { clock, goStep, store, unlock } from '@/lib/console';
import { causalChain, scenarioFacts } from '@/lib/facts';
import { comma } from '@/engine';
import { Busy, Button, cx } from '@/components/ui';
import { StepHead } from './StepHead';

export default function Explain() {
  const s = useSlice(store, (s) => ({ abl: s.abl, base: s.base, scn: s.scn }));
  const B = s.base.crushMin;
  const chain = causalChain(s.scn, s.base);
  const f = scenarioFacts(s.scn);
  if (!s.abl)
    return (
      <div className="flex flex-col gap-5">
        <StepHead n={3} verb="Explain" title="Remove one cause. Re-run the evening." />
        <Busy label="removing causes one at a time…" />
      </div>
    );
  const full = s.abl.filter((a) => B > 0 && a.removed / B >= 0.95);
  const mismatch = full.length >= 2;
  return (
    <div className="flex flex-col gap-5">
      <StepHead n={3} verb="Explain" title={mismatch ? <>Not too many people. The wrong gate.</> : <>What causes it</>}>
        To prove a cause, Pravaah takes it away and runs the whole evening again. Whatever disappears, that cause was making.
      </StepHead>

      <div className="rounded-xl border border-line bg-panel-2/60 p-4">
        <div className="kicker mb-3">
          Remove this, and <span className="num">{B}</span> dangerous minutes become…
        </div>
        <div className="flex flex-col gap-3.5">
          {s.abl.map((a) => {
            const share = B ? Math.max(0, a.removed) / B : 0;
            return (
              <div key={a.name}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13.5px] font-medium leading-snug">{a.name}</span>
                  <span className={cx('num shrink-0 text-[15px] font-semibold', a.left === 0 ? 'text-safe' : 'text-text')}>{a.left}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                  <div className={cx('h-full rounded-full', share >= 0.95 ? 'bg-safe' : share > 0.2 ? 'bg-brass' : 'bg-dim')} style={{ width: Math.max(2, share * 100) + '%' }} />
                </div>
                <div className="mt-1 text-[11.5px] text-dimmer">
                  {a.detail} · explains {Math.round(share * 100)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {mismatch ? (
        <div className="rounded-xl border border-brass-dim/60 bg-[#1d1c14] p-4">
          <div className="kicker mb-1 !text-brass">Mismatch, not shortage</div>
          <p className="text-[13.5px] leading-relaxed text-dim">
            Two different fixes each remove every dangerous minute. The stadium has enough gates. The crowd is pointed at one of them. <b className="text-text">You do not need more capacity. You need the crowd to use the capacity it already has.</b>
          </p>
        </div>
      ) : null}

      {chain && s.scn.id === 'dyPatil' ? (
        <div>
          <div className="kicker mb-2">How it builds, read from the simulation</div>
          <ol className="relative flex flex-col gap-3 border-l border-line pl-4">
            <li>
              <div className="text-[13px] leading-snug">Trains reach Nerul in bursts. Each puts about {comma(f.burst)} people onto a skywalk that carries {f.burstLink?.cap} a minute.</div>
            </li>
            <li>
              <div className="text-[13px] leading-snug">
                {comma(f.loads[chain.gate?.id || ''] || 0)} of the {comma(f.capacity)} people are routed to {chain.gate?.name}. Only {comma(f.loads[f.quietestGate?.id || ''] || 0)} to {f.quietestGate?.name}.
              </div>
            </li>
            <li>
              <div className="text-[13px] leading-snug">
                {chain.gate?.name} checks <span className="num">{chain.gateRate}</span> people a minute. About <span className="num">{comma(chain.inflow)}</span> a minute are arriving. That is <span className="num">{comma(chain.extra)}</span> extra people every minute, with nowhere to go.
              </div>
            </li>
            {chain.firstFull > 0 ? (
              <li>
                <div className="num text-[11px] text-dimmer">{clock(chain.firstFull)}</div>
                <div className="text-[13px] leading-snug">
                  The {chain.zone.name.toLowerCase()} is full: {comma(chain.fullPeople)} people in {comma(chain.zone.areaM2 || 0)} m². New arrivals are stopped on the {chain.heldLink?.name.toLowerCase()} behind it.
                </div>
              </li>
            ) : null}
            <li className="relative">
              <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-danger" />
              <div className="num text-[11px] text-danger-soft">{clock(s.base.worst.tick)}</div>
              <div className="text-[13px] leading-snug text-danger-soft">
                {chain.zone.name} reaches {s.base.worst.den.toFixed(1)} people per m², so tight nobody can move. It stays dangerous for {chain.crushRun} minutes.
              </div>
            </li>
          </ol>
        </div>
      ) : null}

      <Button
        variant="solid"
        size="lg"
        onClick={() => {
          unlock(4);
          goStep(4);
        }}
      >
        Find the fix
      </Button>
    </div>
  );
}
