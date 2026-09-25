# PRAVAAH — Source of Truth

> Read this file completely before writing any code. It is the single reference for what Pravaah is, why it exists, how the engine works, what we are building, and the rules we never break.
>
> If anything in the codebase contradicts this file, this file wins. If this file is ambiguous, ask before guessing.
>
> A working single-file prototype exists at `reference/prototype.html`. It is the **canonical implementation of the simulation engine**. Port its engine logic faithfully. Do **not** copy its UI, layout or code structure; the UI is being rebuilt from scratch.

---

## 0. Quick context

| | |
|---|---|
| **Event** | HackCelestial 3.0, Pillai University |
| **Team** | Grid9 |
| **Track** | Hospitality & Travel |
| **Problem statement** | PS-8: Mega-Event Hospitality Orchestration. Intelligent capacity and crowd management across accommodation, transport and visitor movement. |
| **Product** | Pravaah (Hindi/Marathi: "flow") |
| **Competition reality** | About 320 teams, about 120 on PS-8. A normal PS-8 project will not win. **Uniqueness is the entire strategy.** |
| **Build mode** | 24-hour hackathon, vibe-coded with Claude Code, team of four |

---

## 1. The one-paragraph pitch

On 4 June 2025, eleven people died outside a stadium in Bengaluru. The crowd was not violent. It arrived faster than the gates could take it, and nobody knew until it was too late. **Pravaah is a flight simulator for event organisers.** It rehearses the whole evening before it happens, finds the minute the crowd will break, proves the cause, tests every fix across hotels, trains, roads and gates, and tells you **how many minutes you have left to act**. No AI invents a number. Every figure comes from running the evening.

**Positioning line (use it everywhere):**
> Every other team watches the crush happen. Pravaah tells you 40 minutes early, proves why, and tells you how long you have left to stop it.

---

## 2. What the other ~119 teams will build (and what we must never look like)

- CCTV / YOLO bounding boxes with a density heatmap
- A dashboard with a map, red zones and charts
- A generic attendee chatbot
- A hotel listing / booking recommender
- An LLM that "predicts risk" with made-up numbers

**Rule:** if a screen could appear in another team's demo, shrink it or delete it. We do not use cameras. We do not let an LLM produce numbers.

---

## 3. Non-negotiable principles

1. **Deterministic engine.** Same inputs → same evening, every time. Randomness only via seeded PRNG (mulberry32) where explicitly specified (ensembles, stress tests).
2. **No LLM ever produces a number.** LLMs may only: word messages, translate messages, and turn a typed what-if question into a structured scenario patch. Every number on screen traces back to `simulate()`.
3. **Every claim is proven by re-running the evening.** Causes are proven by removing them and re-running. Fixes are proven by applying them and re-running. Rejected fixes are shown with their re-run result.
4. **Accommodation, transport and gates live in the same simulation.** A hotel decision must change gate density. This is the PS-8 core and our key hospitality insight: *where people sleep changes how the crowd moves.*
5. **No new hardware.** Inputs are ticket lists, timetables, hotel inventory, parking/cab counts. No cameras, sensors or beacons.
6. **Plain language in the UI.** Short sentences. Explain the idea before the number. No jargon ("crush density" → "so tight nobody can move"). See §13.
7. **Honesty.** Assumptions are labelled. Guessed data is marked illustrative. The "How this works" panel lists what we guessed.
8. **Speed is a feature.** One full evening (84,000 people, 540 minutes) must simulate in ~15 ms in the browser. That speed is what lets us test 100+ plans live.

---

## 4. The product in one picture

```
 DATA IN                 ENGINE (deterministic TS)                 OUT
 ─────────               ──────────────────────────                ─────
 tickets/cohorts   ─┐    simulate()  minute-by-minute              Organiser console
 rail timetable    ─┤    ├─ ensemble   → probability + timing      Attendee PWA (phones)
 hotel inventory   ─┼──▶ ├─ ablation   → proven cause         ──▶  WhatsApp/SMS orders
 roads/gates (OSM) ─┤    ├─ optimiser  → best plan + rejected       PA audio (TTS)
 event schedule    ─┘    ├─ decision window → minutes left         Black Box ledger
                         └─ red team   → robustness score
                                ▲
                                │ live acceptance rate from real phones (The Room)
```

**The five steps (the spine of the organiser UX):**

1. **REHEARSE** — replay the full evening minute by minute.
2. **PREDICT** — where it breaks, when, and how likely (ensemble).
3. **EXPLAIN** — remove one cause at a time, re-run, measure (ablation).
4. **PROVE** — simulate every fix; show the winner and the rejected ones with proof (optimiser + red team).
5. **GUIDE** — send orders to hotels, transport, gate staff, and every attendee's phone.

Three questions the UI must always answer in order:
**What's going wrong → What should I do → What must I do right now (and how long do I have)?**

