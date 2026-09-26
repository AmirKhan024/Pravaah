# Pravaah Domain Corpus: Large-Scale Event Crowd Dynamics & Safety Mitigation Protocols

## 1. Domain Background & Regulatory Foundations
Pravaah is a real-time event crowd platform built to predict, detect, and mitigate dangerous crowd density surges, crushing hazards, and gate bottlenecks for mega-events (stadiums, festivals, cultural gatherings).
The domain logic conforms to:
- NDMA (National Disaster Management Authority) Guidelines on Crowd Management.
- Fruin's Level of Service (LoS) for Pedestrian Dynamics (LoS A through LoS F).
- IS 14435: Code of Practice for Fire and Life Safety in Event Venues.

## 2. Density Thresholds & Intervention Actions
Crowd density is strictly measured in persons per square meter (persons/m²):
- Normal Free Flow (< 2.0 persons/m²): Pedestrians move freely. Normal gate intake flow.
- Advisory Level (2.0 – 3.5 persons/m²): Bi-directional friction begins. Initiate voluntary diversion nudges via mobile/SMS and early transport arrival discounts.
- Warning Level (3.5 – 4.5 persons/m²): Critical density warning. Mandatory turnstile throttling at primary gates; open secondary and perimeter holding zones; dispatch marshals to choke corridors.
- Dangerous Crush Danger (> 4.5 persons/m²): Shockwaves develop. Immediate total ingress freeze at exterior gates for 7–10 minute cooling intervals. Enforce circular one-way dispersal corridors.

## 3. Chokepoint & Gate Relief Protocols
- Gate Re-routing Threshold: When queue wait times at a primary gate exceed 12 minutes while adjacent gates have wait times < 4 minutes, dynamic messaging must redirect at least 35%–40% of oncoming ingress to the quieter gate.
- Transit Line Bottlenecks: When a train or metro station feeds > 5,000 visitors per 15 minutes, holding pens at transit exits must stage releases in 3-minute pulses.
- Bag Check & Screening Delays: When screening throughput drops by > 15% (slow lanes), auxiliary magnetometer lanes must be brought online within 10 minutes.

## 4. Pravaah What-If Scenario Conversion Rules
The AI model's role in Pravaah is strictly to convert natural language queries from event organizers into structured JSON scenario patches for the deterministic simulation engine.
The output MUST strictly match:
```json
{
  "rain": boolean,
  "railFailAt": "HH:MM" or null,
  "showDelayMin": integer (0 to 90),
  "gatesLateMin": integer (0 to 180),
  "turnoutPct": integer (-30 to 30),
  "slowLanes": boolean,
  "understood": boolean
}
```
Rules:
- Understood: If the organizer asks about crowd surges, weather, gate delays, transit line breakdowns, slow bag checks, or show timing, `understood` is true. If unrelated, `understood` is false.
- Multilingual Support: Process inputs seamlessly in English, Hindi, and Marathi.
- LLM Output Isolation: The AI NEVER estimates or outputs density numbers, victim counts, or probabilities. The AI only outputs the structured scenario patch; the Pravaah physics engine computes all physical numbers.

## 5. Multilingual Crowd Guidance & Messaging Protocols
Crowd announcements (PA / SMS / Whatsapp) must follow psychological safety tenets:
- Calm, direct, actionable instructions (maximum 2 sentences).
- Strictly preserve all variable tokens [[0]], [[1]] for times and locations computed by the engine.
- Avoid panic-inducing terms (e.g. "stampede", "chaos", "rush"). Use neutral terms (e.g. "quieter gate", "smoother entry", "holding area").
- Languages:
  - English: Professional, clear, concise.
  - Marathi: Calm, respectful (नम्र, स्पष्ट सूचना).
  - Hindi: Courteous, instructive (सरल, शांत और स्पष्ट निर्देश).
