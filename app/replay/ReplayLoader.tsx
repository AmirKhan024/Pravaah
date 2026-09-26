'use client';
import dynamic from 'next/dynamic';

const Replay = dynamic(() => import('@/components/replay/Replay'), {
  ssr: false,
  loading: () => <div className="grid h-dvh place-items-center bg-ink text-[13px] text-dim">Loading the reconstruction…</div>,
});

export default function ReplayLoader() {
  return <Replay />;
}
