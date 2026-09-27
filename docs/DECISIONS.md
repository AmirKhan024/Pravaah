# Decisions log

Trade-offs and alternatives considered, appended per `SOURCE_OF_TRUTH.md` §14.11. Newest entry on top.
This is not a changelog (see `docs/PROGRESS.md` for that) — only entries where a real choice was made.

---

## 2026-09-27 — /visit: why it rides the Room instead of a new channel, and what that costs

**`/visit` requires an open Room; there is no visitor flow with no Room at all.** The brief said
"reuse the Room's realtime path and its offline fallback," and the Room's realtime path is
*specifically* a Supabase `rooms` row plus a shareable code/link — there is no lighter-weight
"any device can read the console's live state" channel in this app, and building one (a second
cross-device sync system, keyed some other way) would be new backend surface, which the ground
rules explicitly forbid. So `/visit/<roomId>` reuses the exact row "Open the Room" already creates,
with three additive columns (`origins`, `t0_min`, `base_gate_wait_peak`) and one additive field
(`plan`) alongside the ones the Room already had. **Cost accepted:** a presenter must click "Open
the Room" before handing out the visitor link, same as they already do for judges' phones — one
extra click, not a new step in the demo.

**Party size and travel mode are shown back to the visitor, never fed into the simulation as a new
person.** A truly live per-visitor re-simulate (adding one more person to the loaded `Scenario` and
re-running) is real engine work — a new cohort, a new arrival curve, a fresh `simulate()` call per
visitor — for a number that would never be large enough to move a crowd of tens of thousands
either way. **Why this is the right cut, not a shortcut:** SOURCE_OF_TRUTH §3.2's rule is that no
UI number can be *invented*; showing the visitor's own stated party size back to them is not
inventing anything, it's literally what they typed. What would violate it is quietly using their
party size to nudge a gate/crush number nobody actually simulated — which this build never does.

**The visitor's "coming from" list is the scenario's own cohorts (`VisitOrigin`), not a free-text
autocomplete of every zone.** The brief said "stations, areas or hotels from the loaded scenario" —
a scenario's cohorts already *are* those stations/areas/hotels (Nerul station, Seawoods, Palm Beach
cabs, the four hotel clusters, self-drive, late bookings, for DY Patil). **Why not walk the zone
graph directly instead:** a cohort is the thing that actually has a path/alt-gate/arrival-time
attached to it; a bare zone does not. Picking a cohort-derived origin means the gate/leave-by/route
the visitor sees is always a real, already-computed thing, not something built fresh per visitor.

