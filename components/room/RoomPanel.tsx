'use client';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { useSlice } from '@/lib/createStore';
import { closeRoom, resetRoomVotes, roomStore, runWithRoom, sendToRoom, simulateRoom } from '@/lib/room';
import { store } from '@/lib/console';
import { comma } from '@/engine';
import { Button, cx, Delta, Logo } from '@/components/ui';

function useNow(ms = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(i);
  }, [ms]);
  return now;
}

export default function RoomPanel() {
  const r = useSlice(roomStore, (s) => s);
  const c = useSlice(store, (s) => ({ approved: s.approved, base: s.base }));
  const [qr, setQr] = useState('');
  const now = useNow();
  useEffect(() => {
    if (r.url) QRCode.toDataURL(r.url, { margin: 1, width: 520, color: { dark: '#101715', light: '#DCE5E1' } }).then(setQr);
  }, [r.url]);
  if (!r.open) return null;
  const snap = r.snap;
  const people = snap?.participants.length || 0;
  const bc = snap?.broadcast;
  const left = bc ? Math.max(0, Math.ceil((bc.closesAt - now) / 1000)) : 0;
  const votes = snap ? Object.entries(snap.votes) : [];
  const yes = votes.filter(([, v]) => v.choice === 'yes').length;
  const byCohort = (id: string) => snap?.participants.filter((p) => p.cohort === id).length || 0;

  return (
    <div className="fixed inset-0 z-50 flex bg-ink/97 backdrop-blur-sm fadein" role="dialog" aria-label="The Room">
      <button onClick={closeRoom} className="absolute right-6 top-5 rounded-lg px-3 py-1.5 text-[13px] text-dim hover:bg-panel-2 hover:text-text">
        Close ✕
      </button>
      <div className="m-auto grid w-full max-w-[1180px] grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-14 px-10">
        <div className="flex flex-col items-center">
          {r.offline ? (
            <div className="grid aspect-square w-full max-w-[420px] place-items-center rounded-3xl border border-line p-10 text-center text-dim">No network here. The room is running as a simulation on this machine.</div>
          ) : qr ? (
            <img src={qr} alt="QR code to join the room" className="aspect-square w-full max-w-[420px] rounded-3xl" />
          ) : (
            <div className="aspect-square w-full max-w-[420px] rounded-3xl bg-panel-2 busy-bar" />
          )}
          <div className="mt-5 text-center">
            <div className="kicker">Room code</div>
            <div className="num mt-1 text-[40px] font-semibold tracking-[0.06em] text-brass">{r.id}</div>
            {r.url ? <div className="num mt-1 text-[13px] text-dim">{r.url}</div> : null}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <div className="flex items-center gap-2 text-brass">
              <Logo className="size-6" />
              <span className="kicker !text-brass">The Room</span>
            </div>
            <h2 className="mt-2 font-display text-[54px] leading-[1.02]">You are in the crowd tonight.</h2>
            <p className="mt-3 max-w-[520px] text-[16px] leading-relaxed text-dim">
              Scan the code. Your phone becomes one of the {comma(snap?.cohorts.reduce((a, x) => a + x.size, 0) || 0)} people on their way in. When the control room acts, you get the message. Your choice changes the simulation.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-panel/80 p-5">
            <div className="flex items-baseline justify-between">
              <span className="kicker !mb-0">Phones in the crowd</span>
              <span className="num text-[40px] font-semibold leading-none">{people}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {snap?.cohorts.map((co) => (
                <div key={co.id} className="flex items-center justify-between rounded-lg border border-line-soft px-3 py-2 text-[12.5px]">
                  <span className="truncate text-dim">{co.label}</span>
                  <span className="num font-semibold">{byCohort(co.id)}</span>
                </div>
              ))}
            </div>
          </div>

          {bc ? (
            <div className="rounded-2xl border border-brass-dim/60 bg-[#1d1c14] p-5 rise">
              <div className="flex items-baseline justify-between">
                <span className="kicker !mb-0 !text-brass">{left > 0 ? 'Message sent · phones are deciding' : 'Voting closed'}</span>
                <span className="num text-[28px] font-semibold text-brass">{left > 0 ? `0:${String(left).padStart(2, '0')}` : '0:00'}</span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-line">
                  <div className="h-full bg-safe transition-[width] duration-500" style={{ width: votes.length ? (yes / votes.length) * 100 + '%' : '0%' }} />
                </div>
                <span className="num text-[14px]">
                  <b className="text-safe">{yes}</b> yes · <b className="text-danger-soft">{votes.length - yes}</b> no
                </span>
              </div>
            </div>
          ) : null}

          {r.result ? (
            <div className="rounded-2xl border border-safe/40 bg-[#112019] p-5 rise">
              <div className="font-display text-[34px] leading-tight">
                The room said yes <span className="num text-safe">{Math.round(r.result.roomYes * 100)}%</span>. The model predicted <span className="num text-brass">{Math.round(r.result.modelYes * 100)}%</span>.
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-[14px] text-dim">
                <span>
                  Dangerous minutes, re-run with your choices: <Delta from={c.base.crushMin} to={r.result.crushAfter} big />
                </span>
              </div>
              <div className="mt-2 text-[12px] text-dimmer">
                {r.result.votes} votes. Groups with fewer than 2 votes keep the model&apos;s estimate. This is a small-sample check on a hand-set assumption, and we say so.
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {!c.approved ? (
              <div className="text-[13px] text-dim">Approve a plan in the console to send its message to every phone.</div>
            ) : !bc ? (
              <Button variant="solid" size="lg" onClick={() => sendToRoom(25)}>
                Send the plan&apos;s message to every phone
              </Button>
            ) : (
              <>
                <Button variant="solid" size="lg" disabled={r.running || votes.length === 0} onClick={runWithRoom} className={cx(left > 0 && 'opacity-90')}>
                  {r.running ? 'Re-running the evening…' : 'Run the evening with the room'}
                </Button>
                <Button variant="ghost" size="lg" onClick={resetRoomVotes}>
                  Reset votes
                </Button>
              </>
            )}
            <Button variant="quiet" size="lg" onClick={() => simulateRoom(24)} title="Fallback if the network dies: fake phones that vote with the model's own probability">
              Simulate 24 phones
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
