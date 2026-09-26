# UI design reference

Everything the front end actually uses for typography, color, and shared components — fonts,
CSS custom properties, utility classes, and the shared primitives in `components/ui/index.tsx`.
This is a reference of what's in the code today, not a spec to redesign from; if it and the code
disagree, the code is right and this file is stale.

Two themes exist: **Light** (default, from the approved `reference/ui-mockup.html`) and **Night**
(the original SOURCE_OF_TRUTH §13 control-room palette, preserved byte-for-byte). See
`docs/DECISIONS.md`, 2026-09-26, for why both exist and how Night is guaranteed pixel-identical to
the pre-migration app.

---

## 1. Fonts

Declared once in `app/layout.tsx` via `next/font/google`, each bound to a CSS variable and applied
to `<html>`'s `className`:

| Font | Variable | Weights loaded | Used for |
|---|---|---|---|
| **Inter** | `--font-inter` | default | body text — `--font-sans` |
| **JetBrains Mono** | `--font-jbmono` | default | all numerals — `--font-mono` |
| **Instrument Serif** | `--font-serif` | 400, italic | headings — `--font-display` |
| **Noto Sans Devanagari** | `--font-deva` | 400, 500, 600 | Hindi/Marathi text — `--font-deva` |

These four map to the `--font-*` theme tokens in `app/globals.css`, which is what Tailwind's
`font-sans` / `font-mono` / `font-display` / `font-deva` utilities actually resolve to:

```css
--font-sans: var(--font-inter), ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
--font-mono: var(--font-jbmono), ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace;
--font-display: var(--font-serif), Georgia, 'Times New Roman', serif;
--font-deva: var(--font-deva), var(--font-inter), sans-serif;
```

`--font-sans` is also the plain `html, body` font — nearly everything is Inter unless a component
explicitly opts into `font-display` (headings, e.g. `StepHead.tsx`, the Decision Clock's
"You acted at…") or `font-deva` (crowd-message previews in Hindi/Marathi).

**Numerals:** anything that's a live, changing number (`.num` class or `num` Tailwind utility)
always renders in `--font-mono` with tabular figures, so digits never reflow the layout as they
tick over:

```css
.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
```

---

## 2. Color tokens

Defined once in `app/globals.css`'s `@theme` block (Light, the default) and re-declared under
`:root[data-theme='dark']` (Night). Tailwind v4 compiles utilities like `bg-ink` or `text-dim`
against the CSS variable, not a literal value — so `[data-theme]` on `<html>` re-themes every
existing class with no component changes needed.

| Token | Role | Light | Night |
|---|---|---|---|
| `--color-ink` | page background | `#f5f2ec` | `#101715` |
| `--color-ink-deep` | deeper background (map wrapper) | `#ede8dd` | `#0b1110` |
| `--color-panel` | card/surface background | `#ffffff` | `#16201e` |
| `--color-panel-2` | secondary surface (rows, inputs) | `#f6f3ec` | `#1b2624` |
| `--color-line` | borders | `#e6e1d7` | `#26322f` |
| `--color-line-soft` | subtler borders (row dividers) | `#efebe2` | `#1f2a28` |
| `--color-text` | primary text | `#143a35` | `#dce5e1` |
| `--color-dim` | secondary text | `#5b6f6b` | `#7a8a85` |
| `--color-dimmer` | tertiary/meta text | `#93a19d` | `#586662` |
| `--color-brass` | primary interactive/accent (teal in Light, gold in Night — same *role*, different hue per theme) | `#0f766e` | `#c9a961` |
| `--color-brass-dim` | brass's dim/border variant | `#b7d6cf` | `#8e7742` |
| `--color-brass-glow` | brass's hover/pressed variant | `#0b4f4a` | `#e8c87a` |
| `--color-accent` | secondary accent (CTA emphasis) | `#e8912d` | `#c9a961` (= brass in Night) |
| `--color-accent-dim` | accent's dim variant | `#f2cb98` | `#8e7742` |
| `--color-accent-glow` | accent's hover variant | `#c97a22` | `#e8c87a` |
| `--color-danger` | danger/error | `#e5484d` | `#e0634f` |
| `--color-danger-soft` | danger, softer (text on tinted bg) | `#c23b3f` | `#f0a594` |
| `--color-safe` | success/safe | `#2fa37a` | `#6fb39a` |