**The food/stay tip is computed once, when the room opens — not re-computed on every plan update
the way gate/leave-by are.** The brief's own emphasis ("When the head taps 'Do it', the card
updates and buzzes") is squarely about gate and timing, the two things a redirect plan actually
changes; food-stall queues and hotel-coach timing are real but secondary content. Recomputing the
tip live would mean either shipping a lot more scenario data into `plan` (defeating the point of
keeping the visitor's device light) or re-deriving it from data the room doesn't carry. Flagged
here rather than silently narrowed, since a `foodWaitPeak` genuinely could change after a redirect.

**No offline fallback for `/visit` itself (an actual gap, not a design choice worth defending).**
The Room's own offline mode ("no network — runs as a simulation on this machine") only makes sense
same-device: there is no server to relay through, so a *different* device could never see it
anyway. `openRoom()`'s offline branch sets `visitUrl: ''`, so no visitor link is even offered in
that mode. This is honestly a limitation, not a considered trade-off — logged so it isn't
mistaken for one.

---

## 2026-09-27 — Venue-owner flow + registration upload: what was reused, what was overruled

**Reused from `../pravaah-v2`**: the trust vocabulary and colour ladder (claimed/document-checked/
verified), the per-row trust-pill UI idea, and the "registration → origin/mode/gate/party-size"
concept underlying its `CrowdGroup`/contract schemas. **Rewritten, not ported**: v2's Zod-validated
Venue/Event types, its `/api/registrations/upload` server route, and its Supabase-shaped
persistence. **Why:** ps8 is client-only by design (§ ground rules: "no new Supabase tables or API
routes unless something already works that way") and already has a tested, golden-adjacent seam —
`engine/dataLoader.ts`'s `loadScenarioFromRows()` plus `lib/console.ts`'s `loadScenario()` — that
both `/console` and `/live` read from. Building a parallel Venue/Event model and a second
scenario-construction path would have meant two things that could disagree about what "the venue"
is; adapting owner data into the loader's own row shapes (`GateRow`, `ParkingRow`, `ArrivalRow`)
means there is exactly one.

**Gate "people/min" is a computed, read-only figure, not a second per-gate editable field.** v2's
`VenueGate` has an editable `laneRate` per gate; ps8's engine models lane-rate as ONE global
constant (`Scenario.laneRate`, `VENUE_DEFAULTS.laneRate = 28`) multiplying every gate's `lanes`.
**Why:** adding a genuine per-gate lane-rate would be a real engine schema change — a new field
threaded through `simulate()`'s gate-capacity calculation (§6.6.3) — which SOURCE_OF_TRUTH §14.2/
§6.10 gates behind "golden test stays green, and any deliberate engine-behaviour change must be
explained." Not worth it for a demo slice when `lanes` alone already gives the owner a real,
engine-connected lever. The people/min figure is still shown (lanes × 28) so the number isn't
hidden, just not a second thing to edit.

**Rows with no gate hint are distributed across the venue's real gates by lane capacity, not sent
to "needs review."** The brief's own literal reading ("unmappable rows go to a small needs-review
list") would, applied to a gate column, gut the demo: the shipped sample CSVs (both this
project's `contract/samples/registrations-*.csv` from v2 and the two new messy fixtures here) have
a "Gate Pref"/"Preferred Stand" column that is blank for most rows — real registration forms
usually don't ask which gate someone prefers. **Why this reading:** the brief also says results
should "map to gates via the loaded scenario," which only makes sense as an instruction to route
gate-less people somewhere real, not to discard them. `lib/registrations/apply.ts`'s
`allocateProportional()` (largest-remainder method, so it never loses or invents a person) is the
mechanism. Reserved "needs review" for what actually can't be safely guessed: a missing origin
(who are they) or a missing/invalid group size (an invented headcount is exactly the class of
number SOURCE_OF_TRUTH §3.2 forbids) — never a missing mode or gate, both of which get a safe,
disclosed default instead.

**Entrances are a thin, display-only naming layer over gates, not a new engine concept.** v2 has a
genuine `VenueEntrance` (a set of transport points feeding a set of gates) that its cohort-routing
logic walks. ps8's `gates.csv` already conflates entrance-and-gate — a gate zone's own forecourt is
its entrance. **Why not build the fuller v2 model:** it would require a second, parallel graph
(entrances → gates) alongside the one `dataLoader.ts` already builds from `gates.csv`, purely so a
label could say "Main entrance" instead of "Gate 1" in one more place — cost not worth it for what
the ground rules call "one clear action per screen." The owner still gets to name entrances and
say which gate they feed, with their own trust pill; it just isn't a second thing the simulation
reads.

**XLSX was not built.** No parser dependency exists in `package.json`, and `.xlsx` is a zip of XML
parts — not "trivial" to hand-roll safely. The two shipped messy samples (an odd-header CSV, a
pasted WhatsApp-style list) exercise CSV, TXT/paste and — via `lib/registrations/parse.ts`'s
JSON-array branch — JSON, which is what the brief actually asks to cover ("CSV, XLSX (only if a
parser dependency already exists or is trivial), TXT/JSON, and a big paste-anything box").

**The fallback (no-registrations-yet) arrival split had to be redesigned mid-build, live —
proportional-by-lanes was quietly self-cancelling.** See `docs/PROGRESS.md` for the bug itself; the
decision worth recording here is *why* the fix is "split by gate count" rather than, say, "split by
forecourt area" or "split evenly across an assumed number of cohorts per gate." **Why gate count:**
it's the simplest split that is provably independent of every number the Gates table lets the owner
edit (lanes, forecourt area) — any split that used one of those fields as a weight would risk the
same self-cancelling trap for that field. It's explicitly a placeholder (tagged `estimated`,
replaced wholesale the moment real registrations are uploaded), so "simple and honestly rough" beats
"a cleverer guess that might hide a real lever's effect again."

---

## 2026-09-27 — Data-driven: four choices worth explaining

**Quick Start's venue step reuses the existing OSM importer rather than a fake single-gate default.**
The brief's step 2 (5-6 inputs, immediate answer) and step 3 (venue auto-fill) read as sequential,
but a genuinely useful "immediate answer" needs real gate/station/hotel geometry, which only the
importer (`engine/venueImport/buildGraph.ts`) can produce from a venue name. **Why:** building a
throwaway single-gate scenario for step 2 and then replacing it with the importer's output for
step 3 would mean two code paths producing two different "first answers" for the same input, and
the second one silently invalidating the first. Folding them into one `/setup` flow (cached venue =
offline path, live search = online path) means there's exactly one "first answer," and it's already
the richer one.

**`Scenario.zones[venue].capacity` is set to the sum of `arrivals.csv` sizes, not `event.csv`'s
raw stadium capacity.** `engine/__tests__/venues.test.ts`'s `checkGraph()` (and, on inspection,
`dyPatil` itself: its 9 cohorts sum to exactly 84,000) treats `sum(cohort.size) === venue.capacity`
as a real invariant, not an artifact of one hand-built scenario. **Why:** the simulation is of the
people who actually show up, not the empty seats; DY Patil's own 45,000-seat/97.1%-turnout sample
data confirms this reading (`tickets.csv`'s T-1 total and `arrivals.csv`'s total both land on
43,709, independently). The stadium's nominal capacity and turnout % are kept in `scenario.sub`'s
text for display, never fed into the sim as if they were attendance.

