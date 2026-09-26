'use client';
import dynamic from 'next/dynamic';

const Setup = dynamic(() => import('@/components/setup/Setup'), {
  ssr: false,
  loading: () => <div className="grid h-dvh place-items-center bg-ink text-[13px] text-dim">Loading…</div>,
});

export default function SetupLoader() {
  return <Setup />;
}