**Tone washes** — background tints for `Card`/`Band` "this state matters" surfaces (brass/danger
attention, plus a base/`strong`/`hover`/`urgent` variant where a component needs more than one
shade of the same tone):

| Token | Light | Night |
|---|---|---|
| `--tone-brass` | `#f0faf7` | `#1d1c14` |
| `--tone-brass-strong` | `#e3f1ec` | `#1b1a12` |
| `--tone-brass-strong-hover` | `#d8ece5` | `#211f16` |
| `--tone-danger` | `#fde6e6` | `#221512` |
| `--tone-danger-strong` | `#fbd9d9` | `#211310` |
| `--tone-danger-urgent` | `#f8c9c9` | `#241612` |
| `--tone-safe` | `#e3f6ee` | `#122019` |

**Density ramp — theme-invariant.** People-per-m² is a data encoding, not decoration, so these six
stops (`--color-d0` … `--color-d5`) never change between Light and Night — same as
`reference/ui-mockup.html`'s own density colors, and matching `lib/colors.ts`'s `denRGB()` ramp
exactly (`CRUSH`/`JAM` from `engine/constants.ts` mark the danger/jam breakpoints):

| Stop | Hex | Meaning |
|---|---|---|
| `--color-d0` | `#35555f` | empty |
| `--color-d1` | `#3f7a6b` | calm |
| `--color-d2` | `#9aa24b` | busy / getting busy |
| `--color-d3` | `#c79338` | crowded |
| `--color-d4` | `#cc5f2c` | dangerously tight (≥ `CRUSH`, 4.0/m²) |
| `--color-d5` | `#b02d1e` | jam (≥ `JAM`, 5.8/m²) |

Two matching vocabularies read off these same thresholds (`lib/colors.ts`) — pick the one that
fits the surface, don't invent a third:

- `denWords(d)` — the console/Live Ops narration voice ("so tight nobody can move", "shoulder to
  shoulder", "busy", "calm", "empty"). Used throughout the five-step console and readouts.
- `legendWord(d)` — the map's own short legend/pin-tag vocabulary ("Packed", "Too crowded",
  "Getting busy", "Comfortable"), matching `reference/ui-mockup.html`'s map legend wording.

---

## 3. Shape, shadow, motion

```css
--shadow-card: 0 10px 30px -12px rgba(20, 58, 53, 0.25);   /* Light */
--shadow-card: none;                                        /* Night — no shadow in the control-room look */
```

Border radius is not tokenized — components pick a literal Tailwind radius utility per element
(`rounded-lg` for buttons/rows, `rounded-xl`/`rounded-2xl` for cards, `rounded-full` for pills and
the theme toggle). There's no global "card radius" variable to change in one place; a redesign of
corner rounding means touching each component's className.

Motion:

```css
--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
```

- `.rise` — slide-up-and-fade-in entrance (`rise 0.5s var(--ease-out-quart) both`), used on cards
  and panels appearing for the first time.
- `.fadein` — plain fade (`0.6s ease both`).
- `.pulse-danger` — a soft repeating shadow pulse for urgent/danger states.
- `.busy-bar` — an indeterminate loading sweep (gradient sliding left→right).
- `.blink` — hard on/off blink, `steps(1)`.
- All of the above are disabled under `@media (prefers-reduced-motion: reduce)` (durations forced
  to `0.001ms`).

---

## 4. Utility classes

Beyond Tailwind's own utilities, `app/globals.css` defines a few bespoke ones used everywhere:

