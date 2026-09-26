# Decisions log

Trade-offs and alternatives considered, appended per `SOURCE_OF_TRUTH.md` §14.11. Newest entry on top.
This is not a changelog (see `docs/PROGRESS.md` for that) — only entries where a real choice was made.

---

## 2026-09-26 — Phase 4: the console map — real MapLibre re-tinted, not a hand-drawn copy of the mockup

**Decision:** `FlowMap.tsx` keeps MapLibre and the real DY Patil coordinates exactly as before;
`tintBasemapLight()` re-tints the same real Carto vector layers (real roads/buildings/water/parks
at the real location) into the mockup's warm parchment palette, alongside the existing
`tintBasemapDark()` (renamed, values unchanged) for Night. Gate markers became teardrop pins
(`pin()`, matching `reference/ui-mockup.html`'s marker language); their label now leads with
`legendWord()` (plain-language density) before the raw `/m²` number. Added real map chrome: a
context pill (venue name), a live clock chip (`clockFor()`), zoom/reset, a compass, a legend, and
a hover tooltip showing each gate's actual capacity (`lanes × laneRate`) and demand (`linkFlow` on
its screening link) — every one of these reads real `Scenario`/`SimResult` data, none is invented.

**Why not draw the mockup's illustrated city (buildings/parks/water as canvas shapes):** that
geometry is fictional, hand-tuned for the mockup's own made-up layout. DY Patil's real roads,
buildings and water are already real vector data from Carto — retinting them keeps the "every
number/shape comes from something real" property (SOURCE_OF_TRUTH §13) while still adopting the
mockup's warm illustrated look. This also means Live Ops (`/live`), which renders the same
`FlowMap` component, gets the whole migration for free — verified via screenshot.

**Bugs found and fixed while wiring the hover tooltip (all via Playwright, not just reasoning):**
1. The overlay canvas was made interactive (`pointer-events: auto`) to receive hover coordinates,
   which silently broke MapLibre's own drag-to-pan/scroll-to-zoom underneath it (the overlay now
   ate all pointer events). Fixed by keeping the canvas `pointer-events-none` and reading hover
   position through MapLibre's own `map.on('mousemove')` API instead.
2. A first attempt at that used a DOM listener on the wrapper div, relying on event bubbling from
   MapLibre's internal canvas — which never fired, because MapLibre stops propagation on its own
   canvas's pointer events. Switching to `map.on('mousemove'/'mouseout')` (which MapLibre resolves
   internally, independent of bubbling) fixed it.
3. Hovering near Gate 1 showed Gate 5's tooltip: the per-frame hover-candidate variable was a
   single object overwritten by every gate/source zone in the draw loop, so only the *last* one
   (Gate 5, last in `zones[]`) ever survived to hit-test against. Fixed by collecting all
   candidates each frame and hit-testing against the nearest one.
4. The new zoom/compass controls (top-right) and legend (bottom-right) were invisible — not
   erroring, just visually covered by `Console.tsx`'s own opaque `Readouts`/`RaviCard` overlay
   (top-right) and `Timeline`'s full-width `bg-ink/92` band (bottom), both of which render after
   `FlowMap` in the DOM. Moved zoom/compass to top-left (below the context pill, the one corner
   nothing else claims) and the legend to clear Timeline's height. Left as a known minor gap: the
   legend's clearance is tuned for `/console`'s Timeline; on `/live` (no Timeline) it leaves a
   harmless extra gap rather than sitting flush with the bottom edge.

---

## 2026-09-26 — Cover page hero visual (CoverFlow.tsx): pin markers + theme-aware, not a second map

