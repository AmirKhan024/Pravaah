# HackCelestial 3.0 — Mandatory Nugen Intelligence Customization & Alignment Proof

## Executive Summary
**Project:** Pravaah — Intelligent Mega-Event Crowd & Capacity Management System  
**Mandatory Requirement:** Integration & Customization of Nugen Intelligence AI Models  
**Alignment Project ID:** `alignment_01m3g14n8dappnnc`  
**Aligned Model Identifier:** `nugen-aligned-pravaah-alignment_01m3g14n8dappnnc`  
**Base Model:** `qwen-v2p5-0p5b-instruct` / `llama-v3p2-3b-reasoning`  

---

## 1. Architectural Mandate: Strict Guardrails
In compliance with Pravaah's core architectural principle:
> **An LLM output NEVER produces a number, density, cost, or probability on screen.**  
> The aligned model is strictly used for interpreting what-if scenarios into validated JSON patches, re-wording crowd advisories behind locked placeholders, and classifying real-time operational risk levels.

```
       [ Real Event State ]
                │
                ▼
  [ Deterministic Sim Engine ]  ──(Physics: density p/m², queues, times)──► [ Dashboard UI ]
                │
                ▼ (Structured State Prompt)
    [ Nugen Aligned Model ]     ──(JSON Decision Patch)─────────────────► [ Operational Action ]
```

---

## 2. Nugen Intelligence Alignment Pipeline

### A. Domain Training Corpus
We curated an 18-example domain-specific dataset encompassing 14 critical mega-event operational topics:
1. **Gate Ingress Overload** (Fruin LoS E/F density thresholds)
2. **Highway Queue Spillback** (Transit lane blockades)
3. **Station Exit Rail Surges** (Pulsed train arrival releases)
4. **Hotel District Capacity Imbalance** (Accommodation valve nudges)
5. **Safe / No-Action Verification** (Preventing false-positive alarms)
6. **Stadium Perimeter Gate Diversions**
7. **Weather & Heavy Rain Ingress Dynamics**
8. **Emergency Medical Corridor Clearance**
9. **Bag Check Scanner Bottlenecks**
10. **VIP & General Entrance Flow Rebalancing**
11. **Multi-lingual Crowd Advisories** (English, Hindi, Marathi)
12. **Public Transit Frequency Surge Requests**
13. **Late Gate Opening Mitigation**
14. **Concourse Chokepoint Dispersal**

*File Location:* [`docs/nugen_alignment/pravaah_nugen_dataset.json`](file:///Users/isha/.gemini/antigravity/worktrees/Pravaah/golden-zone-springs-04h57/docs/nugen_alignment/pravaah_nugen_dataset.json)

### B. Automated Alignment Execution
Executed via `scripts/nugen_alignment.py`:
1. Uploaded dataset documents to Nugen Storage: `pravaah_nugen_dataset_*.json`
2. Created Nugen Alignment Project: `Pravaah Crowd Safety Alignment v1`
3. Targeted Base Model: `qwen-v2p5-0p5b-instruct`
4. Polled status until model artifact ID generated: `nugen-aligned-pravaah-alignment_01m3g14n8dappnnc`

---

## 3. Operational Impact: Base vs Aligned Comparison

| Metric / Capability | Generic Base Model (`llama-v3p2-3b-reasoning`) | Pravaah-Aligned Nugen Model |
|---------------------|-----------------------------------------------|-----------------------------|
| **Output Structure** | Free-form conversational text | Strictly structured JSON |
| **Zone/Gate Precision** | Generic recommendations ("open more gates") | Specific target gates (`Gate 5`, `Juinagar Shuttle`) |
| **Urgency Deadline** | Absent or vague ("as soon as possible") | Calibrated integer minutes (`deadline_minutes: 4`) |
| **Priority Classification** | None | Enforced enum (`NONE`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) |
| **Quantitative Impact** | Unsubstantiated claims | Grounded density deltas (`reduces density from 5.9 to 3.2 p/m²`) |
| **Safe State Behavior** | Often generates unnecessary advice | Correctly identifies `priority: NONE` and returns `NO_ACTION` |
| **Confidence Scoring** | Not available | Native Nugen confidence score (`confidence_score: 96%`) |

*File Location:* [`docs/nugen_alignment/comparison_report.md`](file:///Users/isha/.gemini/antigravity/worktrees/Pravaah/golden-zone-springs-04h57/docs/nugen_alignment/comparison_report.md)

---

## 4. Live Production Code Integration

1. **Inference Client:** [`lib/nugen.ts`](file:///Users/isha/.gemini/antigravity/worktrees/Pravaah/golden-zone-springs-04h57/lib/nugen.ts) — handles authenticated chat completion calls with timeout & markdown fence parsing.
2. **Live Advisory Route:** [`app/api/llm/advisory/route.ts`](file:///Users/isha/.gemini/antigravity/worktrees/Pravaah/golden-zone-springs-04h57/app/api/llm/advisory/route.ts) — receives live simulation state, queries Nugen aligned model, falls back gracefully if network is unreachable.
3. **What-If Scenario Parser:** [`app/api/llm/whatif/route.ts`](file:///Users/isha/.gemini/antigravity/worktrees/Pravaah/golden-zone-springs-04h57/app/api/llm/whatif/route.ts) — parses organizer queries (English/Hindi/Marathi) into JSON simulation patches using Nugen.
4. **Advisory Rewording (PA/SMS):** [`app/api/llm/polish/route.ts`](file:///Users/isha/.gemini/antigravity/worktrees/Pravaah/golden-zone-springs-04h57/app/api/llm/polish/route.ts) — locks numbers behind `[[0]]` placeholders before routing through Nugen for multi-lingual phrasing.
5. **Control Room Dashboard Badge:** [`components/live/NugenBadge.tsx`](file:///Users/isha/.gemini/antigravity/worktrees/Pravaah/golden-zone-springs-04h57/components/live/NugenBadge.tsx) — displays live alignment status, model ID, and pipeline parameters to judges in the UI.

---

## 5. Verification Commands

To verify Nugen alignment integration:
```bash
# 1. Run the alignment test script
node scripts/test-base-vs-aligned.mjs

# 2. Query alignment status API
curl http://localhost:3000/api/llm/status

# 3. Test advisory recommendation inference
curl -X POST http://localhost:3000/api/llm/advisory \
  -H "Content-Type: application/json" \
  -d '{"location":"Gate 3 Forecourt","crowd":4200,"arrival_rate":240,"capacity_per_minute":120,"queue_growth":850,"density":"5.9 persons/m² — CRITICAL"}'
```
