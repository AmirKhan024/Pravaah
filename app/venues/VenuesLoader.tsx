'use client';
import dynamic from 'next/dynamic';

const Venues = dynamic(() => import('@/components/venues/Venues'), {
  ssr: false,
  loading: () => <div className="grid h-dvh place-items-center bg-ink text-[13px] text-dim">Loading venues…</div>,
});

export default function VenuesLoader() {
  return <Venues />;
}