---

## 5. Feature list for the final product

### 5.1 Core (ported from prototype — must exist)

| Feature | Summary |
|---|---|
| Simulation engine | §6. Port exactly. Golden-tested against the prototype. |
| Live map | Zones, links, animated people-dots, density colours, pulsing crush rings. |
| Five-step flow | Scenario → Prediction → Root cause → Options → Outcome. |
| Ensemble forecast | 60 perturbed runs → probability of crush, time window, medians. |
| Ablation (root cause) | Remove each factor, re-run, share of crush minutes explained. |
| Optimiser | Greedy forward search over levers, three profiles (Zero rupees / Balanced / Safest). |
| Rejected options | Show plans that fail with their simulated result and a one-line reason. |
| Manual control deck | User builds their own plan; live projection updates as they change levers. |
| Decision window board | For each lever in the recommended plan: "closes in N min", stress-tested. **Hero element.** |
| Ravi | One attendee traced through both evenings (do-nothing vs plan). |
| Ghost comparison | "If you did nothing" shown alongside the plan everywhere. |
| What-if | Rain, rail failure, show delayed, gates open late. Chips + typed question. |
| Orders ("ready to send") | Plan turned into crowd messages (mr/hi/en), staff orders, transport orders, accommodation orders. |
| After-action report | Do-nothing vs plan, Ravi's evening, history across runs. |
| Short-horizon trend warning | Linear fit over last 8 played minutes, projects 8 ahead, never reads future frames. |
| Food/service load | Food zones with stall throughput, queue per zone. |

### 5.2 New — our unfair advantages (build these; they are why we win)

Priority order. P0 must ship. P1 should ship. P2 only if time remains.

**P0 — The Room (the room becomes the crowd)** — §8.1
Judges scan a QR, their phones join as attendees in a cohort. On plan approval, every phone buzzes with the message in their language. They accept or decline. The **live acceptance rate from the room overrides the nudge model's `p`** for that cohort and the evening re-runs on screen with their choices.

**P0 — Decision Clock as hero** — §8.2
Big countdown "This plan works if you start in 07:12". Ticking in the demo. When it hits zero the recommended plan is re-computed and visibly worse.

**P0 — Red Team (we try to break our own plan)** — §8.3
Search the stress space for the worst realistic night that breaks the chosen plan. Output: "Survives 11 of 12 bad nights. Breaks only if X. Backup plan: Y."

**P1 — Replay a real incident (counterfactual)** — §8.4
Reconstruct Bengaluru 4 June 2025 from public reporting as an illustrative scenario. Show when Pravaah would have warned and the cheapest effective action. One respectful screen.

**P1 — Any venue in 60 seconds** — §8.5
Pick a venue → pull roads/stations/entrances from OpenStreetMap → auto-build the zone/link graph → run. Pre-cache 5 venues including the hackathon venue itself.

**P1 — Egress (leaving)** — §8.6
Model the exit, last trains home and hotel return. Exits are where many crushes happen; this is the prototype's biggest admitted gap.

**P1 — Real delivery** — §8.7
Actually send one WhatsApp/SMS to a judge's number on stage and play a Marathi PA announcement via TTS.

**P2 — Black Box ledger** — §8.8
Every forecast, warning, recommendation and approval appended to a hash-chained, tamper-evident log with a "Verify ledger" button.

**P2 — Hotels as control valves** — §8.9
Checkout time, breakfast timing and hotel coach departure time become optimiser levers; an "overflow broker" screen shows which rooms to block-book and the gate-pressure effect.

### 5.3 Explicitly out of scope / removed

- Cameras, YOLO, computer vision
- General-purpose chatbot
- A standalone second scenario walkthrough (the marathon). The venue importer replaces it as the "not hardcoded" proof. Keep `SCENARIO_B` data only as a test fixture.
- Login/auth for organisers (demo is open). The Room uses anonymous session IDs.
- Payments

---

## 6. The simulation engine (canonical spec)

Port from `reference/prototype.html`, function `simulate(scn, interventions, opts)` and helpers. The spec below describes it; where they differ, **the prototype code is the source of truth for behaviour**, and this doc is the source of truth for intent.

### 6.1 Constants

```ts
CRUSH = 4.0        // people per m² — a zone/link-minute at or above this is "dangerous"
JAM   = 5.8        // people per m² — max holding density; beyond this, spillback
TYPICAL_SPEND = 900 // ₹ — scales monetary incentive in the nudge model
FOOD_VISIT_RATE = 0.008   // share of nearby plaza population queueing for food per minute
MAX_FOOD_STALLS_ZONE = 4
MAX_LANES_GATE = 8        // extra screening lanes at one gate
MAX_LANES_TOTAL = 12      // extra lanes across all gates
```

Time is in integer ticks of **1 minute**. `clock(t) = t0Min + t` formatted HH:MM.