| Class | What it does |
|---|---|
| `.num` | tabular-nums, `--font-mono`, tighter tracking — every live/changing number |
| `.kicker` | 10.5px uppercase label, `--color-dimmer`, wide letter-spacing — section eyebrows ("DECISION CLOCK", "01 · REHEARSE") |
| `.hairline` | just `border-color: var(--color-line)` |
| `:focus-visible` | 2px `--color-brass` outline, 2px offset — the one focus ring, same in both themes |

---

## 5. Theme switching

`lib/theme.ts` + `components/console/ThemeToggle.tsx`:

- Preference is **per-viewer only** (`localStorage`, key `pravaah:theme`) — never shared state,
  never synced to the server.
- `document.documentElement.dataset.theme` is the single source of truth for which CSS block
  applies; `[data-theme='dark']` triggers Night, absence (or `'light'`) is Light.
- `app/layout.tsx` runs an inline `<script>` (`THEME_BOOTSTRAP`) before hydration so the stored
  theme applies with no flash of the wrong theme. This requires `suppressHydrationWarning` on
  `<html>` — the script's DOM mutation happens before React hydrates and isn't part of what React
  itself renders for that element, so without the flag React logs a false-positive mismatch
  warning (see `docs/DECISIONS.md`, Phase 1).
- Canvas-drawn surfaces (`components/map/FlowMap.tsx`, `components/cover/CoverFlow.tsx`) can't use
  CSS variables directly — each keeps its own small `PAL`/`PALETTE` object (Light/Night hex pairs)
  and reads `document.documentElement.dataset.theme === 'dark'` per animation frame.

---

## 6. Shared UI primitives (`components/ui/index.tsx`)

Every non-map component builds on these instead of writing raw Tailwind per instance:

- **`Button`** — variants `solid` (brass fill, primary action), `ghost` (bordered, default),
  `quiet` (text-only), `danger` (tinted red); sizes `sm`/`md`/`lg`.
- **`Card`** — tones `default`, `brass`, `danger`, `safe` (the tone washes above); base is
  `rounded-xl border p-4`.
- **`Pill`** — small uppercase rounded-full label; same four tones as `Card`.
- **`Kicker`** — a `.kicker` label with an optional right-aligned meta string.
- **`Row`** — a label/value line with a bottom hairline (`last:border-0`), for spec-sheet-style
  lists (After-action report, red-team results).
- **`Progress`** / **`Busy`** — a brass progress bar, or an indeterminate `.busy-bar` sweep when
  there's no fraction to show yet.
- **`Delta`** — "before → after" number pair (copy rule: a number never appears without its
  do-nothing counterpart); colors the "after" value safe/danger/neutral depending on whether it
  improved.
- **`Logo`** — the Pravaah mark (three converging currents), `currentColor` so it inherits
  whatever text color it's placed in.

---

## 7. Map-specific palette (`components/map/FlowMap.tsx`)

The console/Live Ops/cover-page map re-tints real MapLibre vector layers per theme
(`tintBasemapLight()` / `tintBasemapDark()`) and keeps a parallel `PAL.light` / `PAL.dark` object
for everything the canvas overlay draws on top (corridor colors, gate-pin ring color, label/halo
colors, the ghost-of-do-nothing overlay, Ravi's marker). Night's values there are the exact
originals from before this migration; Light's are new, matching `reference/ui-mockup.html`'s warm
parchment look. See the file itself for the full color table — it's long enough that duplicating
it here would just be a second copy to keep in sync.

---

## Where to look next

- `app/globals.css` — the tokens themselves (source of truth for every value in this doc).
- `app/layout.tsx` — font loading.
- `components/ui/index.tsx` — shared primitives.
- `lib/theme.ts` / `components/console/ThemeToggle.tsx` — the Light/Night switch.
- `lib/colors.ts` — the density ramp and both plain-language vocabularies.
- `docs/DECISIONS.md` — why the theme system is shaped this way, and what changed from the
  original dark-only control-room design.
