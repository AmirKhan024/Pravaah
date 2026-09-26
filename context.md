# Pravaah — full project context

This document exists so an AI assistant (or a new teammate) with **no access to the repository** can understand exactly what Pravaah is, why it exists, how it actually works internally, what is built vs. planned, and how to reason about it correctly. It is written to stand alone — paste it into a fresh chat and treat every claim in it as ground truth about the current state of the codebase as of **26 September 2026**.

If you are an AI reading this to help the team (debug, extend, pitch, write docs, etc.), read this whole file before answering anything specific. Section 6 (the simulation engine) is the technical heart of the project and the part most likely to matter for any code-adjacent question.

---

## 1. What Pravaah is, in one paragraph

On 4 June 2025, eleven people died in a crowd crush outside a stadium in Bengaluru. The crowd was not violent — it simply arrived faster than the gates could process it, and nobody realised until it was too late. **Pravaah ("flow" in Hindi/Marathi) is a flight simulator for event organisers.** Before a mega-event (a stadium concert, a match, a large gathering), Pravaah simulates the entire evening minute-by-minute — every person's journey from hotel or train or car, through roads and gates, into the venue. It finds the exact minute and place the crowd will become dangerously dense, proves *why* (not just that it happens), tests dozens to hundreds of possible fixes against the same simulation, and tells the organiser **how many minutes they have left to act** before a fix stops working. Every number shown to the user comes from actually running the simulation — nothing is guessed, and no AI/LLM is ever allowed to invent or alter a number.

**The positioning line used everywhere in the product and pitch:**
> "Every other system watches the crush happen. Pravaah tells you before it happens, proves why, and tells you how long you have left to stop it."

## 2. Origin and context

- Built for **HackCelestial 3.0**, a hackathon at Pillai University, by **Team Grid9** (a team of four).
- Problem statement **PS-8: Mega-Event Hospitality Orchestration** — "Intelligent capacity and crowd management across accommodation, transport and visitor movement." Track: Hospitality & Travel.
- Competitive context: roughly 320 teams total, about 120 working on the same PS-8 problem statement. The team's explicit strategy was that a generic PS-8 solution (a dashboard, a chatbot, a booking tool) would not stand out — **uniqueness of the whole approach is the entire strategy.**
- Built in a 24-hour hackathon sprint, "vibe-coded" heavily with Claude Code (an AI pair-programmer), and has continued to be iterated on afterwards (the version described here is well past the original 24-hour cut).
- Deliberately **excluded**, on principle, because "every other team" would build it: CCTV/YOLO camera-based crowd detection, a generic heatmap dashboard, a generic attendee chatbot, a hotel-booking recommender, or an LLM that "predicts risk" with numbers it made up. **Pravaah uses no cameras, no sensors, no hardware of any kind.** All input is data that already exists for any event: a ticket/cohort list, a rail timetable, a hotel inventory, and a road/gate layout.

## 3. The non-negotiable design principles

These are treated as hard rules throughout the codebase, enforced in code review and in the project's own `SOURCE_OF_TRUTH.md`:

1. **Deterministic engine.** The same inputs always produce the same simulated evening. The only randomness anywhere is a seeded pseudo-random generator (`mulberry32`), used only where explicitly specified — for generating many *different* perturbed nights (ensemble forecasting, stress testing), never for the core replay.
2. **No LLM ever produces a number.** The one language model in the stack (Groq, running an open model) is allowed to do exactly two things: (a) turn a typed-out "what if" question in plain English into a small, fixed, clamped JSON patch that the *engine* then applies, and (b) reword a message for a public-address announcement — with every digit in the message replaced by a placeholder before the model ever sees the text, and reinserted afterward from the simulation's real output. If the model's rewritten text contains any raw digit, or has a missing/extra placeholder, the output is rejected outright and the fixed template is used instead. No chart, density value, cost, or probability shown anywhere is touched by the LLM.
3. **Every claim is proven by re-running the simulation.** A claimed cause of danger is proven by removing that one factor and re-running (this is the "ablation" analysis). A proposed fix is proven by applying it and re-running. Fixes that were considered and rejected are shown on screen too, with their actual simulated result and a one-line reason they lost.
4. **Accommodation, transport, and gates all live in the same simulation.** This is the core hospitality insight and the reason the "hospitality" track fits: *where people are staying changes how the crowd moves at the gates.* A hotel-booking decision (e.g. "put late-arriving attendees in a hotel across town with an empty coach fleet, instead of letting them cab straight to the nearest, already-jammed gate") measurably changes gate density in the same run.
5. **No new hardware.** Inputs are lists an organiser already has: tickets/cohorts, a train timetable, hotel room counts, parking/cab capacity, and a map of roads and gates (pulled from OpenStreetMap for a new venue). No cameras, no beacons, no sensors.
6. **Plain language throughout the UI.** Short sentences. The *idea* is always stated before the *number* ("so tight nobody can move — 5.8 people per square metre", not just "5.8 p/m²"). No unexplained jargon.
7. **Radical honesty about assumptions.** Every guessed or illustrative number is explicitly labelled as such in the UI (e.g. hotel inventory, forecourt areas). Nothing pretends to be measured data when it's actually a plausible assumption.
8. **Speed is treated as a feature, not an implementation detail.** A full simulated evening — 84,000 people over 540 simulated minutes — runs in roughly **10–20 milliseconds** in the browser. This speed is exactly what makes it possible to test 100+ candidate fixes live, in front of an audience, with no visible lag. Heavy searches (optimiser, ensemble, ablation, decision-window stress testing, red team) run off the main thread in a Web Worker so the UI never freezes.