### 6.2 Data model

```ts
type ZoneType = 'transit'|'parking'|'hotel'|'plaza'|'gate'|'venue'|'food';

interface Zone {
  id: string; name: string; type: ZoneType; lat: number; lng: number;
  areaM2?: number;          // transit/parking/plaza/gate/venue — density = occ / areaM2
  lanes?: number;           // gate: screening lanes
  capacity?: number;        // venue
  rooms?: number; occupied?: number; price?: number; // hotel
  near?: string; stalls?: number; serviceRate?: number; // food
}

type LinkMode = 'walk'|'road'|'shuttle'|'gate';
interface Link {
  id: string; from: string; to: string; name: string; mode: LinkMode;
  cap?: number;      // people/min (non-gate)
  ff?: number;       // free-flow travel minutes (non-gate)
  areaM2?: number;   // walk links: density on the link itself
  gate?: string;     // gate links: which gate zone supplies lanes
}

interface Cohort {
  id: string; label: string; size: number;
  mean: number; std: number;        // arrival Gaussian, in ticks
  ps: number;                       // price sensitivity 0..1
  lang: 'mr'|'hi'|'en';
  pulse?: { period: number; width: number; offset: number }; // train bursts
  path: string[];                   // link ids, origin → venue
  alt?: string[]; altExtraMin?: number;  // alternative route + extra walking minutes
  housed?: string[];                // route if given a far hotel room (late bookers)
}

interface Scenario {
  name: string; sub: string; venueLabel: string;
  t0Min: number;          // minutes after midnight for tick 0
  horizon: number;        // ticks
  gatesOpenTick: number; showStartTick: number;
  laneRate: number;       // people/min per screening lane (28)
  lateBookings: number;   // people with no room nearby
  mapZones?: string[];    // zones drawn on the main map
  zones: Zone[]; links: Link[]; cohorts: Cohort[];
}
```

### 6.3 Arrivals

- `arrivalCurve(mean, std, H, pulse?)`: Gaussian weights over `[0,H)`, normalised to sum 1.
- If `pulse`: for each window of `period` ticks, sum the weights and redistribute the sum evenly over `width` ticks starting at `offset % period`. This models trains discharging ~900 people every 6 minutes. **Crushes are built from bursts; do not smooth this away.**
- `fracRemaining(cohort, decisionTick, H)` = `1 − cumulative arrival share up to decisionTick` (no pulse). Used to make late decisions only affect people who have not yet left.

### 6.4 Interventions (levers)

| type | fields | effect | cost (₹) / inconvenience |
|---|---|---|---|
| `lanes` | gate, n, from | +n lanes at gate from tick `from` | `n × 1400 × min((H−from)/60, 5)` |
| `shuttle` | link, add, vehicles, from | link cap += add, ramped linearly over 15 min | `vehicles × 2600` |
| `stagger` | cohort, delta, decisionTick? | shift cohort mean by `delta × remFrac` | inconvenience `size × |delta| × 0.35 × remFrac` |
| `house` | decisionTick? | late bookers get far rooms, travel `housed` path by coach, arrival N(286,34) | `ceil(lateBookings/50) × 2600 × remFrac`; inconvenience `1400 × 28 × remFrac` |
| `nudge` | cohort, ask:'reroute'\|'shift', rupees, delta?, decisionTick? | acceptance model below | `accepted × rupees`; inconvenience `accepted × inc` |
| `food` | zone, n, from | +n stalls at food zone | `n × 900 × min((H−from)/60, 5)` |

`remFrac = fracRemaining(cohort, decisionTick)` when `decisionTick` given, else 1.

**Nudge acceptance model (logistic):**
```
inc   = ask==='reroute' ? altExtraMin : |delta|
saved = reroute ? wait[origGate] − wait[altGate] − altExtraMin
                : wait[origGate] × 0.6
p     = sigmoid(−1.9 + 3.0·ps·(rupees/900) + 0.045·max(0,saved) − 0.06·inc)
accepted = round(size × p × remFrac)
```
`wait[gate]` comes from `opts.waits` (peak gate waits of a do-nothing probe run). Key insight this encodes: **time saved matters more than money**, which is why the best plan tonight costs ₹0.

**The Room override:** `opts.acceptOverride?: Record<cohortId, number>` — if present, replaces `p` for that cohort with the live room acceptance rate (see §8.1). This is a new option; add it without changing default behaviour.

### 6.5 Streams

Each cohort becomes 1–3 streams:
- main path with share `(1 − f)`,
- alt path with share `f` where `f = min(0.95, forceDivert[c] + divert[c])`,
- if housed: housed stream with share `housedFrac`, remaining `(1 − housedFrac)` splits as above.

### 6.6 Per-tick loop (t = 0..H−1)

