'use client';
import dynamic from 'next/dynamic';

// the engine runs in the browser; nothing to render on the server
const Console = dynamic(() => import('@/components/console/Console'), {
  ssr: false,
  loading: () => (
    <div className="grid h-dvh place-items-center bg-ink">
      <div className="flex flex-col items-center gap-3">
        <div className="kicker">Pravaah</div>
        <div className="text-[13px] text-dim">Loading the evening…</div>
      </div>
    </div>
  ),
});

export default function ConsoleLoader() {
  return <Console />;
}
