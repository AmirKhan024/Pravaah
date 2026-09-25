'use client';
import { useSlice } from '@/lib/createStore';
import { clock, store, viewTick } from '@/lib/console';
import { denColor, denWords } from '@/lib/colors';
import { CRUSH, comma, personAt, RAVI, trendWarning, type SimResult } from '@/engine';
import { cx } from '@/components/ui';

function worstNow(res: SimResult, t: number, scnZones: { name: string }[], scnLinks: { name: string }[]) {
  const f = res.frames[t];
  let d = 0,
    where = '';
  f.zoneDen.forEach((v, i) => {
    if (v > d) {
      d = v;
      where = scnZones[i].name;
    }
  });
  f.linkDen.forEach((v, i) => {
    if (v > d) {
      d = v;
      where = scnLinks[i].name;
    }
  });
  const gw = Math.max(0, ...Object.values(f.gateWait));
  return { d, where, gw, outside: 0, crush: f.crush, arrived: f.arrived };
}

export function Readouts() {
  const s = useSlice(store, (s) => ({ t: viewTick(s), cur: s.cur, ghost: s.ghost, scn: s.scn, peek: s.peek }));
  const cap = s.scn.zones.find((z) => z.type === 'venue')?.capacity || 0;
  const now = worstNow(s.cur, s.t, s.scn.zones, s.scn.links);
  const g = s.ghost && s.ghost !== s.cur ? worstNow(s.ghost, s.t, s.scn.zones, s.scn.links) : null;
  const trend = s.peek == null ? trendWarning(s.scn, s.cur, s.t) : null;

  const items = [
    { k: 'Most crowded spot', v: now.d.toFixed(1), u: '/m²', sub: now.d > 0.4 ? `${denWords(now.d)} · ${now.where}` : 'calm everywhere', gv: g ? g.d.toFixed(1) : null, color: denColor(now.d) },
    { k: 'Dangerous minutes so far', v: String(Math.round(now.crush)), u: '', sub: 'minutes any place was above 4 people/m²', gv: g ? String(Math.round(g.crush)) : null, danger: now.crush > 0 },
    { k: 'Longest wait at a gate', v: String(Math.round(now.gw)), u: 'min', sub: 'from the back of the queue', gv: g ? String(Math.round(g.gw)) : null },
    { k: 'Still outside', v: comma(cap - now.arrived), u: '', sub: `of ${comma(cap)}`, gv: g ? comma(cap - g.arrived) : null },
  ];

  return (
    <div className="pointer-events-auto w-[272px] overflow-hidden rounded-2xl border border-line bg-ink/88 backdrop-blur-[3px]">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="kicker !mb-0">{s.peek != null ? `Peeking at ${clock(s.t)}` : `Right now · ${clock(s.t)}`}</span>
      </div>
      <div className="divide-y divide-line-soft">
        {items.map((it) => (
          <div key={it.k} className="px-4 py-2.5">
            <div className="text-[11.5px] text-dim">{it.k}</div>
            <div className="flex items-baseline gap-1.5">
              <span className={cx('num text-[24px] font-semibold leading-tight', it.danger && 'text-danger-soft')} style={it.color && now.d >= 2 ? { color: it.color } : undefined}>
                {it.v}
              </span>
              <span className="text-[12px] text-dim">{it.u}</span>
            </div>
            <div className="truncate text-[11px] text-dimmer">{it.sub}</div>
            {it.gv != null ? <div className="num mt-0.5 text-[11px] text-danger-soft/80">if you did nothing: {it.gv}</div> : null}
          </div>
        ))}
      </div>
      {trend ? (
        <div className="border-t border-d3/40 bg-[#221c10] px-4 py-2.5 text-[12px] leading-snug text-brass-glow">
          Trending toward crush at {trend.name} in about {Math.max(1, Math.round(trend.mins))} min
          <div className="mt-0.5 text-[10.5px] text-dim">straight line through the last 8 minutes played · never reads ahead</div>
        </div>
      ) : null}
    </div>
  );
}