1. **Arrive:** add `size × curve[t]` into stage 0 of each stream.
2. **Demand:** for each link, sum people waiting to enter it across streams.
3. **Capacity now:**
   - gate link: 0 before `gatesOpenTick`, else `(lanes + addedLanes) × laneRate`
   - other: `cap + shuttleBoost(ramped) ` × `patch.capMult[mode]` (after `patch.fromTick`)
4. **Move** (iterate path stages from last to first): each stream moves `min(waiting, cap × waiting/demand)` — proportional share of capacity.
   - Travel time: gate = 1; otherwise BPR: `tt = max(1, round(ff × (1 + 0.15 × (v/cap)^4)))`, `v = min(demand, cap)`.
   - Movers go into transit buckets that arrive at `t + tt`.
5. **Arrive at destination with holding capacity (spillback):** `holdCap = areaM2 × JAM` (venue = ∞). Only as many as fit enter; the rest stay on the link. **This is what turns a queue into a crush.**
6. **Densities:** zone density = occupancy/areaM2; link density = linkOcc/areaM2 for walk links. Each zone-minute or link-minute ≥ CRUSH adds 1 to `crushMin`.
7. **Gate wait** = (occupancy of the gate's feeder plaza + people on links into it) / gate capacity, capped 150; 0 before gates open.
8. **Wait person-minutes** += plaza occupancy (prototype hardcodes `fc_west/fc_north/fc_east` — generalise to all `type==='plaza'`).
9. **Food queue:** demand = nearby plaza occupancy × FOOD_VISIT_RATE; capacity = stalls × serviceRate; backlog carries forward; wait = backlog/capacity.
10. **Missed:** at `showStartTick`, `missed = venueCapacity − arrived`.
11. If not `opts.lite`, store a frame: zoneOcc, zoneDen, linkOcc, linkDen, linkSat, linkFlow, linkTT, arrived, gateWait, foodWait, crush.

### 6.7 Outputs

```ts
interface SimResult {
  crushMin: number; missed: number; waitHours: number;
  unhoused: number; housed: boolean;
  rupees: number; inconvenience: number;
  peakDen: number[]; peakLinkDen: number[];
  frames: Frame[];                 // empty in lite mode
  nudgeInfo: {cohort,label,rupees,p,accepted,ask,lang,saved}[];
  maxDenSeries: Float32Array; crushSeries: Float32Array;
  gateWaitPeak: Record<string,number>; foodWaitPeak: Record<string,number>;
  maxGateWait: number;
  worst: { zone: number; den: number; tick: number };
  interventions: Intervention[];
}
```

### 6.8 Analyses built on `simulate()`

**Ensemble (PREDICT).** 60 runs, seeds `1000 + i×7`, mulberry32 + Box-Muller Gaussian `g()`. Per run jitter: turnout × (1 + 0.07g); rail cohorts × railShare (1 + 0.16g), non-rail × (2 − railShare); each cohort mean += 13g, std ×(1 + 0.18g) (min 13); pulse offset random; laneRate × (1 + 0.09g). Report: P(crush at worst zone), first-crush tick p10/p50/p90, median peak density, crush minutes, missed.

**Ablation (EXPLAIN).** Remove one factor, re-run, `removed = baseCrush − crushWithout`. Factors in prototype: gate routing (forceDivert), Gate 3 screening capacity (+8 lanes), late bookings (house), train pulses (noPulse). Sort by removed. Two factors each explaining ~100% ⇒ **mismatch, not shortage**.

**Optimiser (PROVE).** Candidate levers from `candidates()`. Greedy forward selection up to `depth`, each step picks the candidate that most reduces cost, subject to `feasible()` (lane caps, one nudge per cohort, food cap). Yield to the UI every 8 evaluations. Cost:
```
cost = w0·crushMin + w1·(waitHours/100) + w2·(missed/1000)
     + w3·(rupees/10000) + w4·(inconvenience/10000) + w5·(unhoused/100)
```
Profiles: Zero rupees `[1,.4,.6,0,.1,.5]` depth 4 (free levers only); Balanced `[.8,.5,.7,.45,.1,1.2]` depth 4; Safest `[1,.55,.9,.04,.05,2]` depth 7.

**Rejected options.** Simulate plausible-but-wrong fixes (8 lanes at Gate 5, shuttles on the empty east road, 8 lanes at Gate 1) and publish the result with a reason.

**Decision window.** For each lever in the recommended plan: for each of 12 stress nights (turnout {1, 1.12, 0.90} × rain {off,on} × late train {off,on}), evaluate start times at checkpoints `[120,180,240,300,360,420]`. The deadline for that night = last checkpoint still delivering ≥15% of that night's best benefit (and ≥1 crush minute). Displayed deadline = **earliest** across nights (most cautious). Live countdown = `deadlineTick − currentTick` (arithmetic, no re-simulation per frame).

**Red Team (new, §8.3).** Reuses the stress batch; also do a small greedy search over stress factors to find the worst night for the chosen plan.

**Trend warning.** OLS slope over last 8 played frames per zone; if projected to hit CRUSH within 8 minutes, warn. Must never read frames beyond the current tick.

**Ravi trace.** `tracePerson(res, path, release=300)`: at each stage he waits until cumulative link flow clears everyone ahead of him (zone occupancy + inbound link occupancy), then travels the link time. Output segments, time inside, total waited, worst density around him. His cohort is `nerul_rail`; if the plan reroutes that cohort, he takes the alt path.

### 6.9 Performance targets

- One full `simulate()` on SCENARIO_A: ≤ 20 ms in a laptop browser.
- `lite: true` runs skip frame storage and are used for all searches.
- Optimiser + ensemble + ablation + decision board must finish in the background within ~10 s total, yielding to the UI.
- Run heavy searches in a **Web Worker** in the new build (prototype runs them on the main thread with yields).

### 6.10 Golden test (mandatory)

Before any UI work: port the engine, run `simulate(SCENARIO_A, [])` and the three optimiser profiles, and assert the outputs match the prototype exactly (crushMin, missed, rupees, maxGateWait, chosen lever labels). Extract expected values by running the prototype in a browser console once and saving them to `engine/__tests__/golden.json`. **Do not "improve" the engine until this test passes.** Improvements (egress, generalised plazas) come after, behind options that keep the golden test green.

---

## 7. Flagship scenario: SCENARIO_A (DY Patil Stadium, Nerul, Navi Mumbai)

Exact values are in `reference/prototype.html` (`const SCENARIO_A`). Copy them verbatim into `engine/scenarios/dyPatil.ts`. Summary:

- 84,000 capacity. Tick 0 = 14:00 (`t0Min 840`), horizon 540 (to 23:00). Gates open tick 120 (16:00). Show tick 330 (19:30). laneRate 28.
- **Gates:** Gate 3 (12 lanes, fed by West forecourt, 1,600 m²), Gate 1 (10 lanes, North forecourt 3,400 m²), Gate 5 (8 lanes, East forecourt 2,800 m²).
- **Transit:** Nerul station, Seawoods Darave, Palm Beach drop-off, Sector 20 parking.
- **Hotels:** Vashi 2,400 rooms (2,280 occupied), CBD Belapur 1,800 (1,750), Kharghar 2,100 (1,180), Panvel 1,600 (640). About 2,050 rooms empty far away while near clusters are full.
- **Cohorts (9):** Nerul rail 24,000 (pulsed), Seawoods rail 13,000 (pulsed), cabs Palm Beach 8,600, late bookings 1,400, self-drive 15,000, Vashi 8,000, Belapur 5,000, Kharghar 6,000, Panvel 3,000.
- **The story the numbers tell:** ~47,000 people route to Gate 3, ~14,000 to Gate 5. Gate 3 clears 336/min but ~660/min arrive. West forecourt fills, spills back onto the Nerul skywalk, and reaches 5.8/m². The best fix is free: tell Nerul/Seawoods/cab arrivals that Gate 5 is empty, and send Kharghar coaches 30 min earlier. Adding lanes at Gate 5 removes 0 crush minutes because nobody walks there.
- **The hospitality link:** 1,400 late bookers with no room nearby take cabs late to Palm Beach → Gate 3. Book the empty Kharghar/Panvel rooms and they arrive by coach at Gate 5 instead.

**Ravi Sharma:** with daughter Aarohi (9), from Dombivli, on the 18:32 train, reaches Nerul at 19:00 (tick 300), cohort `nerul_rail`. Do-nothing: stuck ~40 min at crush density, gets in after the show starts. With the free plan: walks in.

`SCENARIO_B` (Marine Drive marathon) exists in the prototype; keep it only as an engine test fixture proving the engine is scenario-agnostic.

---

## 8. New feature specs

### 8.1 The Room (P0)

**Goal:** the judges become part of the crowd.

**Flow:**
1. Organiser clicks "Open the room" → a room is created, QR code + short URL shown full-screen.
2. Phone opens `/join/[roomId]` (PWA, no login). Picks language (Marathi/हिंदी/English). Is assigned a cohort by weighted round-robin over cohorts that the recommended plan nudges (e.g. Nerul rail, Seawoods rail, cab arrivals). Screen: "You are one of 24,000 people on the harbour line into Nerul tonight."
3. Organiser approves a plan containing nudges → server broadcasts the message to each phone in its cohort, in its language. Phone vibrates (`navigator.vibrate`) and shows the message with Accept / Decline and a countdown.
4. Votes stream back. Console shows live tally per cohort.
5. After the countdown (e.g. 20 s) or when organiser clicks "Run with the room", compute `acceptOverride[cohort] = accepts / (accepts + declines)` (ignore cohorts with < 2 votes; fall back to the model `p`). Re-run `simulate()` with the override. Map animates the new evening. Show "The room said yes X%. The model predicted Y%."
6. Each phone then shows its personal outcome (what happened to "people like you").

**Tech:** Supabase Realtime channels (or Socket.io server). Tables: `rooms`, `participants(id, room_id, cohort, lang)`, `votes(participant_id, plan_id, choice, at)`. Anonymous participant id in localStorage.

**Fallbacks:** five team phones pre-joined; a "simulate room" button that fakes votes if the network dies; demo works fully without the room.

### 8.2 Decision Clock (P0)

- Top of the organiser console, large mono digits: `07:12 left to act`.
- Derived from the decision window board's earliest deadline among the recommended plan's levers, relative to the simulation clock.
- In demo mode the simulation clock advances in real time (configurable speed) so the clock visibly ticks.
- At zero: the lever is struck through, the optimiser re-runs from the current tick without it, and the console shows the new (worse) best plan: "Waiting cost you N more dangerous minutes."

### 8.3 Red Team (P0)

- Input: chosen plan. Search space: turnout multiplier {0.9,1,1.12,1.2}, rain {off,on}, rail failure time {none, 18:00, 18:30, 19:00}, gates open late {0, 30, 60}, lane rate −10%.
- Evaluate the plan on the full grid in `lite` mode in a Worker (≈ 4×2×4×3×2 = 192 runs, fine).
- Output: survival rate (nights where crushMin ≤ 5 and missed within 20% of baseline), the single worst night with its labels, and a **backup plan** = optimiser run on that worst night.
- UI: "Survives 11 of 12 bad nights" card with a small grid heatmap of outcomes and "If the harbour line fails after 18:30, switch to: …".

### 8.4 Incident replay (P1)

- Scenario file `engine/scenarios/bengaluru2025.ts` built from **public reporting only**: venue capacity, approximate crowd size, timing of announcements, gate situation.
- Screen shows: reconstructed timeline, when Pravaah's forecast would cross the warning threshold, the decision window, and the cheapest effective lever.
- Mandatory label on screen: "Reconstruction from public reporting. Illustrative, not a finding of fact." Respectful tone, no dramatic imagery, no casualty animation.
- If the reconstruction can't be made credible in time, cut it rather than ship something shaky.

### 8.5 Any venue in 60 seconds (P1)

- `/venues` page with search (Nominatim) or a list.
- For a chosen venue: Overpass query within ~1.5 km for railway stations, bus stations, parking, major roads, stadium entrances (`entrance=*`, `barrier=gate`), hotels (`tourism=hotel`).
- Auto-build: entrances → gate zones (default 8 lanes), a plaza in front of each gate (default 2,000 m²), stations/parking → transit zones, hotels clustered → hotel zones, links by nearest-neighbour with default caps by mode. Cohorts from a simple split (rail/road/self-drive/hotel) of user-entered capacity.
- Everything auto-derived is marked "estimated" and editable in a side panel.
- **Pre-cache as JSON:** DY Patil (flagship), Wankhede, Narendra Modi Stadium, M. Chinnaswamy, and the hackathon venue (Pillai University campus). Live import is a bonus; cached venues must always work.

### 8.6 Egress (P1)

- Second phase after show end: venue → gates (reverse) → plazas → transit/parking/hotels.
- Departure curve: sharp spike at show end, optional staggered encore.
- Last-train constraint on rail cohorts (people who miss it become cab demand).
- Levers: staggered exit by stand, extra late trains/shuttles, hotel coach return waves.
- Must be behind `opts.egress` so the golden test stays unchanged.

### 8.7 Real delivery (P1)

- Orders screen gets "Send" buttons: WhatsApp Cloud API or Twilio SMS to a configured number (a judge volunteers theirs, or a team phone).
- PA announcement: text-to-speech in Marathi/Hindi/English of the crowd message (browser `speechSynthesis` with a cloud TTS fallback).
- Message text comes from fixed templates, optionally polished by the LLM; numbers are injected from the simulation, never generated.

### 8.8 Black Box ledger (P2)

- Append-only log: `{seq, ts, type, payload, prevHash, hash}`, `hash = SHA-256(prevHash + canonicalJSON(payload))` via Web Crypto.
- Types: `forecast_issued`, `warning_raised`, `plan_recommended`, `plan_rejected`, `plan_approved`, `orders_sent`, `room_result`, `outcome`.
- "Verify ledger" button recomputes the chain and shows ✓ or the first broken entry.
- Export as JSON and a printable timeline ("What did we know, and when?").

### 8.9 Hotels as control valves (P2)

- New levers: hotel checkout extension, coach departure time per hotel cluster, block-booking far rooms with a price.
- "Overflow broker" view: table of hotel clusters (rooms, free, price, distance) and the effect of each block-booking on gate pressure.

---

## 9. Tech stack (decided)

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript everywhere** | One engine runs in browser, Worker and server. No Python split. |
| App | Next.js (App Router) on Vercel | Fast, one deploy for console + PWA + API routes |
| Styling | Tailwind CSS + a small set of hand-made components | Speed; keep the dark ink/brass look (§13) |
| Map | MapLibre GL JS + deck.gl (PathLayer, ScatterplotLayer, TripsLayer) | Premium animated flows over a real basemap |
| Basemap | A dark vector style (e.g. MapTiler/Carto dark, or a self-hosted style) | Must look calm and serious |
| Heavy compute | Web Worker running the engine (Comlink) | UI never freezes |
| Realtime | Supabase (Postgres + Realtime) | The Room, votes, ledger persistence |
| Venue data | OSM Overpass API + Nominatim, pre-cached JSON | No hardware, any venue |
| Messaging | WhatsApp Cloud API or Twilio | Real delivery on stage |
| LLM | Groq (open model) — wording/translation/what-if parsing **only** | Fast, cheap; never numbers |
| TTS | Browser speechSynthesis, cloud TTS fallback | PA announcement |
| Charts | Tiny custom canvas/SVG (timeline strips) | Avoid heavy chart libs |
| Tests | Vitest (engine golden tests) | Correctness first |

Env vars (never commit): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GROQ_API_KEY`, `TWILIO_*` or `WHATSAPP_*`, `NEXT_PUBLIC_MAP_STYLE_URL`.

**Offline-safe demo mode:** `NEXT_PUBLIC_DEMO_OFFLINE=1` disables Supabase/Twilio/Groq and uses local fallbacks, so the core demo works with no internet.

---

## 10. Repo structure

```
pravaah/
├─ SOURCE_OF_TRUTH.md            ← this file
├─ reference/
│  └─ prototype.html             ← canonical engine behaviour; do not edit
├─ engine/                       ← pure TS, no DOM, no React
│  ├─ constants.ts
│  ├─ types.ts
│  ├─ arrivals.ts                (arrivalCurve, fracRemaining)
│  ├─ simulate.ts
│  ├─ interventions.ts           (candidates, feasible, costOf, PROFILES)
│  ├─ optimise.ts
│  ├─ ensemble.ts                (mulberry32, jitter, runEnsemble)
│  ├─ ablation.ts
│  ├─ decisionWindow.ts          (stress batch, board)
│  ├─ redTeam.ts
│  ├─ trace.ts                   (Ravi)
│  ├─ trend.ts
│  ├─ egress.ts                  (P1)
│  ├─ scenarios/ dyPatil.ts, marathon.ts, bengaluru2025.ts, venues/*.json
│  ├─ venueImport/ overpass.ts, buildGraph.ts
│  └─ __tests__/ golden.json, simulate.test.ts
├─ worker/engine.worker.ts       ← exposes engine via Comlink
├─ app/
│  ├─ page.tsx                   ← cover / landing
│  ├─ console/page.tsx           ← organiser console (5 steps)
│  ├─ join/[roomId]/page.tsx     ← attendee PWA (The Room)
│  ├─ venues/page.tsx
│  ├─ replay/page.tsx
│  ├─ report/page.tsx
│  └─ api/ room/, vote/, send/, llm/
├─ components/ map/, steps/, clock/, room/, orders/, ledger/, ui/
├─ lib/ supabase.ts, ledger.ts, i18n.ts, messages.ts (templates mr/hi/en)
└─ public/ manifest.json, icons, cover art
```

**Boundary rule:** `engine/` must not import anything from `app/`, `components/` or any browser API. It must run in Node for tests.

---

## 11. Build plan (24 hours, 4 people)

| Hours | Person A — Engine | Person B — Console | Person C — Room & delivery | Person D — Data & story |
|---|---|---|---|---|
| 0–4 | Port engine + golden test green | Next.js shell, MapLibre + deck.gl map drawing SCENARIO_A static | Supabase project, room/vote tables, join page skeleton | Extract golden values from prototype; venue JSON for DY Patil; draft demo script |
| 4–10 | Worker + ensemble + ablation + optimiser | Five-step flow, animated frames, ghost comparison | QR, cohort assignment, broadcast, vote tally | Overpass importer, cache 4 more venues |
| 10–16 | Decision window + Red Team + `acceptOverride` | Decision Clock hero, rejected options, orders screen | Wire room result into re-run; phone outcome screen; WhatsApp/SMS + TTS | Bengaluru reconstruction; ledger; after-action report |
| 16–18 | Egress (if time) | Polish, mobile layout | Fallbacks (fake votes, pre-joined phones) | Pitch deck update |
| **18** | **FEATURE FREEZE** | | | |
| 18–24 | Bug fixes only | Polish only | Network fallback testing | Rehearse demo 15+ times, record backup video |

---

## 12. The demo (≈5 minutes) — the build serves this

| Time | Beat |
|---|---|
| 0:00 | Bengaluru, 4 June 2025. One sentence. Pause. "The crowd was not violent. It arrived faster than the gates could take it." |
| 0:30 | Open the Room. QR on screen. "You're in the crowd tonight." |
| 1:00 | PREDICT. Map calm, 0.4/m². Warning anyway: probability, time window. Decision Clock starts ticking. |
| 1:45 | EXPLAIN. "Remove one cause, re-run the evening." Mismatch, not shortage. |
| 2:15 | PROVE. "We tried 100+ plans. Here's one that fails, with proof." Winner costs ₹0. |
| 2:45 | Approve. Phones buzz. Judges vote. Evening re-runs with their choices. Ravi walks in. |
| 3:30 | RED TEAM. "We tried to break our own plan. It survives 11 of 12 bad nights." |
| 4:00 | "Name a venue." Import live or open the hackathon venue. |
| 4:30 | Black Box entry. Close: "Same 84,000 people. Same stadium. Same evening. Different decisions." |

Every screen must be readable from the back of a room: large type, one idea per screen, at most four numbers visible at once.

---

## 13. Design and copy rules

**Visual identity (keep from prototype):**
```
--ink:#101715  --panel:#16201E  --panel-2:#1B2624  --line:#26322F
--text:#DCE5E1 --dim:#7A8A85   --dimmer:#586662
--brass:#C9A961 (accent)  --brass-dim:#8E7742
density ramp: #35555F → #3F7A6B → #9AA24B → #C79338 → #CC5F2C → #B02D1E
mono numerals: tabular, slightly negative letter-spacing
```
Calm, serious, control-room. Brass is the only accent. Red only for danger. No gradients-for-fun, no glassmorphism, no emoji.

**Copy rules:**
- Short sentences. Plain words. A 15-year-old should understand every label.
- Idea first, number second: "So tight nobody can move — 5.8 people per m²".
- Always pair a plan's number with the do-nothing number.
- Never say "AI predicts". Say "Pravaah ran the evening N times".
- Label anything guessed as "estimated" or "illustrative".
- Marathi/Hindi/English templates live in `lib/messages.ts` and are reviewed by a native speaker on the team.

---

## 14. Rules for Claude Code

1. Read this file first in every new session. Re-read §3 before touching engine or LLM code.
2. **Engine first, golden test green, then UI.** Never change engine behaviour without updating the golden test deliberately and explaining why.
3. Keep `engine/` pure and framework-free.
4. Never let an LLM output flow into a number, a chart, a density, a cost or a probability. LLM output is text only, and all numbers in that text are template-injected from `SimResult`.
5. Heavy searches run in the Worker. The main thread renders only.
6. Every new lever: add to `candidates()`, `feasible()`, cost accounting in `simulate()`, `leverWorth()` explanation, and an order template.
7. Every feature must work in `DEMO_OFFLINE` mode with a graceful fallback.
8. Prefer small, complete, demoable slices over big half-done features. If a P1/P2 feature isn't demoable by hour 16, cut it.
9. When unsure about intended behaviour, check `reference/prototype.html`, then ask.
10. Do not add: cameras, CV, a general chatbot, login, payments.

---

## 15. Known gaps (say them before judges find them)

- Forecourt areas, lane counts and path widths are plausible for DY Patil but not surveyed.
- Hotel inventory is illustrative; the pattern (full near, empty far) is the point.
- Nudge acceptance parameters are hand-calibrated, not fitted to field data. The Room is our live, small-sample check on them.
- The prototype models arrival only; egress is being added (§8.6).
- The incident replay is a reconstruction from public reporting, illustrative only.
- Venue import produces estimated graphs that need a human check.

---

## 16. Glossary

| Term | Meaning |
|---|---|
| Crush density / dangerous minute | A zone or path at ≥ 4.0 people/m² for one minute |
| Jam density | 5.8 people/m² — nobody can move; max holding |
| Spillback | A full zone stops people entering, so they back up on the path behind |
| Cohort | A group of attendees with the same origin, timing and route |
| Pulse | Trains discharging in bursts (~900 people every 6 min) |
| Lever / intervention | Something the organiser can change (lanes, message, shuttle, stagger, rooms, stalls) |
| Nudge | A message asking a cohort to reroute or shift time, optionally with a reward |
| Ensemble | Many perturbed runs of the evening → probability |
| Ablation | Remove one cause, re-run, measure the difference |
| Decision window | How long a lever still helps, tested against rough nights |
| Red Team | Searching for the worst realistic night that breaks our plan |
| Ghost | The do-nothing evening shown alongside the plan |
| The Room | Real phones in the audience acting as crowd members |
| Black Box | Tamper-evident log of what we knew and when |