**The confidence meter counts CSV rows, not individual fields.** Considered tagging every column
of every row separately for a more granular "38 of 312 individual values are invented" count.
**Why not:** the sample data's own `status`/`source_note` columns are already per-row, not
per-field — a `gates.csv` row is invented or it isn't, as a whole editorial judgment by whoever
filled it in; splitting it into per-column tags would invent a precision the source data doesn't
have. Row-level counting also produced a suspiciously exact match to the brief's own worked example
("38 of 73 inputs are invented" — this repo's sample lands on 73 total rows), which reads like
row-counting was the intended granularity.

**Cut order followed the brief's own list, with one deviation.** Stopped after step 6 (no
hardcoding) plus the confidence/calibration pieces of steps 4-5, cutting 8 (weather) and 7
(timeline UI) as instructed. Step 3 (venue auto-fill) was *not* cut, despite being listed as the
first thing to drop if time were short — because it turned out to be nearly free once Quick Start
needed venue geometry anyway (see above), not a separate feature competing for the same time
budget. Full per-section Quick Start editors (steps for gates/tickets/hotels/resources as separate
forms) were cut instead, since CSV upload and the sample already cover "add real detail" and a
second, redundant editing surface felt like exactly the kind of feature the brief's "keep the UI
minimal" rule warns against building.

---

## 2026-09-26 — Dynamic Telegram: staying one-way, and one dedup simplification

**Telegram stays one-way, as the brief explicitly asks to note.** `lib/telegram.ts` gained
`editTelegramReplyMarkup`/`answerCallbackQuery` back in Phase 3 for a possible Acknowledge-button
webhook, but no webhook route exists to receive a callback, and this pass doesn't add one. **Why:**
unchanged from the Phase-3 reasoning already on record here — a Telegram webhook cannot be
registered or tested against `localhost`, and this pass, like Phase 3, has no public HTTPS
deployment to verify one against. Building it now would mean shipping code with zero of it actually
verified. If a deployment exists later, the pieces are already in `lib/telegram.ts`.

**`status_changed` alerts once per evening (the first time status reaches Act now), not on every
calm→watch→act flap.** Considered tracking the previous status and alerting on every transition
into `act`. **Why not:** the same `sentOrders`-by-title dedupe every other alert here uses is
"once ever per title," and a title like `Status: Act now` can only naturally represent one event
under that scheme — re-designing dedupe specifically for this one message type (a resettable,
time-windowed dedupe) felt like solving a problem the brief didn't actually raise ("send only on
meaningful change" is satisfied by "the first time it becomes meaningful"), at the cost of a new
kind of state this pass would be the only thing using. Flagged here rather than silently narrowed:
if a real event runs long enough that the evening flaps between watch and act several times, ops
will only be told about the first one.

---

## 2026-09-26 — Monitor loop: three choices worth explaining

