'use client';
import { useSlice } from '@/lib/createStore';
import { clock, goStep, setPeek, store, unlock, viewTick } from '@/lib/console';
import { denWords } from '@/lib/colors';
import { Busy, Button, cx } from '@/components/ui';
import { StepHead } from './StepHead';

export default function Predict() {
  const s = useSlice(store, (s) => ({ ens: s.ens, prog: s.progress.ensemble || 0, scn: s.scn, base: s.base, t: viewTick(s), peek: s.peek }));
  const e = s.ens;
  if (!e)
    return (
      <div className="flex flex-col gap-5">
        <StepHead n={2} verb="Predict" title="Running tonight sixty times">
          Tonight will not go exactly to plan. Pravaah reruns the evening with the crowd a little bigger or smaller, the trains a little late or early, the bag checks a little slower.
        </StepHead>
        <Busy label={`running perturbed evening ${Math.round(s.prog * 60)} of 60…`} f={s.prog} />
      </div>
    );
  const zone = s.scn.zones[e.zone];
  const hits = Math.round(e.p * e.n);
  const nowDen = s.base.frames[s.t].zoneDen[e.zone];
  const lo = Math.min(...e.ticks, e.tLo) - 20,
    hi = Math.max(...e.ticks, e.tHi) + 20;
  const x = (t: number) => ((t - lo) / (hi - lo)) * 100 + '%';
  // one square per run; crushed runs sorted first
  const cells = Array.from({ length: e.n }, (_, i) => i < hits);

  return (
    <div className="flex flex-col gap-5">
      <StepHead n={2} verb="Predict" title={<>It breaks at the {zone.name}.</>}>
        Pravaah ran tonight {e.n} times, each a little different. In <b className="text-text">{hits} of them</b>, the {zone.name.toLowerCase()} gets so tight nobody can move.
      </StepHead>

      <div className="rounded-xl border border-line bg-panel-2/60 p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="kicker mb-0.5">Chance of a crush</div>
            <div className="num text-[44px] font-semibold leading-none text-danger-soft">{Math.round(e.p * 100)}%</div>
          </div>
          <div className="grid grid-cols-12 gap-[3px]" aria-label={`${hits} of ${e.n} runs end in a crush`}>
            {cells.map((c, i) => (
              <i key={i} className={cx('size-[9px] rounded-[2px]', c ? 'bg-d5' : 'bg-line')} />
            ))}
          </div>
        </div>
        <div className="mt-1 text-[11.5px] text-dimmer">each square is one full run of the evening</div>
      </div>

      <div className="rounded-xl border border-line bg-panel-2/60 p-4">
        <div className="kicker mb-1">When it happens</div>
        <div className="text-[14px] leading-snug text-dim">
          Most likely at <b className="num text-[17px] text-text">{clock(e.tMed)}</b>, somewhere between <span className="num text-text">{clock(e.tLo)}</span> and <span className="num text-text">{clock(e.tHi)}</span>.
        </div>
        <div className="relative mt-4 h-9">
          <div className="absolute inset-x-0 top-4 h-px bg-line" />
          <div className="absolute top-2.5 h-3 rounded-sm border border-danger/40 bg-danger/10" style={{ left: x(e.tLo), width: `calc(${x(e.tHi)} - ${x(e.tLo)})` }} />
          {e.ticks.map((t, i) => (
            <i key={i} className="absolute top-[13px] size-1.5 -translate-x-1/2 rounded-full bg-danger-soft/70" style={{ left: x(t) }} />
          ))}
          <i className="absolute top-1 h-6 w-0.5 -translate-x-1/2 bg-danger-soft" style={{ left: x(e.tMed) }} />
          <span className="num absolute -bottom-1 -translate-x-1/2 text-[10px] text-dimmer" style={{ left: x(lo + 10) }}>
            {clock(lo + 10)}
          </span>
          <span className="num absolute -bottom-1 -translate-x-1/2 text-[10px] text-dimmer" style={{ left: x(hi - 10) }}>
            {clock(hi - 10)}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-line px-4 py-3 text-[13.5px] leading-relaxed text-dim">
        {s.peek != null ? 'At ' : 'Right now, at '}
        <span className="num text-text">{clock(s.t)}</span>, the {zone.name.toLowerCase()} is <b className="text-text">{denWords(nowDen)}</b> <span className="num">({nowDen.toFixed(1)} people/m²)</span>. {nowDen < 2 && s.peek == null ? 'Nothing on a camera would look wrong yet.' : null}
      </div>

      <div className="flex flex-col gap-2">
        <Button
          variant="solid"
          size="lg"
          onClick={() => {
            unlock(3);
            goStep(3);
          }}
        >
          Why does it break?
        </Button>
        {s.peek == null ? (
          <Button variant="ghost" onClick={() => setPeek(s.base.worst.tick)}>
            Peek at {clock(s.base.worst.tick)} if you do nothing
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => setPeek(null)}>
            Back to now
          </Button>
        )}
      </div>
    </div>
  );
}
