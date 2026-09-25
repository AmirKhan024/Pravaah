'use client';
import { useState } from 'react';
import { useSlice } from '@/lib/createStore';
import { clock, replayOutcome, runRedTeamFor, store, toast, log } from '@/lib/console';
import { buildOrders, LANGS, nudgeVars, paText, type OrderCard } from '@/lib/messages';
import { openRoom, roomStore } from '@/lib/room';
import { speak } from '@/lib/speak';
import { comma, inr, type Lang } from '@/engine';
import { Button, cx, Delta, Pill } from '@/components/ui';
import { StepHead } from './StepHead';

const KIND: Record<OrderCard['kind'], string> = { crowd: 'Message to the crowd', staff: 'Staff order', transport: 'Transport order', accommodation: 'Accommodation order', food: 'Food & services' };

function copy(text: string) {
  navigator.clipboard?.writeText(text).then(
    () => toast('Copied. Ready to send.'),
    () => toast('Could not copy. Select the text by hand.'),
  );
}

function CrowdCard({ card }: { card: OrderCard }) {
  const s = useSlice(store, (s) => ({ scn: s.scn, res: s.approved?.result, ivs: s.approved?.ivs }));
  const [lang, setLang] = useState<Lang>('mr');
  const [polished, setPolished] = useState<Partial<Record<Lang, string>>>({});
  const [busy, setBusy] = useState(false);
  const base = card.langs!.find((l) => l.lang === lang)!.text;
  const text = polished[lang] || base;
  const iv = s.ivs?.find((x) => x.type === 'nudge' && x.cohort === card.cohort) as { rupees: number; delta?: number } | undefined;
  const v = s.res && card.cohort ? nudgeVars(s.scn, card.cohort, s.res, iv?.rupees || 0, iv?.delta) : null;
  const polish = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/llm/polish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: base, lang }) }).then((x) => x.json());
      if (r.ok) {
        setPolished((p) => ({ ...p, [lang]: r.text }));
        toast('Re-worded. Every number is still the engine’s.');
      } else toast(r.reason === 'offline' ? 'Offline: using the fixed template.' : 'Kept the template: ' + (r.reason || 'no change'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-xl border border-line bg-panel-2/60 p-4">
      <div className="kicker mb-1">{KIND.crowd}</div>
      <div className="text-[14px] font-semibold leading-snug">{card.title}</div>
      {card.sub ? <div className="mt-1 text-[12px] text-dim">{card.sub}</div> : null}
      <div className="mt-3 flex gap-1">
        {LANGS.map((l) => (
          <button key={l.id} onClick={() => setLang(l.id)} className={cx('rounded-md px-2.5 py-1 text-[12px]', lang === l.id ? 'bg-ink text-brass' : 'text-dim hover:text-text')}>
            {l.native}
          </button>
        ))}
      </div>
      <div className={cx('mt-2 rounded-lg border border-line-soft bg-ink/70 px-3 py-2.5 text-[15px] leading-relaxed', lang !== 'en' && 'font-deva')}>{text}</div>
      {polished[lang] ? <div className="mt-1 text-[10.5px] text-dimmer">re-worded by the language model · numbers locked and re-inserted from the simulation</div> : null}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button
          size="sm"
          onClick={() => {
            if (!v) return;
            const r = speak(paText(lang, v), lang);
            toast(r.ok ? `Playing on the PA${r.voice ? ' · ' + r.voice : ''}` : 'This browser has no speech engine.');
          }}
        >
          ▶ Play on the PA
        </Button>
        <Button size="sm" onClick={() => copy(text)}>
          Copy
        </Button>
        <Button size="sm" variant="quiet" disabled={busy} onClick={polish}>
          {busy ? 'Re-wording…' : 'Re-word for the PA'}
        </Button>
        <SmsButton text={text} />
      </div>
    </div>
  );
}

