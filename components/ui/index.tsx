'use client';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

type BtnVariant = 'solid' | 'ghost' | 'quiet' | 'danger';
export function Button({ variant = 'ghost', size = 'md', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[background,color,border-color,transform] duration-150 active:scale-[.985] disabled:opacity-40',
        size === 'sm' && 'h-8 px-3 text-[12.5px]',
        size === 'md' && 'h-10 px-4 text-[13.5px]',
        size === 'lg' && 'h-12 px-5 text-[15px]',
        variant === 'solid' && 'bg-brass text-ink hover:bg-brass-glow',
        variant === 'ghost' && 'border border-line bg-panel-2/60 text-text hover:border-brass-dim hover:bg-panel-2',
        variant === 'quiet' && 'text-dim hover:bg-panel-2 hover:text-text',
        variant === 'danger' && 'border border-danger/50 bg-danger/10 text-danger-soft hover:bg-danger/20',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Kicker({ children, right, className }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cx('mb-2 flex items-baseline justify-between gap-3', className)}>
      <span className="kicker">{children}</span>
      {right ? <span className="text-[11px] text-dimmer">{right}</span> : null}
    </div>
  );
}

export function Card({ children, className, tone }: { children: ReactNode; className?: string; tone?: 'default' | 'brass' | 'danger' | 'safe' }) {
  return (
    <div
      className={cx(
        'rounded-xl border p-4',
        (!tone || tone === 'default') && 'border-line bg-panel-2/70',
        tone === 'brass' && 'border-brass-dim/60 bg-[#1d1c14]',
        tone === 'danger' && 'border-danger/40 bg-[#221512]',
        tone === 'safe' && 'border-safe/35 bg-[#122019]',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** a number that always travels with its do-nothing counterpart (copy rule §13) */
export function Delta({ from, to, unit, better = 'lower', big }: { from: ReactNode; to: ReactNode; unit?: string; better?: 'lower' | 'higher'; big?: boolean }) {
  const f = Number(String(from).replace(/[^0-9.-]/g, ''));
  const t = Number(String(to).replace(/[^0-9.-]/g, ''));
  const good = isNaN(f) || isNaN(t) ? null : better === 'lower' ? t < f : t > f;
  const same = f === t;
  return (
    <span className={cx('num inline-flex items-baseline gap-1.5', big ? 'text-[22px]' : 'text-[14px]')}>
      <span className="text-dim line-through decoration-dimmer/60">{from}</span>
      <span className="text-dimmer">→</span>
      <span className={cx('font-semibold', same ? 'text-text' : good ? 'text-safe' : 'text-danger-soft')}>{to}</span>
      {unit ? <span className="text-[12px] text-dim">{unit}</span> : null}
    </span>
  );
}

export function Row({ k, v, className }: { k: ReactNode; v: ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-baseline justify-between gap-4 border-b border-line-soft py-2 last:border-0', className)}>
      <span className="text-[13px] text-dim">{k}</span>
      <span className="text-right text-[13.5px]">{v}</span>
    </div>
  );
}

export function Progress({ f, className }: { f: number; className?: string }) {
  return (
    <div className={cx('h-1 w-full overflow-hidden rounded-full bg-line', className)}>
      <div className="h-full rounded-full bg-brass transition-[width] duration-300" style={{ width: Math.round(Math.max(0.02, Math.min(1, f)) * 100) + '%' }} />
    </div>
  );
}

export function Busy({ label, f }: { label: string; f?: number }) {
  return (
    <div className="flex flex-col gap-2 py-2">
      <div className="text-[12.5px] text-dim">{label}</div>
      {f != null ? <Progress f={f} /> : <div className="busy-bar h-1 rounded-full bg-line" />}
    </div>
  );
}

export function Pill({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'brass' | 'danger' | 'safe' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em]',
        tone === 'default' && 'border-line text-dim',
        tone === 'brass' && 'border-brass-dim text-brass',
        tone === 'danger' && 'border-danger/50 text-danger-soft',
        tone === 'safe' && 'border-safe/50 text-safe',
      )}
    >
      {children}
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  // three currents converging into one — "pravaah" means flow
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M3 9c7 0 9 7 16 7h10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity=".55" />
      <path d="M3 16h26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M3 23c7 0 9-7 16-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity=".55" />
      <circle cx="27" cy="16" r="2.6" fill="currentColor" />
    </svg>
  );
}
