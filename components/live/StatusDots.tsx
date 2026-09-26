'use client';
/*
 * Bottom row — six small dots, one per bucket (lib/buckets.ts), each Safe/Watch/Act. Click a dot
 * to see its risks in the 'bucket' drawer. Every number behind a dot is read off SimResult/
 * Scenario; nothing here recomputes a simulation.
 */
import { useSlice } from '@/lib/createStore';
import { liveBuckets, openBucket, store } from '@/lib/console';
import { cx } from '@/components/ui';
import type { BucketStatus } from '@/lib/buckets';

const DOT: Record<BucketStatus, string> = { safe: 'bg-safe', watch: 'bg-brass', act: 'bg-danger' };

export default function StatusDots() {
  const buckets = useSlice(store, (s) => liveBuckets(s));
  return (
    <div className="no-print flex items-center justify-center gap-1 overflow-x-auto px-3 py-2">
      {buckets.map((b) => (
        <button
          key={b.id}
          onClick={() => openBucket(b.id)}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] text-dim transition-colors hover:bg-panel-2 hover:text-text"
          title={b.headline}
        >
          <i className={cx('size-2 shrink-0 rounded-full', DOT[b.status])} />
          <span className="whitespace-nowrap">{b.label}</span>
        </button>
      ))}
    </div>
  );
}
