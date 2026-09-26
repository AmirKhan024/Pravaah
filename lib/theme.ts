'use client';
/*
 * Light/Night theme switch (docs/DECISIONS.md, 2026-09-26). Light is the default; Night
 * reproduces the original SOURCE_OF_TRUTH §13 control-room palette (app/globals.css). The
 * choice is a per-viewer convenience — stored in localStorage only, never shared state — so it
 * is read defensively and never blocks rendering if storage is unavailable.
 */
export type Theme = 'light' | 'dark';
const KEY = 'pravaah:theme';

export function getTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* private window / blocked storage: fall through to default */
  }
  return 'light';
}

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* per-viewer convenience only — losing it is fine */
  }
}

/** the inline script's source, run before hydration to avoid a flash of the wrong theme */
export const THEME_BOOTSTRAP = `try{var t=localStorage.getItem('${KEY}');document.documentElement.dataset.theme=(t==='dark')?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}`;