## 4. The product shape — five steps + a live map

The whole organiser experience is a **five-step console** (each step is literally a UI tab/stage), always paired with a live animated map of the venue and its surroundings. In order, the five steps answer three questions in sequence: *What's going wrong → what should I do → what must I do right now, and how long do I have?*

1. **REHEARSE** — Replay the full evening, minute by minute, from empty venue to show start. This is the base "do-nothing" evening, animated on the map (people-dots flowing along roads/rail/walking paths into gates and the venue).
2. **PREDICT** — Run the simulation 60 times with small random perturbations (different turnout, different train timing jitter, etc. — all seeded and reproducible) to get a probability, not just a single deterministic answer: e.g. "in 56 of 60 runs, the West forecourt becomes dangerously dense; most likely around 19:12."
3. **EXPLAIN** — Root-cause analysis by *ablation*: remove one plausible cause at a time (e.g. "what if gate routing were different," "what if Gate 3 had more screening lanes," "what if the late-hotel-booking problem didn't exist," "what if trains didn't arrive in bursts") and re-run, measuring how many "dangerous minutes" (see §6) disappear. This is where the product's most striking finding at the flagship venue comes from (see §7): **two different single fixes each independently eliminate ~100% of the danger — which proves it's a *mismatch* problem (crowd going to the wrong gate), not a *capacity shortage* problem** (not simply "not enough lanes").
4. **PROVE** — An automated search tries many combinations of interventions ("levers": extra screening lanes, extra shuttle buses, asking a group to leave earlier/later, moving late-bookers into hotels with better routing, extra food stalls, or a paid/persuasive "nudge" message asking a group to change route or timing) across three optimisation profiles (see §6.8), and shows the winning plan plus the plans that were tried and rejected, each with its own simulated outcome. At the flagship venue the winning plan costs **₹0** — it's purely a messaging fix.
5. **GUIDE** — Turn the approved plan into concrete outputs: crowd-facing messages (in Marathi, Hindi, and English), staff orders (e.g. "add lanes at Gate X starting at time T"), transport orders (e.g. "move Kharghar hotel coach departure 30 minutes earlier"), and accommodation orders. Every number in every message is injected directly from the simulation result — never generated by the LLM.

Two live standing elements the organiser always sees:

- **The Decision Clock** — the product's visual "hero" element: a large, ticking countdown showing how many minutes are left before the earliest deadline among the recommended plan's levers closes (see §6.8, "Decision window"). When it hits zero, that lever is struck through, the optimiser is silently re-run from the current moment without it, and the console visibly shows the new — worse — best plan, making the cost of waiting tangible.
- **The Ghost** — the "if you did nothing" evening, shown alongside the plan everywhere as a constant point of comparison.

## 5. What makes Pravaah different (the "unfair advantages")

These are the features specifically designed to make the product not look like the other ~119 PS-8 submissions:

- **The Room** (built, P0 priority). Judges/audience members scan a QR code with their own phones and literally *become* simulated crowd members — the app assigns each phone to a cohort (e.g. "you are one of 24,000 people arriving on the harbour rail line tonight"), in their chosen language (Marathi/Hindi/English). When the organiser approves a plan containing a "nudge" (a message asking a cohort to reroute or shift timing), every joined phone buzzes with that exact message and a real Accept/Decline choice. The **live acceptance rate from real phones replaces the simulation's modeled acceptance probability** for that cohort, and the whole evening is re-run live on the shared screen using real human choices instead of the model's assumption — visibly showing "the room said yes 40%, the model predicted 26%," etc.
- **Decision Clock as hero UI** (built, P0). Described above — this is the single biggest visual/UX bet of the product: instead of a static dashboard, the organiser watches a real ticking deadline.
- **Red Team** (built, P0). The system tries to break its own recommended plan: it re-simulates the chosen plan across a grid of ~192 "bad night" scenarios (different turnout multipliers, rain on/off, rail failure at different times, gates opening late, screening lanes running 10% slower), and reports something like "survives 11 of 12 rough nights; breaks only if the rail line fails after 18:30 — here is the backup plan for that case."
- **Incident replay** (built, P1). A respectful reconstruction of the actual 4 June 2025 Bengaluru incident, built only from public reporting (approximate crowd size, venue capacity, timing of gate/announcement events), showing when Pravaah's forecasting would have crossed a warning threshold and what the cheapest effective fix would have been. Carries a mandatory on-screen disclaimer: "Reconstruction from public reporting. Illustrative, not a finding of fact." No dramatic imagery, no casualty depiction.
- **Any venue in 60 seconds** (built, P1). A `/venues` page lets you search or pick a venue; the app pulls real road/rail/gate/hotel data from OpenStreetMap (via the Overpass API and Nominatim) within about a 1.5 km radius and auto-builds a usable zone/link graph — entrances become gates, plazas in front of them, stations/parking become transit zones, nearby hotels cluster into hotel zones — with every auto-derived number explicitly marked "estimated" and editable. Several venues are pre-cached as static JSON (including the flagship DY Patil Stadium and the hackathon's own campus) so the demo never depends on live internet access.
- **Hotels as control valves** (built, P2). Hotel checkout time, breakfast timing, and hotel-coach departure time are themselves optimiser levers, not just static data — moving a coach's departure time 30 minutes earlier measurably reduces gate pressure kilometres away. This is the concrete embodiment of principle #4 above.
- **The Black Box ledger** (built, P2). Every forecast issued, warning raised, plan recommended, plan rejected, plan approved, order sent, and room result is appended to a tamper-evident, hash-chained log (SHA-256 chained via the browser's Web Crypto API), with a "Verify ledger" button that recomputes the whole chain and flags the first broken link if any byte has been altered. This exists to answer, after the fact, "what did the organiser know, and when."
- **Real delivery** (built, P1). The "Guide" step's orders aren't just displayed — they can be *actually sent*: a real Telegram message to an operations channel (see §9), a real SMS, and a real spoken PA announcement via text-to-speech in the browser (with a cloud TTS fallback), all sourced from the exact same simulation-derived text.

**Explicitly out of scope, by design decision:** cameras/computer vision of any kind, a general-purpose chatbot, login/authentication for organisers (the demo is deliberately open — the "Room" uses anonymous per-phone session IDs instead), and payments.

## 6. The simulation engine — how it actually works

This is the technical core of the whole product, and it is a **faithful, deterministic, pure-TypeScript port** of a working single-file HTML/JS prototype (`reference/prototype.html`, which remains in the repo as the canonical source of truth for *behaviour* — any ambiguity is resolved by reading what the prototype code actually does). The ported engine lives in `engine/` and is completely framework-free: no DOM access, no React, nothing browser-specific — it runs identically in Node.js (for tests), in the browser main thread, and inside a Web Worker.

### 6.1 Core constants

```
CRUSH = 4.0 people/m²   — a zone or path segment at or above this density, for one full minute,
                           counts as one "dangerous minute" (the engine's core safety signal)
JAM   = 5.8 people/m²   — the absolute max a space can hold; above this people physically cannot
                           enter and back up onto whatever leads into that space ("spillback")
TYPICAL_SPEND = ₹900     — scales the monetary persuasion term in the "nudge acceptance" model
FOOD_VISIT_RATE = 0.008  — share of a nearby plaza's population that queues for food per minute
MAX_LANES_GATE = 8, MAX_LANES_TOTAL = 12   — caps on how many extra screening lanes are feasible
```

Simulated time moves in **1-minute integer ticks**. The flagship scenario runs for 540 ticks (9 simulated hours).

### 6.2 The world model

A scenario is a fixed graph of **zones** (transit hubs, parking lots, hotels, plazas, gates, the venue itself, food-stall areas — each with an area in m² and, where relevant, a lane count or room count) connected by **links** (walking paths, roads, shuttle routes, or gate-crossings — each with a people/minute capacity and free-flow travel time), populated by **cohorts** (groups of people sharing an origin, an arrival-time distribution, a route, a price-sensitivity to being persuaded, and a preferred language). The flagship scenario has 9 cohorts, from a few thousand to tens of thousands of people each, arriving by rail, cab, self-driving, or already staying in one of four nearby hotel clusters.

### 6.3 How arrivals actually happen (this is the crux of why crushes occur)

Each cohort's arrival over the evening follows a Gaussian curve (a mean arrival time and a spread), **but rail-fed cohorts additionally have a "pulse"**: the model explicitly bunches their Gaussian mass into sharp bursts every few minutes, simulating a train literally discharging ~900 people onto the platform at once rather than a smooth trickle. This detail is treated as essential and is explicitly never allowed to be "smoothed away" — dangerous crowd crushes in the real world come from bursts hitting a fixed-capacity bottleneck, not from smooth aggregate demand, and the model is built to reproduce exactly that mechanism.

### 6.4 The interventions ("levers") the optimiser can pull

| Lever type | What it does | Rough cost model |
|---|---|---|
| `lanes` | Add extra screening lanes at a gate, from a given time onward | ₹1,400 per lane per hour of use (capped) |
| `shuttle` | Add extra shuttle vehicles to a road/transit link, capacity ramps in over 15 min | ₹2,600 per vehicle |
| `stagger` | Shift a cohort's arrival-time mean earlier/later | An "inconvenience" cost proportional to group size × shift × how many people haven't already left |
| `house` | Move late, unbooked attendees into hotel rooms with a better route (arriving by coach instead of cab) | Coach cost + inconvenience |
| `nudge` | Send a persuasive message asking a cohort to reroute or shift time, optionally with a cash incentive | Cost = (number who accept) × (reward offered); acceptance modeled below |
| `food` | Add extra food-service stalls at a food zone | ₹900 per stall per hour |

**The persuasion ("nudge") model** is a logistic acceptance curve, and its calibration encodes the single most important strategic insight the product surfaces: **time saved matters far more than money offered.** Formally, the probability a person accepts a reroute/reschedule ask is `sigmoid(-1.9 + 3.0·priceSensitivity·(reward/900) + 0.045·max(0, minutesSaved) − 0.06·extraInconvenienceMinutes)`. In practice this means the flagship venue's winning plan is a **free message** telling people about a genuinely faster gate, not a paid incentive — the time saving alone clears the acceptance threshold.

There is also a designed hook, `acceptOverride`, which lets a caller (specifically, The Room's live phone votes) **replace the model's calculated acceptance probability with the real, live, human acceptance rate observed from actual phones**, for whichever cohort the room's participants were assigned to, and re-run the simulation with that real number substituted in.

### 6.5 The per-minute simulation loop

For every one of the 540 simulated minutes, in order: (1) new arrivals enter the start of each cohort's route according to its (possibly pulsed) arrival curve; (2) demand into every link is totalled; (3) each link's current carrying capacity is computed (gates are 0 before they open, then `lanes × a fixed per-lane rate`; other links use a base capacity, boosted by any active shuttle lever); (4) people move along each link's path in proportion to available capacity relative to demand (this proportional-sharing mechanic, plus a standard traffic-engineering travel-time formula — the BPR function — that slows travel as a link nears saturation, is what creates realistic congestion rather than an artificial hard queue); (5) **critically, destinations have a maximum holding capacity** (`area × JAM`), and only as many people as physically fit are allowed to actually enter — everyone else is forced to remain on the link leading into that space, which is exactly the mechanism ("spillback") that turns an ordinary queue into a dangerous crush; (6) density is recomputed for every zone and link, and any zone/link at or above the `CRUSH` threshold for that minute adds one "dangerous minute" to the running tally; (7) gate wait times, food-stall queue backlogs, and (at the scheduled show-start time) the count of people who simply never made it in ("missed") are all tracked; (8) unless running in a lightweight "no frame storage" mode (used for the hundreds of runs needed by search algorithms), a full snapshot of every zone's and link's occupancy, density, flow, and travel time is stored for that minute, which is what drives the animated map.

### 6.6 What comes out of one run

A single `simulate()` call returns: total dangerous minutes, how many people missed the show start, total person-hours spent waiting, how many late-arrivals ended up unhoused, whether hotel-housing was used, the total ₹ cost and total "inconvenience" cost of whatever interventions were applied, the peak density reached anywhere, a full time series of densities (used to draw charts), per-gate and per-food-stall peak wait times, details of exactly how many people in each cohort accepted each nudge and why, and (if not in lightweight mode) the complete minute-by-minute frame data used to animate the map.

### 6.7 The analyses built on top of the raw simulator

- **Ensemble (drives the PREDICT step):** 60 runs with small, reproducibly-seeded random perturbations (turnout ±, train timing jitter, arrival-curve spread, lane throughput variation) → a probability of a crush occurring at all, and p10/p50/p90 estimates of *when* the first dangerous minute happens.
- **Ablation (drives the EXPLAIN step):** each plausible root cause (mis-routing at the gates, insufficient screening capacity at the busiest gate, the late-hotel-booking problem, and the train "pulse" burstiness) is individually removed and the evening re-run; the causes are ranked by how many dangerous minutes disappear when each is removed. At the flagship venue, **two entirely different single fixes each independently eliminate essentially all the danger** — which is the proof that the underlying problem is people being *routed to the wrong gate* (a mismatch), not simply *not enough total gate capacity* (a shortage). This distinction is the product's single sharpest, most counter-intuitive finding.
- **Optimiser (drives the PROVE step):** a greedy forward search that, at each step, adds whichever single available lever most reduces a weighted cost function (a blend of dangerous minutes, wait-hours, people missed, money spent, inconvenience caused, and people left unhoused), subject to feasibility limits (lane caps, only one nudge per cohort, etc.), up to a fixed search depth. It runs under **three named profiles** with different cost-function weightings and depths: **"Zero rupees"** (free levers only, e.g. messaging), **"Balanced"**, and **"Safest"** (deepest search, tolerates real spend). The search is fast enough (well under a second for over a hundred candidate plans) to run live, in the browser, while the user watches.
- **Rejected options:** alongside the winning plan, the console explicitly shows a few plausible-sounding but actually-worse fixes (e.g. adding lanes at the *wrong*, already-underused gate), each with its real simulated result and a one-line explanation of why it loses — this is core to principle #3 (every claim proven by re-running).
- **Decision window / the Decision Clock's data source:** for every lever in the recommended plan, the engine evaluates, across 12 different "rough night" combinations (three turnout levels × rain on/off × late-train on/off), the latest possible start time at which that lever still delivers at least 15% of its best-case benefit. The deadline shown to the user is the **earliest (most cautious)** of those 12 evaluations — i.e., the clock always shows the worst case, never an optimistic one.
- **Red Team:** reuses the same 12-scenario stress grid plus a small additional search over adversarial conditions to find the single worst realistic night for the *specific chosen plan*, reporting a survival rate ("11 of 12") and, for the one scenario that breaks it, an automatically-computed backup plan.
- **Trend warning:** a short-horizon linear projection (fit only over the last 8 played minutes, and mathematically incapable of reading beyond the current simulated moment — this constraint is enforced deliberately, to avoid any appearance of "cheating" by looking into the future) that flags if the current density trajectory is about to cross the danger threshold within the next 8 minutes.
- **Ravi's trace:** a single named, illustrative attendee ("Ravi Sharma," travelling with his 9-year-old daughter Aarohi, from Dombivli, arriving on a specific train) is traced minute-by-minute through both the do-nothing evening and the plan-in-effect evening, showing concretely what changes for one real person, not just an aggregate statistic.

### 6.8 Performance target and how it's met

A full run of the flagship scenario (84,000 simulated people, 540 minutes) is required to complete in roughly 15–20 milliseconds in an ordinary laptop browser; searches that need hundreds of runs (optimiser, ensemble, ablation, decision window, red team) run in a lightweight mode that skips storing the expensive per-frame map data, and execute inside a dedicated Web Worker (via the `comlink` library) so none of it ever blocks the UI thread or causes visible jank during a live demo.

### 6.9 Golden test (correctness discipline)

Before any UI work was allowed to begin, and before any change to engine behaviour is allowed to merge, the engine's output is checked byte-for-byte against the original prototype: `scripts/extract-golden.mjs` actually executes the prototype's own original JavaScript inside a Node VM sandbox and records its real outputs (crush minutes, missed count, cost, gate waits, which levers the optimiser picked, every frame) into `engine/__tests__/golden.json`; `engine/__tests__/simulate.test.ts` then asserts the TypeScript port reproduces those exact numbers. This is treated as a hard gate — engine behaviour is never allowed to drift silently, and any genuinely new behaviour (The Room's `acceptOverride`, egress modelling, etc.) is implemented behind opt-in options specifically so the golden test keeps passing unchanged for existing behaviour.

## 7. The flagship demo scenario — DY Patil Stadium, Nerul, Navi Mumbai

This is the scenario used in the actual product demo and shown by default.

- 84,000-capacity venue. Simulated evening: 14:00 to 23:00 (540 minutes). Gates open at 16:00. The show itself starts at 19:30.
- **Three gates:** Gate 3 (12 screening lanes, fed by a 1,600 m² west forecourt), Gate 1 (10 lanes, 3,400 m² north forecourt), Gate 5 (8 lanes, 2,800 m² east forecourt).
- **Transit access points:** Nerul railway station, Seawoods Darave station, a Palm Beach Road cab drop-off, and Sector 20 parking.
- **Hotels (four clusters):** Vashi (2,400 rooms, 2,280 already occupied by other guests), CBD Belapur (1,800 rooms, 1,750 occupied), Kharghar (2,100 rooms, only 1,180 occupied), Panvel (1,600 rooms, only 640 occupied). The pattern that matters: **there are roughly 1,880 empty rooms sitting in Kharghar and Panvel while the hotels closest to the venue (Vashi, Belapur) are essentially full.** (Note: earlier drafts of the product's own documentation stated this combined figure as "2,050," which never actually matched the underlying per-hotel numbers even in the original prototype — the current app deliberately **computes this figure live** from the actual room/occupancy data instead of hard-coding a number in copy, specifically so this kind of drift can never happen again.)
- **Nine attendee cohorts,** the two largest being 24,000 people arriving via the Nerul rail line (in train-sized pulses) and 13,000 via the Seawoods rail line, plus 8,600 arriving by cab from Palm Beach Road, 15,000 self-driving, 1,400 late bookers with no hotel room secured near the venue, and the rest already staying in the four hotel clusters.
- **What the simulation actually reveals:** roughly 47,000 people end up routed toward Gate 3 alone, while only about 14,000 go to Gate 5. Gate 3 can only process about 336 people per minute, but demand hits roughly 660 per minute at peak — so the west forecourt fills up and the overflow backs up onto the Nerul pedestrian skywalk, reaching the 5.8 people/m² "jam" density where people are physically unable to move. **The fix that actually works, and costs nothing:** simply tell the Nerul, Seawoods, and cab-arriving crowds that Gate 5 is comparatively empty. Separately, moving the Kharghar hotel coach departure 30 minutes earlier also meaningfully helps. Notably, *adding more screening lanes at Gate 5* — the fix a purely capacity-focused approach might reach for — removes essentially zero dangerous minutes, because the underlying problem was never "not enough lanes," it was "nobody is being told to walk there."
- **The hospitality connection, concretely:** the 1,400 late-booking attendees with no hotel room near the venue currently take cabs late in the evening straight to the already-overloaded Palm Beach/Gate 3 corridor. Simply booking them into the empty Kharghar/Panvel rooms instead routes them by coach to Gate 5, which is under-used — directly linking a hotel-booking decision to a measurable reduction in crowd danger at a gate kilometres away. This is the single clearest illustration of the product's core hospitality thesis (principle #4, §3).

A second scenario, a Marine Drive marathon, exists purely as an internal test fixture to prove the engine generalises beyond one hardcoded venue — it is not part of the demo narrative.

## 8. What the UI actually looks like and how it's organized

**Visual identity:** a calm, serious, "control room" dark theme — near-black ink background (`#101715`), dark panel surfaces, brass/gold (`#C9A961`) as the *only* accent colour, and a density colour ramp running from cool blue-green (safe) through yellow/amber to red (dangerous). Red is reserved exclusively for actual danger signals. No decorative gradients, no glassmorphism, no emoji anywhere in the product. Numerals use a tabular monospaced style so digits don't jitter as they update live. The design brief explicitly states every screen must be readable from the back of a room, with at most four numbers visible on screen at any one time outside of an intentionally-opened detail drawer.

**Pages / routes actually implemented:**

- `/` — the cover/landing page. Its hero visual is not a static image — it's the live engine itself, running the do-nothing evening and showing real simulated numbers (e.g. "18:10 · DY Patil Stadium, if nobody acts · 84,000 people, 540 minutes, simulated in 9.4 ms on this device") directly on the landing page, before the user has clicked anything.
- `/console` — the full five-step organiser console described in §4: Rehearse → Predict → Explain → Prove → Guide, the live animated map, the Decision Clock, Ravi's trace, the do-nothing "ghost," what-if controls, Red Team, The Room, and the Black Box ledger, all reachable from one screen with keyboard shortcuts (`Space` to play/pause the replay, `1`–`5` to jump between steps, `R` to open The Room, `Esc` to close any open drawer).
- `/live` — a newer, simplified **"Live Ops" default landing view** (added most recently — see §11), which recomposes the same underlying state and logic into a four-zone operational cockpit rather than the full five-step walkthrough: (1) a big status word — Calm / Watch / Act now — reusing the Decision Clock's own visual "hero band" styling; (2) the same live map, centred; (3) an "Actions due" list — one card per currently-recommended lever, each showing a single plain-language sentence, a live countdown, and Approve / Skip / Why? buttons; (4) an "Orders sent" running log. A persistent "Full console" link always lets the user drop down into the complete five-step flow, which remains fully intact and unchanged underneath. This is now the **default landing experience** the cover page points to.
- `/join/[roomId]` — the attendee-facing PWA a phone opens after scanning the Room's QR code: pick a language (Marathi/Hindi/English), get assigned to a cohort, and later receive a real buzzing notification with an Accept/Decline choice when the organiser approves a plan.
- `/replay` — the respectful Bengaluru incident reconstruction described in §5.
- `/venues` — the "any venue in 60 seconds" venue importer described in §5.

## 9. Technology stack (what is actually running, and why each piece was chosen)

| Layer | Technology | Why |
|---|---|---|
| Language | TypeScript, everywhere (engine, server, browser, Worker) | One single engine implementation runs in every context — no separate Python/JS split, no behavioural drift between a "backend model" and a "frontend model." |
| App framework | Next.js (App Router), on Vercel | One deployable app serves the organiser console, the attendee PWA, and all API routes together. |
| Styling | Tailwind CSS + small hand-built components | Fast to build, while keeping tight control over the specific dark/brass visual identity. |
| Map rendering | MapLibre GL JS (client-only pages use a dynamic-import pattern so map/engine code never runs server-side) | Real animated geography rather than an abstract diagram. |
| Heavy computation | A Web Worker running the whole engine, via `comlink` | Keeps the optimiser/ensemble/ablation/red-team searches from ever blocking the UI, even though each involves running the simulator hundreds of times. |
| Realtime backend | **Supabase** (Postgres + Supabase Realtime) | Backs The Room (rooms, participants, live vote tallies) and the Black Box ledger, with full Row-Level Security. |
| Venue data | OpenStreetMap, via the Overpass API (feature queries) and Nominatim (geocoding search), plus pre-cached static JSON for known venues | Lets "any venue in 60 seconds" work for a genuinely new location, with offline-safe fallbacks for the demo. |
| Real-world delivery | **Telegram Bot API** for ops-channel orders (see below); SMS; browser `speechSynthesis` (with a cloud TTS fallback) for PA announcements | Makes the "Guide" step's outputs real, sendable artifacts on stage, not just UI mockups. |
| Language model | Groq, running an open model, used **only** for wording/translation/what-if-parsing (see principle #2, §3) | Fast and cheap, and structurally prevented from ever influencing a displayed number. |
| Testing | Vitest, with the golden-test discipline described in §6.9 | Correctness of the deterministic engine is treated as more important than any UI polish. |

**Data persistence architecture (Supabase), specifically:** every table has Row-Level Security enabled. The publishable/anon key is granted **read-only** access (a blanket `SELECT` policy — needed because Supabase Realtime authorizes subscriptions against the same RLS policies as normal REST reads). Every *write* — creating a room, a participant joining, casting a vote, broadcasting a plan, appending to the ledger — goes exclusively through Next.js API routes using the **service-role key**, never directly from the browser. This was a deliberate choice: the app has no organiser login/auth at all by design (principle/decision in §2/§5.3 — the demo is meant to be open), so there's no `auth.uid()` to write a real per-row ownership policy against; blanket service-role-only writes were judged safer than any looser anon-write policy. Both The Room and the Black Box ledger have a required **offline/in-memory fallback** that activates automatically if Supabase is unreachable, so the demo never hard-fails on network loss (see the `roomServer.memory.ts` vs `roomServer.supabase.ts` facade pattern in the codebase).

**Telegram integration, specifically:** a real Telegram bot sends one-way operational messages (staff, transport, accommodation, and food orders — **explicitly never crowd-facing messages**, which stay as WhatsApp/SMS/PA-only) to a real ops channel/chat, through a single shared server-side helper function so there is exactly one code path that can ever actually fire a send (this matters — see §11, a real duplicate-send bug was found and fixed here). An acknowledge-plus-webhook stretch goal was deliberately scoped out, because Telegram webhooks cannot be registered against a local development URL and there was no way to test it honestly in the time available — a scoping decision made explicitly and documented, not a silent omission.

**Offline-safe demo mode:** setting `NEXT_PUBLIC_DEMO_OFFLINE=1` disables Supabase, Twilio/SMS, and Groq entirely and switches everything to local, in-memory fallbacks, so the entire core demo (the five-step console, the map, the engine, the Decision Clock) works with **zero internet dependency**. This exists specifically as insurance against unreliable venue/hackathon Wi-Fi during a live pitch.

## 10. Repository layout (as it actually exists today)

```
pravaah/  (repo name on GitHub: AmirKhan024/Pravaah)
├─ SOURCE_OF_TRUTH.md         ← the canonical internal spec (everything in this context.md is drawn from it + the live code)
├─ CLAUDE.md, AGENTS.md       ← instructions for AI coding assistants working in this repo
├─ README.md                 ← shorter public-facing summary
├─ docs/
│  ├─ PROGRESS.md             ← dated changelog, one entry per completed phase of work
│  └─ DECISIONS.md            ← a log of trade-offs and alternatives considered/rejected, with reasoning
├─ reference/
│  └─ prototype.html          ← the original single-file prototype; canonical for simulation BEHAVIOUR only, never touched for UI
├─ engine/                    ← pure TypeScript, framework-free, runs in Node/browser/Worker identically
│  ├─ constants.ts, types.ts, arrivals.ts, simulate.ts, interventions.ts, optimise.ts,
│  │  ensemble.ts, ablation.ts, decisionWindow.ts, redTeam.ts, trace.ts, trend.ts, whatif.ts
│  ├─ scenarios/  (dyPatil.ts = the flagship scenario, marathon.ts = test fixture, bengaluru2025.ts = incident replay, venues/*.json = pre-cached venues)
│  ├─ venueImport/  (Overpass/Nominatim-based live venue graph builder)
│  └─ __tests__/  (golden.json + simulate.test.ts — the correctness gate described in §6.9)
├─ worker/engine.worker.ts    ← exposes the engine to the browser via comlink, off the main thread
├─ app/                       ← Next.js routes: /, /console, /live, /join/[roomId], /replay, /venues, and API routes under app/api/ (ledger, llm, net, room, send, telegram, venues)
├─ components/
│  ├─ console/                ← the five-step console shell, the Decision Clock, drawers, orders panel, timeline, toast, etc.
│  │  └─ steps/                ← Rehearse.tsx, Predict.tsx, Explain.tsx, Prove.tsx, Guide.tsx
│  ├─ live/                   ← the newer /live "Live Ops" view: StatusBand.tsx, ActionsDue.tsx, Live.tsx
│  ├─ room/                   ← RoomPanel.tsx (organiser-side view into The Room)
│  ├─ map/, cover/, replay/, venues/, ui/
├─ lib/                       ← shared client/server logic: the global app store (console.ts, built on a small custom Zustand-like createStore.ts), Supabase client (supabase.ts), the room server facade (roomServer.ts + .memory.ts + .supabase.ts backends), the ledger (ledger.ts), Telegram (telegram.ts), message templates (messages.ts, mr/hi/en), the Groq client (groq.ts), what-if parsing (whatifParse.ts), etc.
├─ supabase/schema.sql        ← the full Postgres schema + RLS policies
└─ scripts/                   ← one-off tooling: extract-golden.mjs (the golden-test extractor), apply-schema.mjs, various now-deleted throwaway verification scripts used during development
```

**A strict architectural boundary is enforced throughout:** `engine/` is never allowed to import anything from `app/`, `components/`, or any browser-only API — it must remain runnable as plain Node.js code for the test suite, with zero framework dependency.

**State management pattern worth understanding:** the entire app's live state (which step is active, the current simulated tick, the loaded scenario, the current approved plan, the optimiser/ensemble/ablation results, room votes, sent-orders log, which drawer is open, etc.) lives in **one single shared store** (`lib/console.ts`, built on a small custom `createStore`/`useSlice` hook — not Redux, not a full Zustand dependency, just the same pattern hand-rolled small). This is deliberate: it's what allows the newer `/live` "Live Ops" view (§8) to be built as a genuinely different *composition* of the exact same underlying state and actions the five-step console already uses, with **zero duplicated simulation or business logic** — every button in Live Ops calls the identical function the five-step console's equivalent button calls.

## 11. Current state of the build (what's actually done vs. planned)

As of this document's writing, essentially the entire feature list in §5 and §4 is **built and working**, not just planned:

- The engine (§6), fully ported and golden-tested (52 automated tests passing, `tsc --noEmit` clean).
- The five-step console, fully built, including the Decision Clock hero, the "ghost" comparison, Ravi's trace, what-if controls (both fixed chips and a typed-question box parsed by the LLM into a structured patch), rejected options, and the manual "build your own plan" control deck.
- The Room, fully built and live-tested against a real Supabase project — real Realtime WebSocket subscriptions, real anonymous phone participation, real vote tallying, real `acceptOverride` re-simulation.
- Red Team, fully built.
- The Bengaluru incident replay (`/replay`), fully built, with its disclaimer.
- The venue importer (`/venues`), fully built, with live OpenStreetMap import and pre-cached fallback venues.
- Real Telegram delivery for ops orders, live-tested against a real bot and real chat.
- The Black Box hash-chained ledger, backed by Supabase with an in-memory fallback.
- **Most recently added:** the `/live` "Live Ops" simplified default landing view (§8), built as a pure recomposition of existing logic per an explicit later decision to bring this feature *back into scope* after it had originally been deliberately deferred during the initial build. During that work, a real bug was found through live end-to-end testing (not just code review): two different UI surfaces that could each independently mark an order as "sent to Telegram" were tracking that state in separate, disconnected local component state, which meant an order auto-sent from one screen could still show an un-clicked "send" button on the other screen — a real risk of double-sending an actual message to the live ops channel. It was fixed by moving "has this exact order been sent, and when" into the single shared app store described in §10, so every surface reads and writes through one place and can never disagree.

**Known, explicitly-acknowledged limitations (stated on screen in the product itself, not hidden):**
- Forecourt areas, lane counts, and path widths for the flagship DY Patil scenario are plausible but not independently surveyed.
- Hotel inventory numbers are illustrative; the *pattern* they demonstrate (rooms full near the venue, empty rooms further away) is the actual point being made, not the exact figures.
- The persuasion/"nudge" acceptance-probability model is hand-calibrated by the team, not fitted to real field data — The Room's live phone votes exist specifically to give a real, if small-sample, sanity check against that model.
- The simulation currently models **arrival only** — egress (people leaving after the show ends) is a documented gap, not yet modelled, which is why the Bengaluru incident replay deliberately does not attempt to show a gate-lane-based fix (since that incident's dynamics involved exit/entry confusion the current engine doesn't cover).
- The incident replay is explicitly a reconstruction from public reporting only, not a verified finding of fact, and is labelled as such on screen.
- Venue-import results are estimates that need a human sanity check before being trusted, and are explicitly editable in the UI for that reason.

## 12. The pitch/demo narrative (how this is meant to be presented)

The whole build serves a roughly 5-minute live demo with this beat structure: open with a single respectful sentence about the real Bengaluru incident and a pause; open The Room live on screen with a QR code so the audience becomes the simulated crowd; run PREDICT to show the calm-looking map is nonetheless flagged as dangerous by the forecast, with the Decision Clock visibly starting to tick down; run EXPLAIN to reveal the "mismatch, not shortage" finding; run PROVE to show the ₹0 winning plan against rejected alternatives; approve the plan live so the audience's own phones buzz and vote, and watch the evening re-run using their real choices, including Ravi's personal outcome changing; show Red Team's "survives 11 of 12 bad nights" result; demonstrate venue-agnosticism by importing a new venue (or the hackathon's own campus) live; and close on a Black Box ledger entry with the line "Same 84,000 people. Same stadium. Same evening. Different decisions."

## 13. Glossary (terms used throughout the product and codebase)

| Term | Meaning |
|---|---|
| Crush density / dangerous minute | A zone or path segment at ≥ 4.0 people/m² for one simulated minute |
| Jam density | 5.8 people/m² — the absolute max a space can hold before it stops admitting anyone |
| Spillback | When a full destination stops admitting people, causing them to back up on whatever leads into it |
| Cohort | A group of attendees sharing an origin, arrival timing, and route |
| Pulse | The train-burst arrival pattern (~900 people discharged roughly every 6 minutes) |
| Lever / intervention | Something the organiser can actually change (lanes, a message, a shuttle, a schedule shift, room bookings, food stalls) |
| Nudge | A persuasive message asking a cohort to reroute or shift timing, optionally with a monetary reward |
| Ensemble | Many perturbed simulation runs combined into a probability, rather than one deterministic answer |
| Ablation | Removing one candidate cause and re-running, to measure its real contribution to the danger |
| Decision window | How much longer a given lever will still meaningfully help, evaluated against 12 stress-tested "rough nights" |
| Red Team | Deliberately searching for the worst realistic night that would break the chosen plan |
| Ghost | The do-nothing evening, shown for comparison everywhere the plan's evening is shown |
| The Room | Real phones in the live audience acting as real crowd members inside the simulation |
| Black Box | The tamper-evident, hash-chained log of every forecast, warning, recommendation, and approval |
| Live Ops | The newer, simplified four-zone `/live` landing view, as opposed to the full five-step `/console` |

---

*This file was generated from the project's own internal specification (`SOURCE_OF_TRUTH.md`), its public README, its dated progress/decisions logs, and a direct inspection of the current repository structure, so that it can be handed to an AI assistant or a new reader with no other access to the codebase and still convey an accurate, complete, and current understanding of what Pravaah actually is and how it actually works.*