**1. A fired tripwire installs Red Team's precomputed backup directly — it does not ask the
optimiser to search again.** `runMonitorTick()`'s tripwire branch skips step 2 (the fresh
`engine().replan()` call) entirely when a tripwire fires. **Why:** the backup was already computed,
specifically for the single worst night Red Team found, by the same optimiser, with the same cost
weights (`redTeam.ts`'s `withBackup` search). Running the optimiser again on the newly-observed
scenario would likely converge on something very close to that same backup anyway, at real cost
(another worker round-trip) and — more importantly — at the cost of the story being told: "Red
Team already found this, here is what it already found works" is a stronger, more honest claim
than "a fresh search just happened to agree." **Trade-off accepted:** the backup was computed for
Red Team's *worst* version of this factor (e.g. the single worst rain night in the grid), not the
exact severity actually observed — it may be slightly more conservative than strictly necessary.
Acceptable: conservative-and-proven beats precise-and-unverified for a tripwire that's about to be
handed to someone stressed with five seconds to look at it.

**2. `approveReplacement()` is a separate function from `approve()`, not a parameter on it.**
Considered adding an `atTick` override to `approve()` instead (smaller diff). **Why not:**
`approve()`'s side effects — jumping into `mode: 'replay'` at a fixed tick range, a 7x speed
canned playback to `stopAt: 372` — are specifically right for a *first*, pre-event approval (the
guided "watch the outcome" moment `SOURCE_OF_TRUTH` §12's demo beat depends on). A mid-event
re-approval after a plan stopped working must do the opposite: stay in `live` mode, at the real
clock, so the organiser keeps watching the actual evening, not a replay of a different one. Sharing
one function with a flag to invert half its behaviour would have been more confusing to read than
two short, named functions with different jobs.

**3. "Stopped working" fires at +3 dangerous minutes over what was promised, not any
regression.** The recheck re-simulates the exact same approved levers under new conditions every
monitor tick; small negative drift (1-2 minutes) is expected numerical/ensemble-adjacent noise
across different scenario clones, not a real failure. **Why 3, not something derived from Red
Team's own SURVIVE_CRUSH=5 threshold:** `SURVIVE_CRUSH` defines "does a whole *night* count as
safe" for the stress grid; this is a much narrower question — "did *this specific* approved plan's
own promise get meaningfully broken by what's now been reported" — and reusing the night-level
constant here would have implied a connection between the two that doesn't actually exist. Flagged
here in case field data later shows 3 is too sensitive or not sensitive enough — it is not derived
from anything the engine computed, unlike everything else in this pass.

---

## 2026-09-26 — Live control room brief: where this pass overrules the brief, and why

Working from the "calm, live control room" brief (turn Pravaah from a static plan+approve tool
into a continuous Watch→Detect→Re-plan→Ask loop). Recording every place this pass's judgment
differs from the brief's literal text, per the brief's own instruction to log overrules here.

**1. VIP stays a "playbook" flag, not a fabricated cohort.** The brief lists VIP as one of six
buckets and separately asks for VIP "as its own cohort/gate" as a possible missing-scenario
addition. Rather than bolt on a plausible-looking VIP cohort just so the dot can claim
`coverage: 'simulated'`, the VIP bucket in `lib/buckets.ts` is honestly `'playbook'`: safe by
default, watch only from a plain staff-report flag with zero numbers attached. **Why:**
SOURCE_OF_TRUTH §3's rule — "no LLM ever produces a number," "honesty: guessed data is marked
illustrative" — is a promise about coverage itself, not just about individual figures. A VIP
cohort built in an hour to fill a dot would be exactly the kind of "generic dashboard with numbers
that look real but aren't" the source-of-truth explicitly says the other ~119 teams will build (§2).
A real VIP cohort (separate gate, separate arrival curve) is deferred to slice (e), opt-in, if time
remains — not faked now.

**2. The monitor loop reuses the existing full-resimulate-with-clamping pattern, not a new
engine checkpoint API.** The brief asks for "lock the past, re-run the REST of the evening from
now." The engine audit found this already exists as a pattern (`retime()` clamps lever start ticks
to ≥now, `fracRemaining()` reweights only undeparted people, `expireLevers()`/`replan()` already
do exactly this on every clock-driven re-plan) — it just always pays the full 0..H `simulate()`
cost (~8ms lite) rather than truly resuming from a saved mid-run state. **Why:** building a real
checkpoint/resume API would touch `engine/simulate.ts`'s core loop, which SOURCE_OF_TRUTH §14.2/§6.10
explicitly gates behind "golden test stays green, and any deliberate engine-behaviour change must
be explained" — a much bigger, riskier change for a cost (~8ms per re-plan) that's already well
inside the "10s total for background searches" budget (§6.9). The monitor loop is being built as a
thin driver on top of the existing pattern, not a rewrite.

**3. Number-safe LLM wording reuses `app/api/llm/polish/route.ts`'s placeholder scheme verbatim,
not a new implementation in `lib/messages.ts`.** The brief's own text suggested the placeholder
scheme "lives in" the messages/templates layer; the audit found the real, already-proven
implementation is in the polish API route (mask numbers as `[[i]]` → LLM → reject on any stray/
missing digit → re-inject). **Why:** it already exists, is already tested against the real Groq
API, and duplicating it in a second location is exactly the kind of drift SOURCE_OF_TRUTH's
`peakPulseBurst()` decision (2026-09-25) was written to prevent. Extended, not reimplemented.

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

## 2026-09-27 — Timeline (Slice 1): preflight audit + a real infinite-render bug caught by the build itself

**Preflight, before any new code:**
- **`/visit`'s redirect gate already only ever offers Gate 2 or Gate 1 for West-stand fans, never
  Gate 5.** Read `data/sample/dy-patil/tickets.csv`'s `alt_gates` column (`G2;G1` for both West
  Lower and West Upper) and traced it through `engine/dataLoader.ts` (`gb.altIds[0]` — first entry
  wins) into `lib/room.ts`'s `visitOrigins()` and `lib/visit.ts`'s `buildVisitCard()`. No fix
  needed; this was already correct going in.
