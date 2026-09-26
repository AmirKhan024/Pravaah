# Progress log

Append a dated entry after every phase/task, per `SOURCE_OF_TRUTH.md` §14.11. Newest entry on top.

---

## 2026-09-27 — Data-driven: an event head's own data, from /setup to /live

Judges said `/live` looked hardcoded and dummy. Fixed the actual cause, not the appearance: the
whole app read one module-level `dyPatil` constant, and a dozen `scn.id === 'dyPatil'` branches
carried literal gate/cohort ids. Built the missing seam end to end instead — loader, entry point,
confidence, calibration, hardcode audit — in six commits, golden test green throughout.

**Changed**
- **`engine/csv.ts` + `engine/dataLoader.ts`** (new, pure TS, no fs/DOM): `parseCsv()` (RFC4180-ish)
  and `loadScenarioFromRows()` turn an event head's own `event/gates/tickets/arrivals/hotels/
  resources` rows into a `Scenario`, validating cross-references with plain-language errors
  ("Gate G7 in arrivals.csv is not in gates.csv"), building gate/plaza/origin geometry from `side`
  compass bearings and hotel `distance_km` (reusing `venueImport/buildGraph.ts`'s offset/bearing/
  `VENUE_DEFAULTS` rather than duplicating them), wiring `alt_gates` into `cohort.alt` for redirects,
  and rebuilding smaller cohorts from an earlier `tickets.csv` snapshot (`opts.snapshot`) — the seam
  a future timeline stepper (cut this pass, see below) would use. Every row is tagged
  real/estimated/invented and returned as `fields: DataField[]`, with `computeConfidence()` turning
  that into a low/medium/high level. `dyPatil` itself is untouched; this is a fully separate path.
  10 new tests (`engine/__tests__/dataLoader.test.ts`), including one asserting the sample actually
  breaks and a redirect helps (see Calibrate below).
- **`lib/console.ts`**: replaced the hardcoded `BASE_SCN = dyPatil` with `loadScenario()`/
  `resetToFlagship()` — the one seam that swaps the active `Scenario` for both `/console` and
  `/live` at once (they read the same store), persisted to `localStorage` only (never sent to a
  server). The "follow one person" trace (previously `RAVI.cohort`/`RAVI.release` unconditionally)
  now falls back to the loaded scenario's biggest cohort via `focusCohortId()`/`focusRelease()`.
  Added `dataSource`/`dataFields`/`dataConfidence`/`resources`/`raviRelease`/`raviLabel` to
  `ConsoleState` so the UI can show real per-scenario data without recomputing it.
- **`app/setup`** (new): the entry point. Quick Start (venue + capacity + date + gates-open +
  kickoff + turnout, an OpenStreetMap-backed cached-or-live venue graph — folds in "venue auto-fill"
  rather than building it twice), "Use the sample data" (via a new `/api/sample/dy-patil` route,
  since `data/` isn't public — the route just returns raw CSV text; all parsing/validation stays
  client-side), or upload 6 CSVs with downloadable blank templates. Linked from the landing page,
  header nav, and Live Ops's More menu; a "reset to the DY Patil demo" action appears once a
  custom/sample scenario is loaded.
- **Confidence meter**: a small "confidence: low/medium/high" badge in Live Ops's header (hidden for
  the flagship), and a full per-row Data drawer (file, row, tag, source note) added to the existing
  "How this works, what we guessed" drawer.
- **Calibrate the sample**: it loaded with `crushMin=0` everywhere — no gate came close to danger.
  Tuned `gates.csv` (Gate 3: 12→7 lanes, 1600→1000 m² forecourt) and `arrivals.csv` (Nerul rail
  spread 25→16 min), each tagged "tuned to demonstrate" in `source_note`, never touching engine
  defaults. Now runs 37 dangerous minutes at the West gate/forecourt; a data-derived redirect
  ("Tell nerul rail that Gate 2 is quieter", from `gates.csv`'s `alt_gates`) measurably reduces it.
- **No hardcoding**: grepped `app/`, `components/`, `lib/`, `engine/` for every flagship gate/
  station/figure. Fixed four real gaps — `Live.tsx`/`Console.tsx`'s map `fitKey` and `raviRelease`
  were pinned to `"dyPatil"`/`RAVI.release` regardless of the active scenario; `Console.tsx`'s
  story-mode caption script and `Drawers.tsx`'s after-action report both asserted "Ravi Sharma
  reaches Nerul" unconditionally; `ReportPanel`'s placeholder used a literal "Gate 3". Everything
  else checked out already generic with a safe fallback (`engine/interventions.ts`/`ablation.ts`'s
  `scn.id === 'dyPatil'` branches, `lib/room.ts`/`Phone.tsx`'s cohort-label fallback) or is a cached
  alternate venue's own real data (`engine/scenarios/venues/*`), not a flagship leak.

**Cut, per the brief's own "if time is short" order**: step 8 (live weather) and step 7 (a T-90→T-1
timeline *stepper UI*) — the loader's snapshot-rebuild already does the underlying work
(`opts.snapshot`), so this is now a UI-only remainder, not new engine work. Full per-section
Quick Start sub-forms (gates/tickets/hotels/resources editors) are also not built; CSV upload and
the sample cover that need for now. Step 9 (Telegram+Groq no-hardcoding) needed no new work —
`lib/messages.ts`/`whatifParse.ts` were already fully scenario-driven; wiring a real scenario
through `lib/console.ts` was the only thing missing for those templates to actually see custom data.

**Verified**
- `tsc --noEmit`: clean throughout. `npx vitest run`: 84/84 (one perf-timing test is flaky under
  load, confirmed unrelated — passes in isolation both before and after this work).
- Manually traced (not yet screenshotted live in a browser this session — see below): Quick Start's
  6 inputs build and load a scenario; the sample loads and its West gate shows 37 dangerous minutes,
  fixed/reduced by a data-derived redirect; a bad CSV (unknown gate id, mismatched ticket totals)
  returns the exact plain-language errors asserted in tests; the confidence badge and Data drawer
  render from real `dataConfidence`/`dataFields` state.

**Still open**: no live-browser screenshots were taken this pass (no browser-automation tool was
used) — the verification above is via the engine/loader test suite and manual code tracing, not a
running instance. Timeline stepper UI, weather, and per-section Quick Start forms remain as noted.

---

## 2026-09-26 — Live control room, slice (d): dynamic Telegram

The brief's six message types, each built from a structured payload — a lever, a `SimResult`, a
deadline, a fail rate — never free text, and reusing the existing number-safe wording endpoint
rather than inventing a second one.

**Changed**
- **`lib/telegramMessages.ts`** (new): six pure builders — `newActionAlert`, `actionExpiringAlert`,
  `statusChangedAlert`, `tripwireFiredAlert`, `actionStoppedWorkingAlert`, `decisionRecordedAlert`
  — each takes real arguments (a `Lever`, a deadline tick, a crush-minute count, a fail rate) and
  returns a fixed-template `{title, text}`; nothing here calls an LLM or invents a number. 7 tests
  in `lib/__tests__/telegramMessages.test.ts`.
- **`lib/console.ts`**: `sendTelegramAlert()` — the **one** place any message, order or monitor-loop
  alert, actually reaches Telegram (`/api/telegram/send`, the same route Phase 3's orders always
  used), de-duplicated in the same shared `sentOrders` record orders already use. `reword`, when
  passed, sends the fixed text through `/api/llm/polish` (the existing placeholder-mask-and-reject
  scheme — nothing new built for this) for tone only, silently keeping the fixed template on any
  failure/timeout/offline. `OrdersPanel.tsx`'s pre-existing `sendOrderToTelegram()` now delegates to
  it (unchanged behaviour: no reword, same log type) instead of having its own separate `fetch` —
  genuinely one send path, not two that happen to agree today. Wired at six trigger points, all of
  them state *transitions* already computed in slices (b)/(c), not new polling: a tripwire firing
  (§(c)), a re-rank's lead lever changing (`new_action`), a deadline ≤15 min out and not yet warned
  about (`action_expiring`, in `checkClock()`), the first time an evening reaches Act now
  (`status_changed`, deliberately *not* re-alerted on every calm/watch/act flap after that — see
  DECISIONS.md), `approvedStatus` flipping to stopped-working (§(b)), and every lever in an approved
  plan (`decision_recorded` — "approval is per ACTION, not per plan," so a multi-lever approval
  sends one message per lever, matching that same brief line). `LedgerType` gained
  `decision_recorded`, `action_expiring`, `status_changed` so the Black Box's own record of "what
  did we know, and when" distinguishes these from the underlying `plan_approved`/`clock_expired`
  entries that already existed.
- Crowd-facing messages: unchanged, still never touch this path — `buildOrders()`'s `crowd`-kind
  cards have no Telegram button, same as every phase since Phase 3. One-way: unchanged, no webhook
  exists to receive a reply (noted again in DECISIONS.md as the brief asks).

**A real duplicate-send bug, caught live — the second one in this project's history, same root
cause class as the one Phase-1's `roomVotes` fix and the Live-Ops `sentOrders`-in-shared-store
decision both already exist to prevent.** The first version of `sendTelegramAlert()` checked
`sentOrders[title]` before sending and only wrote to it *after* a successful send. `checkStatusAlert()`
runs on every simulated frame while the status is `act`; before the first call's `fetch` resolved,
every subsequent frame's call also saw an empty `sentOrders[title]` and also sent. **28 real
messages landed in the live ops Telegram chat in one short test run** before this was caught.
Fixed by reserving the title in `sentOrders` synchronously, before any `await` — releasing the
reservation again only if the send genuinely fails, so a real failure can still be retried.
Caught the same way as every bug this pass has found: driving the real thing (Playwright capturing
every `/api/telegram/send` request) and reading what actually happened, not the diff. Re-verified:
the same scenario that produced 28 sends now produces exactly one.

**Verified**
- `tsc --noEmit`: clean. `npx vitest run`: 76/76 (7 new).
- Live, via Playwright capturing every `/api/telegram/send` call against the real bot/chat: ran a
  full Red Team → rain report → tripwire fire → approve sequence and confirmed exactly one real
  send per distinct title (`Status: Act now`, `Tripwire: heavy rain`, the pre-existing staff order,
  and one `Decision recorded` send per lever in the approved plan — 7 calls, 7 distinct titles, all
  200s) instead of the 28 the bug produced. Opened the Black Box and read back a coherent, sealed
  timeline of the whole sequence — staff report → tripwire fired → re-ranked → approved "Plan B" →
  orders sent → four decisions recorded, each entry naming the real Telegram send it caused.

**Still open** — slice (e), missing scenarios (postponement, cab/rickshaw as their own mode, VIP as
a real cohort), opt-in only, if time remains.

---

## 2026-09-26 — Live control room, slices (b)+(c): the monitor loop, action lifecycle, tripwires

Watch → Detect → Re-plan → Ask, built as a thin layer on the engine's existing "full re-simulate,
future-only clamped" pattern (no engine rewrite — see the 2026-09-26 DECISIONS.md entry). Built
and verified together with (c) since a fired tripwire is just step 1 of the same monitor tick.

**Changed**
- **`lib/monitor.ts`** (new): pure logic only. `mergeObserved()` folds a new staff report into the
  running `WhatIfSpec`-shaped observed state, severity-preserving (a milder later report never
  un-reports an earlier, worse one). `buildObservedScenario()` factors out the exact `buildNight()`
  mapping `runWhatIfSpec()` already used, plus "lock the past": every capacity patch is clamped to
  start no earlier than the tick it's applied from — `retime()`/`fracRemaining()`'s own principle,
  now applied to an observed-conditions patch, not just a single lever. `firedTripwires()` matches
  real observed conditions against Red Team's own `breaksWhen` factors (engine/redTeam.ts gained
  `key`/`value` on each `breaksWhen` entry so this can compare programmatically, not by parsing
  English labels) — 10 tests in `lib/__tests__/monitor.test.ts`.
- **`lib/console.ts`**: `observed`, `lastMonitorTick`, `monitorBusy`, `approvedStatus`,
  `tripwiresFiredKeys`, `supersededLabels`, `expiredReason` — new state. `reportObserved()` /
  `clearObserved()` (a report merges into `observed`, logs it, runs one monitor pass immediately).
  `runMonitorTick()`: rebuilds the scenario from everything observed, re-runs whichever plan is
  currently shown (approved, else proposed) so the **map and all six buckets actually reflect what
  staff reported** (see the bug below — this wasn't true in the first version), checks tripwires,
  and — only if none fired — asks the worker to re-rank under the new conditions (`engine().replan`,
  same call the decision clock already uses). If a plan is in force, the same re-run also answers
  "does it still work": `approvedStatus` flips to `stopped-working` when it's ≥3 dangerous minutes
  worse than what was promised, logged as `action_stopped_working`. `maybeRunMonitor()` runs this
  automatically every 15 sim-minutes even with no new report, driven off the same `tickForward()`
  that already drives `checkClock()`. `opsLevers()`/`opsStatus()` extended (additively — existing
  `opsStatus.test.ts` cases all pass unchanged) so a stopped-working plan's fresh replan actually
  surfaces as the next thing to ask about, instead of the UI silently freezing on the old approval
  forever. `actionState()` reports proposed/accepted/skipped/expired/superseded from state that
  already existed (`expiredReason` is new — skip vs. a missed deadline used to be indistinguishable).
  `approveReplacement()` — deliberately **not** the same path as `approve()`: that one jumps into a
  canned replay (right for a first, pre-event approval); this one stays live, at the real clock,
  and swaps in the new plan at *now*.
- **`app/api/llm/report/route.ts`** (new): a typed staff report → the same clamped `WhatIfSpec`
  `whatifParse.ts` already produces for what-ifs (reused, not reimplemented — same `sanitizeSpec`/
  `localParse`), with its own system prompt ("describes something happening now," not a hypothetical
  to test) and its own offline fallback.
- **`components/live/ReportPanel.tsx`** (new): the brief's "chips + typed text" input — six instant
  chips (rain, rail delay, gates late, more/fewer people, slow lanes) plus a typed field through the
  endpoint above. **`Drawers.tsx`** gained the `observe` drawer wrapping it; **`Live.tsx`** gained a
  header "Report" button (one click, not buried in More — this is a first-class input, per the
  brief) alongside a More-menu entry. **`ActionsDue.tsx`**: the action card now reads `actionState()`
  instead of raw `!!s.approved`, shows a "stopped working — new move" badge, and routes its button
  to `approveReplacement()` instead of `approve()` in that case. **`StatusBand.tsx`**: the one
  sentence says "What you did stopped working — a new move is ready" instead of silently staying on
  "In force since HH:MM."

**A real bug found live, not before.** The first version of `runMonitorTick()` updated the
recommendation (`replan`) but never touched `cur` — so after reporting rain and watching a tripwire
fire correctly in the ticker, the Weather & delays dot still read "No rain… observed right now,"
because the six buckets (and the map) read `cur`/`base`, which hadn't moved. Fixed by having the
monitor tick re-simulate whichever plan is actually in force/proposed under the observed patch and
set `cur`/`ghost`/`raviCur` from that — the map and every dot now genuinely show the evening staff
just reported, not a stale one. Caught the same way as slice (a)'s bug: driving the real thing in a
headless browser (Red Team → report rain → watch the tripwire fire in the ticker → check the dot),
not by reading the diff.

**A second issue, caught in the same pass, fixed before it shipped:** the Weather bucket's first
draft compared `cur.crushMin` (which, once a plan is proposed, already includes that plan's fix)
against the plain do-nothing baseline — conflating "how bad is the weather" with "how good is the
plan," e.g. reading strongly *better* than baseline right after reporting heavy rain, because a
good plan was already selected. Changed to read the currently-shown evening's own dangerous minutes
directly, no baseline delta.

**Verified**
- `tsc --noEmit`: clean. `npx vitest run`: 69/69 (10 new in `monitor.test.ts`; `opsStatus.test.ts`'s
  existing cases untouched by the `opsStatus()`/`opsLevers()` extension).
- Live, via Playwright against `npm run dev` (`NEXT_PUBLIC_DEMO_OFFLINE=1`): ran the real Red Team
  search (192 nights) to get a real `backup`; reported "Rain has started" via the chip; the ticker
  read "Tripwire: heavy rain — Red Team already found this breaks the plan 78% of the time.
  Proposing the backup it found for the worst night," the status band flipped to Act now, and the
  Weather & delays dot correctly went to Watch with "Simulated" and the real crush-minute count —
  zero console errors throughout. Separately: approved a plan (a real Telegram send landed in the
  live ops chat, confirming this also works for a plan approved mid-loop, not just the first one),
  reported rain + a rail delay + a gate delay together, watched `approvedStatus` flip to
  `stopped-working` with the "stopped working — new move" badge and Act now, clicked "Do it" on the
  replacement, and confirmed it went back to Calm ("In force since 18:36") with the new lever
  showing "Done · sent to ops" — the loop closes correctly, decision after decision, for the rest of
  the evening.

**Still open** — slice (d) dynamic Telegram message types (new action / expiring / status changed /
tripwire fired / stopped working / decision recorded, with Groq wording reusing the placeholder
scheme) and (e) missing scenarios. Continuing now.

---

## 2026-09-26 — Live control room, slice (a): the calm `/live` screen + More menu

Starting the "static plan → calm live control room" brief. Full audit and chosen approach are in
this session's transcript, not repeated here; the short version: the engine has no true mid-run
resume (every "replan" is a full 0..H re-simulate with future-only clamping via `retime()`/
`fracRemaining()`), which is fine and reused as-is — no engine change in this slice. This slice is
UI/store only: the existing `/live` (already ~70% of the target per its own Phase log) is
recomposed into the brief's exact five zones, nothing deleted.

**Changed**
- **`lib/buckets.ts`** (new): the six status dots' logic. `bucketStatuses()` reads `SimResult`/
  `Scenario` only — worst gate/plaza/venue density and gate wait (Crowd & gates), worst road/
  shuttle/walk link density (Getting there), `unhoused`/`lateBookings`/free-far-rooms (Hotels), the
  active what-if's crush-minute delta (Weather & delays), a plain staff-report flag with no number
  (VIP — genuinely unmodelled, see below), and `rupees`/`missed` (Money & refunds). Every bucket
  carries an honest `coverage: 'simulated' | 'playbook'` tag, tested in
  `lib/__tests__/buckets.test.ts` (7 tests) — crowd/transport/hotels/weather are simulated, vip/
  money are playbook, pinned so the tag can't silently drift as the UI evolves.
- **`lib/console.ts`**: `liveBuckets()` (memoised wrapper over `bucketStatuses()` — see the bug
  below), `openBucket()`/`drawerBucket`, `setVipNote()`/`vipNote` (a plain flag, never a number),
  two new `Drawer` ids (`bucket`, `whatif`, `liveOrders`). `LedgerType` gained `staff_report`,
  `tripwire_fired`, `action_stopped_working` — added now since slice (b)/(c) need them and the
  ledger type is a single shared union; unused until then.
- **`components/live/StatusDots.tsx`** (new): the six dots. **`Ticker.tsx`** (new): "what changed"
  — not a new log, just the Black Box's own last entry re-read as one line, so it can never
  disagree with the ledger. **`MoreMenu.tsx`** (new): one dropdown gathering Ravi/ghost (Report
  drawer), what-if (WhatIfBar, now also reachable in a drawer), Red Team, decision windows,
  build-your-own, Orders sent (moved out of Live Ops's old always-on right rail), the Black Box,
  About, plus links to `/venues`, `/replay`, `/console` — every existing feature, none deleted,
  all one level deep instead of scattered.
- **`components/console/Drawers.tsx`**: added `BucketDrawer` (a bucket's headline + risks + the
  Simulated/Playbook tag), `WhatIfDrawer` (wraps the existing `WhatIfBar` unchanged), and
  `LiveOrdersDrawer` (the order cards Live Ops used to show permanently, now behind More).
- **`components/live/ActionsDue.tsx`**: collapsed to **one** action card at a time (brief: "Right:
  ONE action card"), with "‹ prev / N of M due / next ›" paging when more than one lever is due —
  never more than one card visible. "Approve" → "Do it", "Skip" → "Not now" (brief: remove
  "Plan"/"Approve" from the main path; approval is per-action).
- **`components/live/StatusBand.tsx`**: trimmed to one status word + one sentence, max 12 words
  (was two lines, the second repeating the deadline the action card's own countdown already
  shows).
- **`components/live/Live.tsx`**: map-centred two-column layout (map + the one action card), footer
  = dots + ticker, header gained the More button. The old fixed left "Actions due" / right "Orders
  sent" three-column layout is gone; `OrdersSent` moved into `LiveOrdersDrawer`.

**A real bug found live, not before — same class as the one Phase-1's `roomVotes` fix targeted.**
`useSlice()` (`lib/createStore.ts`) memoises by shallow-comparing the selector's return value
against a cached one, so a selector that returns a brand-new array of brand-new objects every call
— which `bucketStatuses()` does, deliberately, by design — never compares equal, so
`useSyncExternalStore` re-renders every time it's asked to confirm nothing changed, without end.
First screenshot showed Next's own overlay: "The result of getSnapshot should be cached to avoid
an infinite loop." Fixed by memoising `liveBuckets()` itself (same pattern as `lib/planCache.ts`)
against reference identity of `cur`/`base`/`whatIf`/`vipNote`/tick — same inputs now hand back the
literal same array, so `Object.is` short-circuits before any per-element comparison. Caught by
actually opening the page in a headless browser and reading Next's dev overlay, not by reasoning
about the code — the golden lesson from the Live Ops Phase-1 bug repeats: verify live.

**Verified**
- `tsc --noEmit`: clean. `npx vitest run`: 58/59 (the one failure, `venues.test.ts`'s `<30ms` perf
  assertion, is the same pre-existing flaky-under-load test noted in the 2026-09-25 Phase-1 entry —
  reran it alone, passed clean).
- Live, via a Playwright script driving the real `npm run dev` (headless Chromium, `NEXT_PUBLIC_
  DEMO_OFFLINE=1`): `/live` renders with zero console errors; the More button, all six dot labels,
  the ticker, "Do it"/"Not now"/"Why?" (and the absence of "Approve"/"Skip" as button text) are all
  present; clicking a dot opens its drawer showing a Safe/Watch/Act pill and a "Simulated — from
  the engine" tag; the More menu lists all 8 drawer items and all 3 route links. Screenshots taken
  at each step. Confirmed the bucket drawer's numbers (density, gate wait, dangerous minutes) match
  what the map/readouts already show for the same run.

**Overruled, logged to `docs/DECISIONS.md`:** VIP stays untagged as a real cohort (coverage:
"playbook", status only ever `watch`/`safe` off a manual flag) rather than inventing a VIP gate to
make the dot look simulated — SOURCE_OF_TRUTH §3's "no LLM/UI number without a `simulate()` behind
it" extends to not faking simulation coverage either.

**Still open** — slices (b) monitor loop + action lifecycle, (c) tripwires from Red Team, (d)
dynamic Telegram + Groq report parsing, (e) missing scenarios. Continuing now.

---

## 2026-09-25 — Live Ops: a new default landing view, recomposed from existing pieces

**Changed.** New route `/live`, reusing the same global store, `approve()`, the engine worker, and
the map — nothing here recomputes a simulation or a lever; every number and every lever comes from
exactly the same place the five-step console already gets them from.

- **`lib/console.ts`**: `opsStatus()` (Calm/Watch/Act now, derived from `decisionDeadline()` and
  the same ≤15min "urgent" threshold `DecisionClock.tsx` already used — pinned with a new unit
  test, 7 cases); `opsLevers()` (what's in force, else Plan B, else the recommendation — a thin
  wrapper over the existing `selectedPlan()`); `skipLever()` and the `expireLevers()` it shares
  with the automatic tick-driven `checkClock()` (a skip and a missed window now produce the *same*
  re-plan, because they're the same code path); `openLeverWhy()`; a new shared `sentOrders` record
  (see the bug below) with `markOrderSent()`/`orderSentAt()`.
- **`lib/useSimTicker.ts`**: the bare tick-loop, extracted out of the five-step console's `useLoop`
  so Live Ops can drive the same simulated clock without the console's story-caption narration
  (which stays in `Console.tsx`, now `useStoryCaptions()`, layered on top of the same shared hook).
- **`components/console/DecisionClock.tsx`**: exported its `Band` shell so Live Ops's status word
  reuses the actual hero-band component, not a second copy of its tone/layout classes.
- **`components/console/Drawers.tsx`**: extracted `BoardOptionCard` (one lever's deadline pill +
  curve chart) out of `BoardDrawer` so both the full multi-lever drawer and the new, focused
  `LeverWhyDrawer` (Live Ops's "Why?") render it identically. `LeverWhyDrawer` combines that with
  `leverWorth()` — the same plain-language payoff line the Plan tab already shows — so "Why?"
  really is "that lever's existing Prove-tab content," composed from two already-existing pieces.
- **`components/console/OrdersPanel.tsx`** (new): the order cards (crowd message + staff/
  transport/accommodation/food, with Copy/SMS/PA/Telegram) extracted out of the Guide step. Used
  by Guide's new **Orders** tab and by Live Ops's "Orders sent" panel — one implementation, two
  call sites, not a duplicate. This also required splitting Guide into two tabs ("What changed" /
  "Orders"), which is the exact restructure Phase 4's report recommended and left for a decision —
  building it was a direct prerequisite for zone 4 to be a genuine reuse rather than a copy.
- **`components/live/`**: `StatusBand.tsx` (zone 1), `ActionsDue.tsx` (zone 3 — one card per lever,
  capped at 4 both because the "Zero rupees" plan's own optimiser depth already bounds it there
  and defensively via `.slice(0,4)` in case a different, longer plan was approved from the full
  console first), `Live.tsx` (wires all four zones + the map, centered, using the exact same
  `FlowMap`/`getState()` call as `Console.tsx`). The map, the "at most 4 numbers" constraint, and
  the persistent "Full console" link are all satisfied as specified.
- Cover page: primary/closing CTA now points at `/live` ("Open Live Ops →"); the nav gained a
  "Full console" link alongside it. The hero CTA ("Rehearse tonight at DY Patil →") was left
  pointing at `/console`, since its wording is specifically about the guided rehearsal narrative,
  not live monitoring — changing its destination without changing its label would have been
  misleading.

**A real bug found and fixed during this build, not before.** The first version had the Actions
Due card's one-click Approve auto-send its own local "sent" state, while the Orders Sent panel's
`TelegramButton` tracked "sent" in *its own separate* local state — so after auto-sending via
Approve, the exact same order still showed an un-clicked "Send to Telegram" button in the other
panel, which would have sent a duplicate message to the real ops chat if clicked. Fixed by moving
"has this order been sent, and when" into the shared store (`sentOrders`) that both surfaces read
and write through — `sendOrderToTelegram()` now marks it in one place, and nothing else keeps its
own copy. Caught by watching the actual screenshots after a live end-to-end run, not by reasoning
about the code — worth noting as a case for always verifying live rather than trusting the diff.

**Verified**
- `tsc --noEmit`: clean. `npx vitest run`: 52/52 (7 new for `opsStatus()`, unchanged elsewhere).
- Live, end-to-end against `npm run dev`, `/live`: status word correctly reads Watch pre-approval
  and Calm post-approval; exactly 4 numbers visible outside any drawer (three "67 min" countdown
  pills + one "19:00" in the status band — confirmed by a DOM query scoped to exclude the map
  canvas and any open drawer); Escape now closes a drawer in Live Ops (it didn't in the first
  version — no keyboard handling existed there at all; added `useEscToClose()`); Skip on a lever
  correctly triggers the same re-plan path a missed window would, and the Actions Due list updates
  to the new plan's levers; Approve on a staff-order lever calls `approve()` and auto-sends to the
  real Telegram chat, confirmed by the inline "Sent to ops · HH:MM" badge and, after the fix above,
  confirmed identical in the Orders Sent panel with the same timestamp; "Full console" navigates to
  `/console` and the five-step flow is untouched (also re-verified end-to-end: rehearse → predict →
  explain → prove → the new Guide tabs → a real Telegram send from there too, unaffected by the
  `sentOrders` refactor).

---

## 2026-09-25 — Phase 6: mobile console notice — replace the dead end

**Changed**
- New `components/console/MobileNotice.tsx`, replacing the bare "built for a big screen" text
  block. The console still never attempts to render at phone width (unchanged, correct — it's a
  control room, not a responsive-design gap) — the notice now gives a phone-holding visitor
  something to do: a QR code for the console's own URL (`qrcode`, same library and pattern as
  `RoomPanel.tsx`'s room-join QR) so they can scan it open on a laptop or forward the link, the
  URL itself in text, a one-line preview of what's on the other end, "Back to the start", and — if
  a room is currently open (`roomStore`) — a "Join The Room instead →" button linking straight to
  `/join/[roomId]`.

**Verified**
- `tsc --noEmit`: clean. `npx vitest run`: 45/45 (unchanged — no engine/store logic touched).
- Live-verified both states: with no room open, the Join button is absent (checked count === 0);
  with a room open (opened from a desktop-width view of the same page, then resized to phone
  width), the button appears with the exact correct `href` (`/join/<the real room code>`).

**All six phases of this pass are now committed.** Summary of what's genuinely verified vs. not:
everything is `tsc`-clean and passes `npx vitest run` (45 tests) after every phase; Phases 1, 4, 5,
6 are additionally verified live end-to-end in the browser; Phase 2 is verified live against the
real Supabase project including direct database queries proving persistence, with the sole
exception of an actual Vercel deployment + two-phones-on-mobile-data test (no access to run from
here); Phase 3's one-way Telegram send is verified live against the real bot and chat, with the
Acknowledge/webhook stretch goal deliberately not built (can't be tested without a public HTTPS
deployment, and the brief explicitly permits stopping there).

---

## 2026-09-25 — Phase 5: Decision Clock as the actual hero

**Changed**
- `components/console/Console.tsx`: split the old single 64px header row
  (`grid-rows-[64px_minmax(0,1fr)]`) into a slim 52px top nav (logo, scenario name, Room/Black
  Box/How-this-works links only) plus a new full-width row directly beneath it
  (`grid-rows-[52px_auto_minmax(0,1fr)]`) dedicated entirely to the Decision Clock. It was
  previously an absolutely-positioned pill squeezed into the same 64px bar as the logo and nav —
  it could never have been much bigger than ~56px tall there without overlapping something.
- `components/console/DecisionClock.tsx`: every state (loading, counting down, approved, window
  closed) now renders as a full-width band with a consistent shell, not a small centered pill.
  The countdown numerals are `text-[56px]` (`sm:text-[64px]`) — measured live against the largest
  number anywhere else on the page (the readouts panel's "still outside" figure, 44px): the clock
  is unambiguously the single largest element now. Replaced a DOM-ref/CSS-class trick for the
  "urgent" (≤15 min) pulsing state with plain React state, since it's a rarely-changing boolean —
  simpler and more obviously correct than the compound Tailwind selector it replaced.
- Logic is untouched: same `decisionDeadline()`/`recommended()`/`crushIfStartedAt()` calls, same
  arithmetic countdown (no re-simulation per frame), same zero-state re-plan behavior.

**Verified**
- `tsc --noEmit`: clean. `npx vitest run`: 45/45 (unchanged — visual-only phase).
- Live-measured the rendered digit height in every state (loading, counting down at 66:27,
  approved) via Playwright: the counting-down digits render at exactly 64px, vs. 44px for the
  largest number anywhere else on the same screen. Screenshots confirm the band reads as the
  dominant element in all four states, not just the "counting down" one.

---

## 2026-09-25 — Phase 4: de-verbose the Prove step into tabs

**Changed**
- `components/console/steps/Prove.tsx` restructured into four tabs — **Plan** (default; the three
  plan cards, Plan B banner when the clock has expired), **Why it works** (the rejected "fixes
  that look right, but fail" list), **Timing** (decision window board + the cost-of-waiting
  chart), **Stress test** (the Red Team summary card, drawer unchanged). The "Approve … and send
  the orders" button is sticky at the bottom of the panel regardless of which tab is active, as
  required.
- **"Build your own plan" moved out of the main flow entirely**, into a new drawer
  (`DeckDrawer` in `components/console/Drawers.tsx`, `drawer: 'deck'`), reachable only via a small
  "Advanced: build your own plan →" link at the bottom of the Plan tab. It no longer appears in
  the default demo path at all — confirmed live (a fresh run through steps 1→4 never shows it
  unless that link is clicked).
- No data/logic changes: `PlanCard`, `Board`, the Red Team summary, and `CostOfWaiting` are the
  same components/hooks as before, just relocated into tab bodies. The deck's live projection
  logic (`planResult`, `feasible`, lever toggling) is verbatim, moved into `DeckDrawer`.

**Verified**
- `tsc --noEmit`: clean. `npx vitest run`: 45/45 (unchanged — this phase touches no engine or
  store logic, only component layout).
- Live-verified all four tabs render their expected content, the Approve button stays visible on
  every tab (checked specifically on the Timing tab, the one most likely to push it off-screen),
  the Advanced link opens the deck drawer with working checkboxes and a live projection, and the
  main Plan/Why/Timing/Stress views are dramatically shorter — every tab now fits without
  scrolling on a 900px-tall viewport, versus the old single-scroll layout which ran to roughly
  2.5–3 screens.

**Flagged, not fixed (brief step 5 — audit only, no unilateral redesign)**
Counted numbers visible at once, without scrolling, on a fresh Guide-step screenshot (approved
plan, no drawer open): the "What changes" box alone shows **13 numbers** (4 before→after metric
pairs = 8, a cost figure, and a 4-number Ravi sentence); the always-present right-rail readout
panel adds **8 more** (4 stat tiles × current-value + "if you did nothing"); the first crowd
message card's subtitle adds **3 more** before any scrolling. That's **~24 numbers on screen
simultaneously** on the single most number-dense screen in the app, before even reaching the
staff/transport/accommodation cards further down. The Explain step is comparatively fine: 4
ablation-row numbers plus the same 8-number right rail ≈ 12 at once, and the causal-chain
section's extra ~8–10 numbers only appear after scrolling, not all at once.
**Recommendation, for you to decide, not decided here:** the Guide step is the stronger candidate
for a tabbed or drawer-based split — for example "What changes" (the delta box) as its own
default view, with the crowd-message and staff/transport/accommodation cards moved into an
"Orders" tab, similar to what this phase just did for Prove. Explain is lower priority; if
anything, only the causal-chain section (currently below the ablation list, adding the extra ~10
numbers) is worth moving behind a "show how it builds" toggle. Not implemented — awaiting your
call.

---

## 2026-09-25 — Phase 3: Telegram ops channel (one-way send)

**Changed**
- `lib/telegram.ts`: server-only helper (`sendTelegramMessage`, plus `editTelegramReplyMarkup` and
  `answerCallbackQuery` for the stretch goal, unused for now — see below) using the Bot API
  directly (`fetch` to `api.telegram.org`, no SDK needed for this). The token never reaches the
  client; every call runs from `app/api/telegram/send/route.ts`.
- `components/console/steps/Guide.tsx`: added a `TelegramButton`, wired onto every **staff /
  transport / accommodation / food** order card (kept "food" in scope alongside the three the
  brief named — same "ops order, not a crowd message" category). It shows "Sending…", then either
  a persistent green "✓ Sent to ops · HH:MM" (24h, matching the clock everywhere else in the app —
  the first version used `toLocaleTimeString`'s default 12h format, fixed after noticing it in a
  screenshot) or a red inline error with Telegram's own reason text — never silent.
- The crowd-message card is untouched: no Telegram button was added there, verified by a live
  check that counted zero "Send to Telegram" elements inside it.
- `.env.local`: `TELEGRAM_OPS_CHAT_ID` is now set. It was blank at the start of this phase (nobody
  had messaged @pravaah_ops_bot yet); `getUpdates` on the bot showed you'd sent `/start` at some
  point, which gave a real chat id (a private chat) to use and test against for real.

**Verified — for real, against the live Telegram bot**
- `tsc --noEmit`: clean. `npx vitest run`: 45/45 (added `lib/__tests__/telegram.test.ts`:
  `sendTelegramMessage()` returns a clear `{ok:false, reason:"...not configured..."}` rather than
  throwing or silently no-op'ing when the token/chat id are missing — direct test of the "never
  fail silently" requirement).
- `curl -X POST /api/telegram/send` with a real order body → Telegram's own API returned
  `{"ok":true,"result":{"message_id":2,...}}` — genuine delivery confirmation from Telegram itself,
  not just "the app said 200."
- Drove the real Guide step in the browser, clicked the real "Send to Telegram" button on a real
  order card, and confirmed the UI showed "Sent to ops · 16:21" (after the 24h-format fix).

**Stopped here — did not build the Acknowledge/webhook stretch goal**
The brief explicitly says to stop after the one-way send if the webhook "proves fiddly or eats too
much time... the one-way send alone is still a real, demoable feature." It isn't fiddly to *write*
— but a Telegram webhook categorically cannot be registered or tested against `localhost`; it
needs a real public HTTPS URL (a Vercel deployment), which I don't have access to run from here.
Building it now would mean shipping ~150 more lines (a `telegram_orders` Supabase table + a
webhook route + editing message keyboards + a console-side "acknowledged" indicator) with **zero**
of it actually verified, on top of an already-large pass with three more phases of UI work still
ahead that I *can* fully verify from here. I judged that a worse trade than stopping, exactly as
the brief anticipated. If you want it built anyway — ready-to-verify, not ready-to-guess — say so
and give me the Vercel URL once deployed; `editTelegramReplyMarkup`/`answerCallbackQuery` already
exist in `lib/telegram.ts` for it to build on.

---

## 2026-09-25 — Phase 2: Supabase — The Room and the Black Box off the laptop

**Changed**
- `supabase/schema.sql`: `rooms`, `participants`, `votes`, `ledger_entries`, adapted to the shapes
  already in `lib/roomTypes.ts`/`lib/ledger.ts` rather than inventing a new one — `rooms.id` IS the
  human room code (no separate `code` column, nothing in the app ever had a room id that wasn't
  also its code); `rooms.broadcast`/`rooms.outcome` are jsonb columns holding the current
  `RoomBroadcast`/`RoomOutcome` directly (there's only ever one "current" one, exactly like the old
  in-memory `Room.broadcast`) rather than a separate history table. RLS is on for every table;
  anon gets SELECT only (needed for Realtime, and everything in these rows was already visible to
  any client polling the old API anyway); every write goes through the service-role key from
  server code only. Applied for real against the live project (`scripts/apply-schema.mjs`) —
  verified via `scripts/inspect-room.mjs` that a full session's rooms/participants/votes genuinely
  land in Postgres, not just behave correctly in the app.
- `lib/roomServer.ts` split into a facade (`lib/roomServer.ts`) over two backends —
  `lib/roomServer.memory.ts` (the original in-memory Map, ported to the same async signature) and
  `lib/roomServer.supabase.ts` (new). The facade picks one via `supabaseConfigured()`
  (`lib/supabase.ts`) per request, so Supabase being unreachable or unconfigured falls back to the
  in-memory backend automatically, same as before this phase existed. Every function is now async
  and takes a room id string rather than a long-lived `Room` handle, since Supabase calls are I/O
  and nothing should go stale across an await or a different serverless instance.
- `app/api/room/route.ts` and `app/api/room/[id]/route.ts` updated for the new async, id-based API
  (and now return a real error body instead of silently doing nothing on failure).
- Realtime wired for real, not just persistence: `lib/room.ts` (console) and
  `app/join/[roomId]/Phone.tsx` (phone) both open a genuine Supabase Realtime channel
  (`postgres_changes` on `rooms`/`participants`/`votes`, filtered by room id) and refetch on any
  change. A slow poll (4–5s) stays on underneath as a safety net in case the socket drops; it runs
  at the old 1–1.2s cadence automatically whenever Realtime isn't connected (not configured, or
  `CHANNEL_ERROR`/`TIMED_OUT`).
- `lib/ledger.ts`: the hash-chain math (`canonicalJSON`, `sha256`, `entryBody`, `appendLedger`,
  `verifyLedger`) is byte-for-byte unchanged. Persistence moved to `app/api/ledger/route.ts` →
  Supabase's `ledger_entries`, keyed by a per-browser `sessionId()` (localStorage) so a refresh
  keeps the same ledger but different laptops/sessions never collide. `loadLedger()` is now async
  (one call site changed, `boot()` in `lib/console.ts`); `appendLedger`/`clearLedger` write to
  Supabase and localStorage together, and fall back to localStorage alone on any Supabase failure.
- `.env.local`/`.env.example`: added `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (browser, Realtime-only) alongside the existing server-only `SUPABASE_URL`/`SUPABASE_SECRET_KEY`.

**Verified — live, against the real Supabase project**
- `tsc --noEmit`: clean. `npx vitest run`: 43/43 (added `lib/__tests__/roomServer.fallback.test.ts`,
  a full room lifecycle — create, join, broadcast, vote, snapshot, phoneView — run with
  `NEXT_PUBLIC_DEMO_OFFLINE=1` to prove the in-memory fallback still works end-to-end on its own).
  Needed a `server-only` stub alias in `vitest.config.mts` (that package throws outside Next's own
  runtime; the real Next.js build still enforces it — the alias never ships).
- Ran the full console → approve a plan → open the Room → real phone joins → broadcast → vote →
  "run with the room" → personal outcome flow against `npm run dev` with the real credentials.
  Confirmed via Playwright's WebSocket events (not just app behavior) that both the console and the
  phone open a genuine `wss://…supabase.co/realtime/v1/websocket` connection and receive a
  `"Subscribed to PostgreSQL"` ack for their room's `postgres_changes` filter. Message delivery to
  the phone measured ~2.2s end-to-end in this environment (this dev machine ↔ the Supabase project,
  which is in `ap-northeast-1`/Tokyo — cross-region latency, not a defect; on the same Wi-Fi at the
  actual venue this should be much faster). Then queried Supabase directly
  (`node scripts/inspect-room.mjs <code>`) and confirmed the room row, both participants (one real
  headless-browser phone, one simulated), the cast vote, the broadcast's per-cohort messages, and
  the computed outcome headline all genuinely persisted in Postgres — this is not just "the app
  behaved correctly," the data is independently queryable outside the app.

**Explicitly NOT verified — I could not do these from here**
- **`vercel deploy` and two-phone-on-mobile-data testing**, as the brief's step 4 asks for. I have
  no Vercel account/deploy access in this environment, and physical phones on mobile data aren't
  something I can drive. Everything Supabase-related is now genuinely code-complete and verified
  against the real project from a local dev server, including the parts (Realtime, cross-request
  persistence) that a single-process in-memory version could never have passed — but the specific
  "does this survive Vercel's multiple serverless instances, over a real mobile network" claim is
  unverified by me. **Please run `vercel deploy` (env vars are already the same ones in
  `.env.local`) and test The Room with two phones on mobile data, and let me know what happens.**
  If it fails, the most likely culprits are: (a) `NEXT_PUBLIC_*` vars not set in the Vercel project
  settings (they must be — server-only `SUPABASE_URL`/`SUPABASE_SECRET_KEY` being set is not
  enough for the browser Realtime client), or (b) the anon/publishable key's RLS SELECT policies
  needing a broader `for all` grant if some read path I didn't anticipate needs it.

---

## 2026-09-25 — Phase 1: fix known-wrong numbers and copy

**Changed**
- **"40 minutes early" claim removed.** It was flatly wrong — the Decision Clock's real lead time on DY Patil is closer to 65 minutes and varies by run. Replaced in `README.md`, `SOURCE_OF_TRUTH.md` (§1 positioning line, with a note explaining why the number was dropped), and `app/page.tsx` (cover page pull-quote) with "Pravaah tells you before it happens, proves why, and tells you how long you have left to stop it." No specific minute count is hardcoded anywhere in copy again; the Decision Clock on screen is the only place a number like that should ever appear.
- **The Room's vote-count bug, fixed at the root.** `simulateRoom()` was casting votes for simulated phones in cohorts that never received a broadcast message (falling back to a default 30% probability), while the live tally bar (`RoomPanel.tsx`) counted *every* vote in the room but the result footnote (`runWithRoom()`) counted only nudged-cohort votes — two different filters over the same data, so they could disagree by however many phantom votes landed in an off-plan cohort (observed: 26 shown in the bar, 25 in the footnote). Fix: added `lib/roomVotes.ts` — one pure, tested module (`votableParticipantIds`, `tallyVotes`, `tallyByCohort`) that is now the *only* place "who could vote" and "how many did" are computed. Wired into `simulateRoom()` (both online and offline branches — a simulated phone can now only vote where a real phone could), `runWithRoom()`, `RoomPanel.tsx`'s live bar, and hardened `roomServer.ts`'s `vote()` to reject a vote server-side for a cohort with no current broadcast message (defense in depth against a stray or direct API call). Verified live: ran the console → approved a plan → opened the Room → sent 96 simulated phones across 4 batches → live tally bar and result footnote both read 11/11, matching exactly.
- **Kharghar + Panvel empty rooms: 1,880, not 2,050.** The live app already computed this correctly from `Zone.rooms`/`Zone.occupied` (`lib/facts.ts`); the only place the stale "2,050" figure survived was the scenario summary table in `SOURCE_OF_TRUTH.md` §7, now corrected with the arithmetic shown (920 + 960 = 1,880) and a note that the 2,050 figure was wrong even against the *prototype's own* data, not just the rebuild's.
- **Nerul skywalk pulse throughput: ~2,000 people every 6 minutes, not ~900.** This was a real, live, on-screen inconsistency: the Rehearse step (`lib/facts.ts`, computed) said "~2,000 people," the Explain step's ablation test description (`engine/ablation.ts`, hardcoded string "about 900 people at a time") said something else, for the same scenario, same phenomenon, one screen apart. Root cause: two independent implementations of the same "biggest pulse-window burst" calculation had drifted — `lib/facts.ts` had the real (correct) one, `engine/ablation.ts` had a remembered narrative number from the original prototype's copy. Fixed by extracting one shared, exported engine function, `peakPulseBurst()` (`engine/arrivals.ts`), used by both `engine/ablation.ts` and `lib/facts.ts` now. Confirmed the true value directly against the engine: nerul_rail's real peak burst is 1,977 → rounds to 2,000; seawoods_rail's is 1,168 → rounds to 1,200. Pinned with a regression test (`engine/__tests__/arrivals.test.ts`) so a future scenario-data edit that changes this is caught by the test suite, not discovered in a screenshot.

**Verified**
- `tsc --noEmit`: clean.
- `npx vitest run`: 42/42 passing (36 pre-existing + 4 new in `lib/__tests__/roomVotes.test.ts` + 2 new in `engine/__tests__/arrivals.test.ts`). One test in `engine/__tests__/venues.test.ts` (a `<30ms` perf timing assertion, pre-existing, unrelated to this phase's files) was flaky under load once, passed clean on every other run — not a regression, not touched.
- Live-verified in the browser (Playwright against `npm run dev`): the Explain step now reads "about 2,000 people every 6 minutes" (previously "about 900 people at a time"); the Decision Clock read 66:35 on this run, confirming the old "40 minutes" claim really was wrong, not just imprecise; the Room's live tally bar and result footnote agreed exactly (11/11) after a stress run with 96 simulated phones across multiple batches, specifically chosen to include phones in the un-nudged `late_book` cohort that used to produce the mismatch.

**Still open / deferred**
- Did not audit every number in the app beyond the four the prompt named — scope was "the two other known-inconsistent figures," not a full numeric audit. If more are found, they should get the same treatment (one computed source, a regression test, not just a copy edit).

---
