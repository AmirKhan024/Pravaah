# Decisions log

Trade-offs and alternatives considered, appended per `SOURCE_OF_TRUTH.md` §14.11. Newest entry on top.
This is not a changelog (see `docs/PROGRESS.md` for that) — only entries where a real choice was made.

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