- **The Calm/danger consistency rule (`lib/console.ts`'s `opsStatus()`) already holds.** Traced
  every path that can resolve to `'calm'`: no board yet (genuinely nothing to do), every board
  option `useless` (the recommended plan's own levers don't help against any of the 12 stress
  nights — a distinct, already-tested state, see `lib/__tests__/opsStatus.test.ts`), or a plan is
  **approved** — and that last case's sentence already says "In force since HH:MM," which is
  exactly the brief's "and then say so in the sentence" carve-out. Any lever's deadline closing
  unhandled routes through `expireLevers()` into a `replan`, which `opsStatus()` checks *before*
  falling through to calm. No fix needed.
- **Default match date.** Was genuinely broken: `components/setup/Setup.tsx`'s Quick Start date
  field defaulted to a hardcoded `'2026-01-01'`, in the past as of today (2026-09-27), and the
  downloadable `event.csv`/`tickets.csv` templates had the same stale placeholder. Fixed: both now
  read `defaultMatchDateISO(todayISO())` (`lib/timeline.ts`), i.e. always exactly 60 days out,
  computed at page-load, never hardcoded.

**A real bug this slice's own build caught (not a preflight item — found live-testing the new UI):**
`components/live/TimelineBand.tsx` initially put `timelineDueActions(st)` *inside* a `useSlice`
selector, the same way `DecisionClock.tsx` puts `crushIfStartedAt(...)` inside its own selector.
That pattern is only safe when the computed value is a primitive (a number, compared by value);
`timelineDueActions()` returns an array of freshly-allocated objects on every call, so two
back-to-back calls with an *unchanged* store still produce different references. `lib/createStore.ts`'s
`useSlice` caches its `getSnapshot` result via a shallow-equal check specifically to satisfy
`useSyncExternalStore`'s contract that `getSnapshot` must return a stable value when nothing
changed; violating it doesn't just cause extra re-renders, it throws "Maximum update depth
exceeded" in the browser. Live-verified with Playwright against `npm run dev` (console: "The
result of getSnapshot should be cached to avoid an infinite loop"). Fixed by moving the
`useSlice` selector to only the raw, stably-referenced state (`playbook`, `timelineDecisions`,
`scn`, `base`, …) and computing `timelineDueActions()` as a plain call in the component's own
render body instead — recomputing on every render of *this* component is fine; recomputing inside
`getSnapshot` is not.

**Scope call: which playbook rows get a real simulated benefit.** The brief's own 4 worked
examples (block hotel rooms/30d, confirm coaches/14d, brief gate staff/3d, publish visitor
guide/7d) don't all map cleanly onto an engine `Intervention` — "confirm coaches" would need a
specific link id, and no single choice (which hotel cluster? which road?) generalises across an
arbitrary uploaded dataset. Rather than fake a target, `data/playbooks.csv`'s `lever_type` column
is left blank for that row (and for the two pure-ops rows) — they show up in "Do by" as an honest,
un-simulated playbook reminder, never claiming a benefit number they can't back with a real
`simulate()` diff. Two rows *do* get one: `house` (moves late-bookers into hotels — scenario-wide,
needs no target id) and a 5th row I added beyond the brief's 4, "add extra screening lanes at the
busiest gate" (`lanes` — the target gate is picked live, as whichever gate has the longest peak
wait in the currently-loaded snapshot, never a hardcoded gate id, so it stays honest across any
dataset).

