'use client';
/* Light/Night switch (docs/DECISIONS.md, 2026-09-26). A per-viewer preference (lib/theme.ts),
 * not console state — it doesn't belong in lib/console.ts's shared ConsoleState. */
import { useEffect, useState } from 'react';
import { getTheme, setTheme, type Theme } from '@/lib/theme';
import { cx } from '@/components/ui';

export default function ThemeToggle() {
  const [theme, setLocal] = useState<Theme>('light');
  useEffect(() => setLocal(getTheme()), []);

  const pick = (t: Theme) => {
    setLocal(t);
    setTheme(t);
  };

  return (
    <div role="radiogroup" aria-label="Light or Night theme" className="flex items-center gap-0.5 rounded-full border border-line bg-panel-2/60 p-0.5">
      {(['light', 'dark'] as const).map((t) => (
        <button
          key={t}
          role="radio"
          aria-checked={theme === t}
          onClick={() => pick(t)}
          className={cx('rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors', theme === t ? 'bg-panel text-text shadow-[var(--shadow-card)]' : 'text-dim hover:text-text')}
        >
          {t === 'light' ? 'Light' : 'Night'}
        </button>
      ))}
    </div>
  );
}
