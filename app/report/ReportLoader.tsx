'use client';
import dynamic from 'next/dynamic';

const Report = dynamic(() => import('@/components/report/Report'), {
  ssr: false,
  loading: () => (
    <div className="grid h-dvh place-items-center bg-ink">
      <div className="flex flex-col items-center gap-3">
        <div className="kicker">Pravaah</div>
        <div className="text-[13px] text-dim">Loading the after-event report…</div>
      </div>
    </div>
  ),
});

export default function ReportLoader() {
  return <Report />;
}