---

## 2026-09-27 — Weather (Slice 2): reused the existing rain lever, added only the real data source

**What already existed vs. what this slice actually built.** Before writing any code, traced
`rain` end-to-end: `lib/whatifParse.ts`'s `WhatIfSpec.rain`, `engine/whatif.ts`'s `applyRain()`
(cuts lane throughput, slows/shrinks cab and rail cohorts), `engine/redTeam.ts`'s stress grid, and
`lib/monitor.ts`'s `firedTripwires()`/`buildObservedScenario()` were all already fully wired —
rain has been a complete, simulated, tripwire-capable lever since before this slice. So Slice 2 is
genuinely just "add a real trigger for the existing lever," not a new rain model: `lib/weather.ts`
only ever decides *whether* to call the pre-existing `reportObserved({ rain: true }, ...)`, and
never touches `applyRain` or any simulated number itself.

**Verified Open-Meteo's current API shape before coding** (both endpoints fetched live,
2026-09-27): forecast (`api.open-meteo.com/v1/forecast`, `hourly=precipitation_probability,precipitation`,
16-day horizon) and historical archive (`archive-api.open-meteo.com/v1/archive`,
`daily=precipitation_sum`, ERA5 back to 1940). No API key needed for either. Confirmed the forecast
response's actual JSON shape with a live `curl` against DY Patil's coordinates for a near-term date
before trusting my own parsing of it.

