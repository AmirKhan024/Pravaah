'use client';
import { useSlice } from '@/lib/createStore';
import { store } from '@/lib/console';

/** shared by the five-step console and Live Ops — one toast implementation, not two */
export default function Toast() {
  const t = useSlice(store, (s) => s.toast);
  if (!t) return null;
  return <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg border border-line bg-panel-2 px-4 py-2.5 text-[13px] shadow-xl rise">{t}</div>;
}
