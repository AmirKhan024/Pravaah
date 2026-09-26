import type { ReactNode } from 'react';

export function StepHead({ n, verb, title, children }: { n: number; verb: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="rise">
      <div className="kicker !text-brass-dim">
        {String(n).padStart(2, '0')} · {verb}
      </div>
      <h2 className="mt-1.5 font-display text-[32px] leading-[1.05] tracking-[-0.01em] text-text">{title}</h2>
      {children ? <p className="mt-2.5 text-[14px] leading-relaxed text-dim">{children}</p> : null}
    </div>
  );
}