**Climatology's "did it rain" bar is a separate constant from the acting threshold.**
`RAIN_DAY_MM = 1` (in `lib/weather.ts`) decides whether a single historical day counts as "it
rained" for the "X of the last 10 years" count; `WEATHER_THRESHOLD` (`{ probabilityPct: 60,
amountMm: 4 }`) decides whether *today's* reading is bad enough to act on. Conflating them would
have meant a light-drizzle year could either wrongly count as "rained" in the history, or wrongly
fail to trigger the threshold that's supposed to be about real risk — they answer different
questions and are kept as two separate, clearly-named numbers rather than one overloaded config.

**Climatology years are anchored to the real calendar year, not the match year.** For a match date
2+ years out, "the last 10 years" means the 10 real calendar years before *now*, not before the
(possibly not-yet-real) match year — asking "how often has it rained on Dec 25" only makes sense
against years that have actually happened.

**A network failure (or DEMO_OFFLINE) always resolves to the labelled sample reading, never
throws.** `fetchWeather()` catches internally and returns `SAMPLE_WEATHER` (tagged `source:
'sample'`, chancePct low enough it can never itself cross the threshold) rather than leaving
`ConsoleState.weather` null or rejecting — Live Ops must never block or blank out because a
weather API hiccupped mid-demo.

**The 3 rain/postponement playbook rows (hotel-extension window, refund policy, re-entry rule) are
trigger-conditional, not calendar-dated.** `engine/playbook.ts`'s `PlaybookAction.leadDays` is
`null` for these three (see `data/playbooks.csv`); `dueActions()` now takes a `weatherTriggered`
flag and only includes `leadDays == null` rows when it's true, due immediately ("do by" today) —
they don't clutter the Timeline's "do by" list on an ordinary dry-weather day, and appear the
moment the forecast actually crosses the threshold, exactly like the tripwire-fired backup plan
they're modelled after.

**Live-verified against the real APIs, not just mocks.** `npm run dev` + Playwright against the
bundled sample scenario (match date ~89 days out, i.e. beyond the forecast horizon) showed a real
climatology chip — "0% RAIN · CLIMATOLOGY (PAST 10 YEARS)" — fetched live from Open-Meteo's archive
API for DY Patil's real coordinates. Separately confirmed the forecast endpoint's live response
shape with a direct `curl` for a near-term date (the bundled sample's match date doesn't fall
inside the 16-day forecast window, so the forecast branch itself is covered by `lib/__tests__/weather.test.ts`'s
mocked-fetch tests, not this particular live run).

---

## 2026-09-27 — Predicted vs Actual (Slice 3): a real recalibration bug caught live, and the scope calls made to ship it honestly

**A real bug, found by live-testing, not by code review.** The first working version of
`recalibrate()` re-simulated the recalibrated scenario with **no interventions** (`simulate(recalibratedScn,
[], opts)`). Live in the browser (approve "Tell Nerul rail that Gate 2 is quieter" — a `nudge`
reroute — then demo feed → Recalibrate), forecast error went **7.3% → 14.7%, i.e. worse**, not the
brief's "18% → 6%" shrinking pattern. Root cause: `predicted` had been frozen from a SimResult
*with* the nudge intervention applied (some of the Nerul cohort actually screens through the alt
gate), and the demo actuals were generated from that same nudge-affected prediction — but
recalibration's re-simulation silently dropped the intervention, comparing the fit against a
*different*, un-nudged evening. Fixed by threading the same `ivs` that produced `predicted` through
to `recalibrate()`'s re-simulation (`lib/console.ts`'s `recalibrateNow()` now passes
`s.approved?.ivs ?? []`); pinned with a regression test in `engine/__tests__/actuals.test.ts` that
fails loudly (not vacuously) if the sample scenario ever stops having an alt-gate cohort to exercise
this path. **This is exactly why SOURCE_OF_TRUTH's "live-verify, don't just unit-test" discipline
matters** — the original (buggy) version had a passing unit test too, just with too generous a
tolerance to catch a real direction reversal.

**Known simplification, disclosed rather than silently accepted:** `applyRecalibration()` maps each
cohort to *one* gate (the last gate-mode link on its primary `path`) and scales/shifts the whole
cohort by that gate's fit. A cohort mid-nudge genuinely splits between its primary and alt gate at
simulate-time; the fit doesn't itself know about that split, so a heavily-rerouted cohort's
recalibration is an approximation, not exact. Re-including the plan's interventions (the fix above)
recovers the correct split at re-simulate time regardless, which is why the live error still shrank
correctly to 1.7% — the approximation only affects *how the fit is computed*, not whether the
re-simulation itself stays honest.

**Reused, not rebuilt: the registrations column-mapper's actual generic pieces.**
`lib/registrations/fuzzyMap.ts`'s `resolveGate()` (exact id/name, or a loose substring either way)
is imported directly into `lib/scans/apply.ts` — it was already gate-agnostic-enough to reuse
verbatim for scan-log gate names, not just registration origins. The Groq column-mapping endpoint
(`app/api/llm/scans/route.ts`) mirrors `app/api/llm/registrations/route.ts`'s validation discipline
(only ever accepts a header name copied verbatim from the given list) but is its own, simpler route
— scan logs are always tabular (gate, time, count), so there's no free-text-extraction half to
build, unlike registrations' WhatsApp-style messy-list path.

**Recalibration re-simulates the whole evening, not a literal "resume from now."** The brief says
"re-run the REST of the evening from now (reuse the monitor loop)." The engine has no mid-run
resume concept anywhere, including in the monitor loop itself — `buildObservedScenario` always
re-simulates the *whole* evening under a patch that only changes what's ahead of a lock tick. This
slice follows that same, already-established shape (`applyRecalibration` clones+adjusts cohorts,
then a fresh full `simulate()`), rather than inventing a new partial-resume mechanism the rest of
the codebase doesn't have.

**Trust rule kept to exactly what the brief specifies.** `trustForGate()` is a plain, symmetric
two-rung rule — `verified` at ≤15% absolute error, `claimed` otherwise — not a 3-rung ladder with an
invented middle "document-checked" trigger, since the brief only ever describes the 15% rule for
this context (the claimed→document-checked→verified ladder itself is Slice 4's territory, reused as
`OwnerTrust`, not redefined here).

---