export function RaviCard() {
  const s = useSlice(store, (s) => ({ t: viewTick(s), cur: s.cur, ghost: s.ghost, tr: s.raviCur, gtr: s.raviGhost, scn: s.scn }));
  if (s.scn.id !== 'dyPatil' || s.t < RAVI.release - 26) return null;
  const a = personAt(s.tr, s.cur, s.t),
    seg = a.seg;
  let state = '',
    meta = '';
  let danger = false;
  if (s.t < RAVI.release) {
    state = 'On the 18:32 train from Dombivli.';
    meta = `reaches Nerul at ${clock(RAVI.release)}`;
  } else if (seg.type === 'inside') {
    const late = seg.from - s.scn.showStartTick;
    state = 'Inside the bowl.';
    meta = `through the gate at ${clock(seg.from)} · ${late > 0 ? late + ' min late for the show' : Math.abs(late) + ' min before the show'}`;
  } else if (seg.type === 'move') {
    const l = s.scn.links.find((x) => x.id === seg.link)!;
    state = `${l.mode === 'walk' ? 'Walking' : 'Travelling'} the ${l.name.replace(/^the /i, '')}.`;
    meta = `${Math.max(1, Math.round((1 - (a.prog || 0)) * (seg.to - seg.from)))} min to go`;
  } else {
    const z = s.scn.zones[seg.zi],
      den = a.den || 0;
    danger = den >= CRUSH;
    const held = den >= 5 && seg.inLink != null;
    state = held ? `Held on the ${s.scn.links[seg.inLink!].name}. He cannot move forward.` : z.type === 'gate' ? `At the ${z.name} turnstile.` : `Waiting at the ${z.name}.`;
    meta = `not moving for ${a.waited || 0} min · crowd around him ${den.toFixed(1)}/m²`;
  }
  let ghostLine: string | null = null;
  if (s.gtr && s.ghost && s.ghost !== s.cur && s.t >= RAVI.release) {
    const ga = personAt(s.gtr, s.ghost, s.t),
      gs = ga.seg;
    if (gs.type === 'inside') ghostLine = `inside at ${clock(gs.from)}`;
    else if (gs.type === 'move') ghostLine = `still on the ${s.scn.links.find((x) => x.id === gs.link)!.name}`;
    else ghostLine = `standing at ${s.scn.zones[gs.zi].name}, ${(ga.den || 0).toFixed(1)}/m²`;
  }
  return (
    <div className={cx('pointer-events-auto w-[272px] rounded-2xl border bg-ink/88 p-4 backdrop-blur-[3px] rise', danger ? 'border-danger/50' : 'border-brass-dim/50')}>
      <div className="flex items-center gap-2.5">
        <span className={cx('grid size-8 place-items-center rounded-full border text-[12px] font-semibold', danger ? 'border-danger/60 text-danger-soft' : 'border-brass-dim text-brass')}>RS</span>
        <div className="leading-tight">
          <div className="text-[13.5px] font-semibold">{RAVI.name}</div>
          <div className="text-[11px] text-dim">with his daughter {RAVI.with} · from {RAVI.from}</div>
        </div>
      </div>
      <div className={cx('mt-3 text-[14px] font-medium leading-snug', danger && 'text-danger-soft')}>{state}</div>
      <div className="mt-0.5 text-[11.5px] text-dim">{meta}</div>
      <div className="mt-3 flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <i key={i} className={cx('h-1 flex-1 rounded-full', i < a.stage ? 'bg-safe/70' : i === a.stage ? (danger ? 'bg-danger' : 'bg-brass') : 'bg-line')} />
        ))}
      </div>
      {ghostLine ? <div className="mt-3 border-t border-line pt-2.5 text-[11.5px] leading-snug text-dim">If you had done nothing, right now he would be {ghostLine}.</div> : null}
      <div className="mt-2 text-[10px] text-dimmer">Not scripted. He queues behind whoever is ahead of him in the simulation.</div>
    </div>
  );
}
