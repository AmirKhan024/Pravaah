# Pravaah

**A flight simulator for event organisers.** Pravaah rehearses the whole evening before it happens: hotels, trains, roads and gates in one simulation. It finds the minute the crowd will break, proves the cause, tests every fix, and tells you **how many minutes you have left to act**.

> Every other system watches the crush happen. Pravaah tells you forty minutes early, proves why, and tells you how long you have left to stop it.

HackCelestial 3.0 · Team Grid9 · PS-8 Mega-Event Hospitality Orchestration.

No cameras. No sensors. **No AI ever produces a number.** Every figure on screen comes from `simulate()`.

---

## Run it

```bash
npm install
cp .env.example .env.local   # add GROQ_API_KEY (optional; everything works without it)
npm run dev                  # http://localhost:3000, also on your LAN for The Room
npm test                     # engine golden test + analyses (36 tests)
```

Demo on stage: open `/console` on the laptop, and the room QR code works for any phone on the same Wi-Fi. The console finds the laptop's LAN address itself. Set `NEXT_PUBLIC_DEMO_OFFLINE=1` to run with no network at all.

Keyboard shortcuts in the console: `Space` play/pause, `1`–`5` steps, `R` open The Room, `Esc` close.

## What is inside

| Page | What it does |
|---|---|
| `/` | Cover. The hero visual is the engine itself: the do-nothing evening, simulated and timed in your browser. |
| `/console` | The organiser console: **Rehearse → Predict → Explain → Prove → Guide**, with the live map, the Decision Clock, Ravi, the ghost of the do-nothing evening, what-ifs, Red Team, The Room and the Black Box. |
| `/join/[room]` | The Room, on a phone. Marathi, Hindi or English. It buzzes when the control room acts, and your yes or no changes the simulation. |
| `/replay` | 4 June 2025, M. Chinnaswamy Stadium. A respectful reconstruction from public reporting, with sources and assumptions. It shows when a rehearsal would have warned. |
| `/venues` | Any venue in 60 seconds. Cached venues always work offline; live import comes from OpenStreetMap (Nominatim + Overpass). Every derived number is marked estimated and can be edited. |

### The five steps

1. **Rehearse.** Replay the full evening minute by minute: 84,000 people over 540 minutes, simulated in about 10 ms.
2. **Predict.** 60 perturbed runs (seeded mulberry32). "In 56 of 60 runs, the West forecourt gets so tight nobody can move. Most likely 19:12."
3. **Explain.** Remove one cause, re-run, and measure what disappears. Gate routing and Gate 3 capacity *each* remove all 72 dangerous minutes: **a mismatch, not a shortage**.
4. **Prove.** A greedy search over levers across three profiles (181 plans in about 0.6 s). The winner costs **₹0**: tell the Nerul, Seawoods and cab arrivals that Gate 5 is empty. Plans that fail are shown with their simulated result.
5. **Guide.** Orders for crowd, staff, transport and accommodation. Messages in Marathi, Hindi and English, a PA announcement (TTS), and optional SMS. Every number is injected from the approved run.

### What makes it different

- **The Decision Clock.** Each lever's deadline is stress-tested on 12 rough nights, taking the most cautious answer. The live "act now" figure climbs as you wait. At zero, the lever closes, the optimiser re-plans from now, and the console shows what waiting cost.
- **The Room.** Judges scan a QR code and join the crowd. On approval their phones buzz, and their live acceptance rate replaces the model's `p` (`acceptOverride`). The evening re-runs, showing "The room said yes 40%. The model predicted 26%." Each phone then shows what happened to people like them.
- **The Red Team.** The plan is run on 192 bad nights (turnout × rain × rail failure time × late gates × slow lanes), each night twice. It shows where the plan is safe, where it helps, where it is **worse than doing nothing**, and the backup plan for the worst night.
- **Hotels as control valves.** Accommodation, transport and gates live in one simulation. Block-booking the empty Kharghar and Panvel rooms changes the density at a gate kilometres away.
- **The Black Box.** A SHA-256 hash-chained ledger of every forecast, warning, recommendation and approval. It has a "Verify" button and a "Try to tamper" demo.

## The engine

`engine/` is pure TypeScript, with no DOM and no React, and it runs in Node, the browser and a Web Worker.

- `simulate.ts` is a faithful port of the prototype. It is deterministic and minute-by-minute, and models proportional capacity sharing, BPR travel times, spillback at 5.8 people/m², and pulsed train arrivals.
- `ensemble.ts`, `ablation.ts`, `optimise.ts`, `decisionWindow.ts`, `redTeam.ts`, `trace.ts` (Ravi) and `trend.ts` build on it.
- `venueImport/` auto-builds a zone/link graph from a compact venue spec or from OpenStreetMap.

**Golden test.** `scripts/extract-golden.mjs` runs the *prototype's own engine code* (`reference/prototype.html`) in a Node VM and records its outputs. `engine/__tests__/simulate.test.ts` asserts the port matches them exactly: every frame, all three optimiser profiles, the ensemble, ablation, the decision board, Ravi and the what-ifs. New behaviour (The Room, Red Team, rail failure at time T) sits behind opt-in options, so the golden test stays green.

## Where the language model is used (Groq)

It is used only for words:

1. Turning a typed what-if ("what if 20% more people come and it rains?") into a fixed, clamped JSON patch. The label and explanation are then written by us from the validated patch.
2. Re-wording a crowd message for the PA. Numbers are replaced by placeholders before the model sees the text and re-injected afterwards. Any output containing a digit, or a missing or extra placeholder, is rejected.

Without a key, or offline, both fall back to word matching and fixed templates.

## Honest limits

- Forecourt areas, lane counts and path widths are plausible for DY Patil, but not surveyed. Hotel inventory is illustrative; the pattern (full near, empty far) is the point.
- Nudge acceptance parameters are hand-calibrated. The Room is a live, small-sample check on them.
- The model covers arrival; egress is not modelled yet. The engine does not stop entry once a venue is full, which is why the Bengaluru replay deliberately shows no gate-lane plan.
- The Bengaluru page is a reconstruction from public reporting. It is illustrative, not a finding of fact.
- Venue import produces estimated graphs that need a human check. The room-booking lever assumes coaches arrive around the same point before the show as at DY Patil.

See [SOURCE_OF_TRUTH.md](SOURCE_OF_TRUTH.md) for the full specification and rules.
