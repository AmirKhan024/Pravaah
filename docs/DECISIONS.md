# Decisions log

Trade-offs and alternatives considered, appended per `SOURCE_OF_TRUTH.md` §14.11. Newest entry on top.
This is not a changelog (see `docs/PROGRESS.md` for that) — only entries where a real choice was made.

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