function SmsButton({ text }: { text: string }) {
  const send = async () => {
    const to = window.prompt('Send this as an SMS to (a volunteer’s number, e.g. +91…):');
    if (!to) return;
    const r = await fetch('/api/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to, text }) })
      .then((x) => x.json())
      .catch(() => ({ ok: false }));
    if (r.ok) {
      toast('Sent.');
      log('orders_sent', 'Sent one SMS to a volunteer’s phone.', { chars: text.length });
    } else {
      copy(text);
      toast((r.reason || 'SMS failed') + '. Copied instead.');
    }
  };
  return (
    <Button size="sm" variant="quiet" onClick={send}>
      Send SMS
    </Button>
  );
}

export default function Guide() {
  const s = useSlice(store, (s) => ({ approved: s.approved, base: s.base, scn: s.scn, rc: s.raviCur, rg: s.raviGhost, rt: s.redTeam, rtFor: s.redTeamFor, rtBusy: s.redTeamBusy }));
  const room = useSlice(roomStore, (r) => ({ id: r.id, people: r.snap?.participants.length || 0, result: r.result }));
  const a = s.approved;
  if (!a)
    return (
      <div className="flex flex-col gap-5">
        <StepHead n={5} verb="Guide" title="Nothing approved yet">
          Approve a plan in step 4. Pravaah turns it into orders for hotels, transport, gate staff and every phone in the crowd.
        </StepHead>
      </div>
    );
  const r = a.result;
  const cards = buildOrders(s.scn, a.ivs, r);
  const peak = (x: number[]) => Math.max(...x).toFixed(1);
  return (
    <div className="flex flex-col gap-5">
      <StepHead n={5} verb="Guide" title="Send the orders.">
        “{a.name}” approved at <span className="num text-text">{clock(a.tick)}</span>. Everything below is ready to send. Every number in it comes from the run you just approved.
      </StepHead>

      <div className="rounded-xl border border-safe/35 bg-[#122019] p-4">
        <div className="kicker mb-2 !text-safe">What changes · re-run from {clock(a.tick)}</div>
        <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-[13px]">
          <span className="text-dim">Dangerous minutes</span>
          <Delta from={s.base.crushMin} to={r.crushMin} />
          <span className="text-dim">Most crowded spot</span>
          <Delta from={peak(s.base.peakDen)} to={peak(r.peakDen)} unit="/m²" />
          <span className="text-dim">Longest gate wait</span>
          <Delta from={Math.round(s.base.maxGateWait)} to={Math.round(r.maxGateWait)} unit="min" />
          <span className="text-dim">Outside at showtime</span>
          <Delta from={comma(s.base.missed)} to={comma(r.missed)} />
          <span className="text-dim">Cost</span>
          <span className="num text-right font-semibold text-brass">{r.rupees ? inr(r.rupees) : '₹0'}</span>
        </div>
        {s.scn.id === 'dyPatil' && s.rg ? (
          <div className="mt-3 border-t border-safe/20 pt-3 text-[12.5px] leading-relaxed text-dim">
            Ravi and Aarohi get in at <b className="num text-text">{clock(s.rc.inside)}</b> instead of <span className="num">{clock(s.rg.inside)}</span>. The tightest crowd around them: <b className="num text-text">{s.rc.worst.toFixed(1)}</b> instead of <span className="num">{s.rg.worst.toFixed(1)}</span> people/m².
          </div>
        ) : null}
        {a.roomNote ? <div className="mt-2 text-[12px] text-brass">{a.roomNote} Re-run with the room&apos;s choices.</div> : null}
      </div>

      <div className="rounded-xl border border-brass-dim/60 bg-[#1d1c14] p-4">
        <div className="flex items-center justify-between">
          <span className="kicker !mb-0 !text-brass">The Room</span>
          {room.id ? <Pill tone="brass">{room.people} phones</Pill> : null}
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-dim">Send this plan&apos;s message to every phone in the audience. Their yes and no replace the model&apos;s guess, and the evening re-runs.</p>
        {room.result ? (
          <p className="mt-2 text-[13px]">
            The room said yes <b className="num text-safe">{Math.round(room.result.roomYes * 100)}%</b>; the model predicted <b className="num">{Math.round(room.result.modelYes * 100)}%</b>.
          </p>
        ) : null}
        <Button variant="solid" className="mt-3 w-full" onClick={openRoom}>
          {room.id ? 'Show the room' : 'Open the room'}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {cards.map((c, i) =>
          c.kind === 'crowd' ? (
            <CrowdCard key={i} card={c} />
          ) : (
            <div key={i} className="rounded-xl border border-line bg-panel-2/60 p-4">
              <div className="kicker mb-1">{KIND[c.kind]}</div>
              <div className="text-[14px] font-semibold leading-snug">{c.title}</div>
              <div className="mt-1.5 text-[13px] leading-relaxed text-dim">{c.body}</div>
              <div className="mt-3 flex gap-1.5">
                <Button size="sm" onClick={() => copy(c.body || '')}>
                  Copy
                </Button>
                <SmsButton text={c.body || ''} />
              </div>
            </div>
          ),
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={replayOutcome}>Replay the evening</Button>
        <Button onClick={() => store.setState({ drawer: 'report' })}>After-action report</Button>
        <Button className="col-span-2" disabled={s.rtBusy} onClick={() => (s.rt && s.rtFor === a.name ? store.setState({ drawer: 'redteam' }) : runRedTeamFor())}>
          {s.rt && s.rtFor === a.name ? `Red team: safe on ${s.rt.survived} of ${s.rt.total} rough nights →` : 'Red team this plan'}
        </Button>
      </div>
    </div>
  );
}