**Decision:** `components/cover/CoverFlow.tsx` — the live-simulated schematic on `/` (streams
flowing into Gate 1/3/5) — is what the user's screenshot of "the map, still in the old format"
actually showed, not the console's `FlowMap.tsx`. It's now theme-aware (a hand-picked Light/Night
`PALETTE`, since canvas draws can't use Tailwind classes) and its gate markers are teardrop pins
colour-coded by density with a plain-language status word (`legendWord()`, the same vocabulary as
the console map's legend) before the raw number, and origin rows get a small mode-coloured badge —
borrowing `reference/ui-mockup.html`'s pin/marker *language*, not its fictional geometry.

**Why not rebuild it as a literal copy of the mockup's illustrated city:** this component's own
header comment says it plainly — "the engine, not an illustration." It's an intentionally abstract
schematic (fixed fractional y-positions, not real lat/lng), and every particle, channel width and
gate colour already comes straight from `SimResult` frames. The mockup's roads/buildings/water/
stadium are hand-drawn for a fictional layout; copying that wholesale here would mean either (a)
faking geometry that doesn't correspond to any real computed value even though this panel's whole
purpose is proving nothing is faked, or (b) a large illustrated-map engine for a ~500px decorative
hero panel. The full illustrated-map treatment belongs on `FlowMap.tsx`, the actual interactive
console map operators use — that's next.

---

## 2026-09-26 — Simple-UI migration, Phase 2: What-ifs moved behind More; "All clear" is calm+approved, not a new status

**Decision:** `WhatIfBar` (the chip row + free-text question + result panel) no longer floats
permanently over the map. It's the same component, unchanged, now rendered inside a new
`whatif` drawer (`lib/console.ts`'s `Drawer` union gained one member) opened from the new **More**
menu. The old top-nav's "The Room" and "Black Box" buttons moved into the same menu, alongside
"Bad-night test," "Build your own plan," and "Ravi's trace" (which was already `ReportDrawer`'s
content) — every entry calls an existing store action or sets an existing drawer key; nothing new
was computed. "The Room" also stays reachable exactly as before via its own keyboard shortcut (`R`).

**Why:** §9/§11 of the brief ask for one main question per step and expert features "retained
behind More, Details, drawers, or tabs" — a permanently-visible What-if bar with an LLM-backed
free-text box competes with that on every single step, not just Step 4/5 where what-ifs are most
relevant. Consolidating it with the other already-drawer-based expert features (Bad-night test,
Build-your-own-plan) needed no new mechanism, just one more entry in an enum that already existed
for exactly this purpose.

**"All clear":** `opsStatus()` in `lib/console.ts` is untouched — it still returns `'calm'`
whenever nothing is due, whether or not a plan is approved (per its own doc comment, this is
deliberate: Live Ops's status word and the Decision Clock must never disagree). `StatusBand.tsx`
now displays "All clear" instead of "Calm" specifically when `status==='calm' && approved` — a
display-only branch over state that already exists, not a new status value, matching the brief's
explicit instruction not to invent a second status system.

**Also added:** a Light/Night toggle (`components/console/ThemeToggle.tsx`, `lib/theme.ts`) in the
top shell — Phase 1 built the tokens but nothing yet let a person switch them. Verified live: the
toggle flips every token instantly via the `[data-theme]` attribute, no reload, no flash.

---

## 2026-09-26 — Simple-UI migration, Phase 1: theme tokens as CSS variables + Night as a strict preservation of the old palette

**Decision:** every color in `app/globals.css`'s `@theme` block (background/panel/line/text/dim/brass/
danger/safe, plus new `--tone-*` washes) is now redefined under `:root[data-theme='dark']` using the
**exact original hex values** from before this migration. Light (the new default, from the approved
`reference/ui-mockup.html`) becomes the `:root` base. `--color-brass` keeps its name in both themes
even though it now means "interactive teal" in Light and "gold accent" in Night — same *role*
(primary interactive/selected-state color), different hue per theme, so no component className had
to change, only the 27 places across 13 files that hardcoded a literal tone-wash hex (e.g.
`bg-[#1d1c14]`) instead of a token — those became `bg-[var(--tone-brass)]` etc.

**Why:** old-dark-control-room → new-Light-default-plus-Night-mode is an explicit requirement. Doing
it as CSS custom properties (which Tailwind v4's `@theme` already compiles utilities like `bg-ink`
against) means Night mode is provably identical to the pre-migration app — verified with
Playwright screenshots of `/console` before and after, pixel-equivalent — while every future
component only needs writing once and gets both themes for free.

**Trade-off accepted:** the density ramp (`--color-d0..d5` in CSS, `RAMP` in `lib/colors.ts`) and
`denWords()`'s vocabulary are deliberately left theme-invariant — they're a data encoding read off
`engine/constants.ts`'s `CRUSH`/`JAM`, not chrome, matching how `reference/ui-mockup.html`'s own
`col()` function never changes with its Light/Night toggle either. `legendWord()` (new, in
`lib/colors.ts`) is a separate, additive vocabulary for the map's own legend/gate tags — it does not
touch or replace `denWords()`, which remains the console/Live-Ops narration language used
elsewhere and has existing call sites that were not part of this phase's scope.

**Also found:** `lib/createStore.ts` exists (the initial brief for this migration assumed it
didn't); it's the generic store factory `lib/console.ts` builds `ConsoleState` on top of. No change
needed there — noted here only because a stale assumption about the codebase was corrected.

---

## 2026-09-25 — Live Ops: "sent" state moved into the shared store, not left per-component

**Decision:** whether an order has been sent to Telegram, and when, now lives in
`ConsoleState.sentOrders` (a plain `Record<title, "HH:MM">`), written only by
`sendOrderToTelegram()` and read by both `TelegramButton` (Orders tab / Orders-sent panel) and
`ActionCard` (Actions Due). Neither component keeps its own local "sent" boolean any more.

**Why:** the first version had each surface tracking "sent" in its own `useState`. Since Live Ops
lets the same order be sent from either surface (Approve on an Actions Due card auto-sends; the
Orders tab has its own explicit Send button), that meant the two surfaces could disagree about
whether a send had already happened — a real path to double-sending the same message to the live
ops Telegram chat. Caught live: after auto-sending via Approve, the Orders-sent panel still showed
an unclicked "Send to Telegram" button for the identical order. The alternative (a single flag
threaded down as a prop) would have worked here but doesn't generalise — any future surface that
renders the same order (e.g. a notifications list) would reintroduce the same bug. Shared store
state is the one place that can't drift.

**Trade-off accepted:** `sentOrders` is keyed by order *title* (a human string), not a stable id —
`buildOrders()` has no id field. Good enough here because titles are deterministic given
(scenario, levers, result) and never duplicate within one approved plan; would need a real key if
orders ever became editable or re-orderable.

---

## 2026-09-25 — Phase 2: service-role writes + anon-SELECT RLS, not per-row ownership policies

**Decision:** every table has RLS enabled with no write policies at all for the anon/publishable
key — every write (`createRoom`, `join`, `vote`, `setBroadcast`, …) goes through
`supabaseAdmin()` (service-role key) from Next.js API routes only, never directly from the browser.
The anon key gets a single blanket `for select using (true)` on `rooms`/`participants`/`votes`
(needed for Realtime, which authorizes against the same RLS policies as REST), and no policy at
all on `ledger_entries` (nobody needs to read the Black Box directly from the browser; it's always
fetched through `/api/ledger`).

**Why:** this app has no auth (SOURCE_OF_TRUTH §5.3 — "Login/auth for organisers... The Room uses
anonymous session IDs"), so there is no `auth.uid()` to write a real per-row ownership policy
against. The alternatives were: (a) give the anon key write access gated by looser conditions
(e.g. "anyone can insert a vote for a participant that exists"), which is enforceable in RLS but
easy to get subtly wrong under a deadline and impossible to test as thoroughly as a single
TypeScript function; or (b) what was chosen — keep every write behind server code that already
has its own logic for "who can vote" (`lib/roomVotes.ts`, Phase 1) and "does this room exist," and
let Postgres block everything else outright. (b) also means the exact same authorization logic
(`vote()` checking the participant's cohort has a message) runs whether Supabase is configured or
we've fallen back to the in-memory backend — one code path, not RLS rules that would only exist
on one of the two backends.

**Trade-off accepted:** the anon key can read every room's participants and votes directly via
REST, not just the room a given phone is in (no `room_id` scoping on the SELECT policy). This is a
hackathon demo with anonymous ids and no personal data — a room's own participant counts and vote
tallies were already visible to any client polling the old in-memory `/api/room/[id]` endpoint, so
this doesn't newly expose anything; it just means the *mechanism* (direct Postgres read vs. an API
route) changed. If this app ever needed real privacy between concurrent rooms, the SELECT policy
would need to move to `using (room_id = current_setting('request.jwt.claims', true)::json->>'room_id')`
or similar, which requires actual auth — out of scope here by design (§5.3).

---

## 2026-09-25 — Phase 1: one shared function instead of two copy-fixes

**Decision:** when the Nerul-skywalk-throughput bug turned out to be two independent implementations
of the same calculation (`lib/facts.ts` and `engine/ablation.ts`) that had quietly drifted apart,
the fix was to extract one shared, exported, tested engine function (`peakPulseBurst()` in
`engine/arrivals.ts`) rather than just correcting the wrong hardcoded string in `engine/ablation.ts`.

**Why:** correcting the string alone would have fixed today's symptom but left the underlying
condition — two places computing the same real-world fact independently — in place, free to drift
again the next time either file is edited without the other. `SOURCE_OF_TRUTH.md` §3 exists
precisely to prevent this class of bug for LLM-produced numbers; the same principle applies to any
number that appears in more than one place in the app, LLM-produced or not. One function, one test
pinning its actual output against this scenario's real data, used everywhere the figure appears.

**Alternative considered:** leave `lib/facts.ts`'s version as the "real" one and have
`engine/ablation.ts` just read a passed-in value instead of computing its own. Rejected because
`engine/` must stay framework-free and self-contained (§14.3) — it shouldn't depend on `lib/`
computing something for it and handing it down; the computation itself belongs in `engine/`, and
`lib/facts.ts` (which is allowed to import from `@/engine`) should be the consumer, not the source.
This is also why the function lives in `engine/arrivals.ts` next to `arrivalCurve()`, which it's
built directly on top of, rather than in a new top-level file.

---
