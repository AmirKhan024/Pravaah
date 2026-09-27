# Pravaah Nugen Domain Alignment Training Dataset

Total Examples: 18
Domain Topics Covered: Gate Capacity Imbalance, Crowd Density, Queue Growth, Spillback, Wrong-Gate Concentration, Transit Surges, Traffic Congestion, Venue Capacity, Hotel Saturation, Alternative Routes, Crowd Redirection, Schedule Changes, Warning Timing, Safe/No-Action Scenarios.

---

## Example 1: gate_capacity_imbalance (ID: pravaah_domain_01)

**INPUT:**
- Event Context: DY Patil Stadium Concert — Peak Ingress (T-45 min)
- Location: Gate 3 Forecourt
- Current Crowd: 4200
- Arrival Rate: 240 persons/min
- Capacity: 120 persons/min
- Queue Size: 850
- Density: 5.9 persons/m² (CRITICAL)
- Transport: Metro arrival surge dropping 1,200 passengers every 5 mins at Nerul

**ANALYSIS:**
- Operational Problem: Severe gate capacity imbalance causing forecourt crowd crush risk
- Bottleneck: Gate 3 security screening lanes under-capacitated relative to incoming arrival rate
- Explanation: Arrival rate of 240 persons/min exceeds Gate 3 screening rate (120/min), accumulating queue at +120 persons/min and pushing density beyond safety threshold (5.8 p/m²).

**ACTION:** Redirect incoming Nerul arrivals from Gate 3 to Gate 5 via PA announcements and dynamic digital signage.
**PRIORITY:** HIGH
**DEADLINE:** 5 minutes
**EXPECTED_EFFECT:** Gate 3 queue accumulation drops to 0/min; density at Gate 3 forecourt reduces from 5.9 to 3.2 p/m² within 8 minutes; Gate 5 operates at 75% capacity.

**STRUCTURED OUTPUT JSON:**
```json
{
  "risk": "Gate 3 Forecourt Crowd Crush",
  "cause": "Arrival rate (240/min) double screening capacity (120/min)",
  "recommended_action": "Redirect incoming attendees to Gate 5",
  "priority": "HIGH",
  "deadline_minutes": 5,
  "expected_effect": "Reduces Gate 3 density to 3.2 p/m² and balances Gate 5 utilization",
  "confidence": 96
}
```

---

## Example 2: gate_capacity_imbalance_safe (ID: pravaah_domain_02)

**INPUT:**
- Event Context: DY Patil Stadium Concert — Early Ingress (T-120 min)
- Location: Gate 3 Forecourt
- Current Crowd: 800
- Arrival Rate: 90 persons/min
- Capacity: 120 persons/min
- Queue Size: 35
- Density: 1.5 persons/m² (NORMAL)
- Transport: Regular train arrivals, no delays

**ANALYSIS:**
- Operational Problem: None. Gate processing is operating with excess capacity.
- Bottleneck: None
- Explanation: Arrival rate (90/min) is below screening capacity (120/min). Queue processing time is under 1.5 minutes.

**ACTION:** NO_ACTION
**PRIORITY:** NONE
**DEADLINE:** 0 minutes
**EXPECTED_EFFECT:** Maintain standard gate operation. No crowd intervention required.

**STRUCTURED OUTPUT JSON:**
```json
{
  "risk": "None - Safe Ingress Flow",
  "cause": "Arrival rate is within screening capacity limits",
  "recommended_action": "Maintain standard monitoring without intervention",
  "priority": "NONE",
  "deadline_minutes": 0,
  "expected_effect": "Stable flow with wait times under 2 minutes",
  "confidence": 98
}
```

---

## Example 3: crowd_density (ID: pravaah_domain_03)

**INPUT:**
- Event Context: DY Patil Stadium Plaza — T-30 min before show start
- Location: Central Concourse Plaza
- Current Crowd: 6800
- Arrival Rate: 310 persons/min
- Capacity: 180 persons/min
- Queue Size: 1400
- Density: 6.4 persons/m² (CRITICAL)
- Transport: Heavy pedestrian inflow from East and West corridors

**ANALYSIS:**
- Operational Problem: Dangerous crowd density exceeding Fruin Level of Service F (6.4 p/m²)
- Bottleneck: Central Plaza bottleneck caused by converging pedestrian streams
- Explanation: Pedestrian inflow from both North and West corridors bottlenecking at Central Plaza while ticket checkpoints operate at maximum capacity.

**ACTION:** Deploy North Bypass Promenade holding zone to divert 35% of Central Plaza inflow.
**PRIORITY:** CRITICAL
**DEADLINE:** 3 minutes
**EXPECTED_EFFECT:** Central Plaza density drops from 6.4 to 4.1 p/m² in 5 minutes; eliminates compression shockwave risks.

**STRUCTURED OUTPUT JSON:**
```json
{
  "risk": "Central Plaza Compression Hazard",
  "cause": "Converging pedestrian streams exceeding 6.0 p/m² threshold",
  "recommended_action": "Activate North Bypass Promenade holding zone and divert 35% inflow",
  "priority": "CRITICAL",
  "deadline_minutes": 3,
  "expected_effect": "Central Plaza density drops from 6.4 to 4.1 p/m²",
  "confidence": 97
}
```

---

## Example 4: crowd_density_safe (ID: pravaah_domain_04)

**INPUT:**
- Event Context: DY Patil Stadium Plaza — T-90 min
- Location: Central Concourse Plaza
- Current Crowd: 2100
- Arrival Rate: 110 persons/min
- Capacity: 180 persons/min
- Queue Size: 120
- Density: 2.2 persons/m² (ADVISORY_LOW)
- Transport: Steady pedestrian movement

**ANALYSIS:**
- Operational Problem: None. Density is well below the 4.5 p/m² warning limit.
- Bottleneck: None
- Explanation: Inflow rate is comfortably handled by plaza width. Free walking space available.

**ACTION:** NO_ACTION
**PRIORITY:** NONE
**DEADLINE:** 0 minutes
**EXPECTED_EFFECT:** Continue routine CCTV plaza monitoring.

**STRUCTURED OUTPUT JSON:**
```json
{
  "risk": "None - Normal Plaza Circulation",
  "cause": "Pedestrian density is within safe limits (2.2 p/m²)",
  "recommended_action": "No intervention needed",
  "priority": "NONE",
  "deadline_minutes": 0,
  "expected_effect": "Smooth circulation maintained",
  "confidence": 99
}
```

---

## Example 5: queue_growth (ID: pravaah_domain_05)

**INPUT:**
- Event Context: Chinnaswamy Stadium — Gate 1 Security Checkpoint
- Location: Gate 1 Outer Security
- Current Crowd: 3900
- Arrival Rate: 280 persons/min
- Capacity: 140 persons/min
- Queue Size: 1150
- Density: 4.8 persons/m² (WARNING)
- Transport: Buses arriving every 3 minutes from MG Road station

**ANALYSIS:**
- Operational Problem: Rapid queue accumulation (+140 persons/min) threatening perimeter containment
- Bottleneck: Screening lane slowdown due to manual bag inspection checks
- Explanation: Manual bag checks at Gate 1 reduced per-lane throughput by 50%, while MG Road bus arrivals continue at peak rate.

**ACTION:** Open 4 auxiliary magnetometer lanes at Gate 1 and divert 30% of queue to Gate 2.
**PRIORITY:** HIGH
**DEADLINE:** 6 minutes
**EXPECTED_EFFECT:** Gate 1 processing capacity increases from 140 to 260 persons/min; queue growth turns negative (-20/min); wait time falls from 18 min to 5 min.

**STRUCTURED OUTPUT JSON:**
```json
{
  "risk": "Perimeter Queue Spillback at Gate 1",
  "cause": "Screening rate (140/min) choked by manual bag inspections",
  "recommended_action": "Open 4 auxiliary lanes at Gate 1 and divert queue portion to Gate 2",
  "priority": "HIGH",
  "deadline_minutes": 6,
  "expected_effect": "Increases processing to 260/min and reduces queue wait to 5 minutes",
  "confidence": 95
}
```

---

## Example 6: queue_growth_safe (ID: pravaah_domain_06)

**INPUT:**
- Event Context: Chinnaswamy Stadium — Gate 1 Outer Security (T-150 min)
- Location: Gate 1 Outer Security
- Current Crowd: 500
- Arrival Rate: 60 persons/min
- Capacity: 140 persons/min
- Queue Size: 20
- Density: 1.2 persons/m² (NORMAL)
- Transport: Light traffic on Cubbon Road

**ANALYSIS:**
- Operational Problem: None. Inflow is less than half of gate screening capacity.
- Bottleneck: None
- Explanation: Queue clears within 30 seconds of attendee arrival.

**ACTION:** NO_ACTION
**PRIORITY:** NONE
**DEADLINE:** 0 minutes
**EXPECTED_EFFECT:** Maintain open lanes without staffing adjustments.

**STRUCTURED OUTPUT JSON:**
```json
{
  "risk": "None - Zero Queue Accumulation",
  "cause": "Screening capacity exceeds arrival rate",
  "recommended_action": "No action required",
  "priority": "NONE",
  "deadline_minutes": 0,
  "expected_effect": "Queue stays minimal",
  "confidence": 99
}
```

---

## Example 7: spillback (ID: pravaah_domain_07)

**INPUT:**
- Event Context: DY Patil Stadium — West Arterial Highway Junction
- Location: Gate 1 Approach Road
- Current Crowd: 5400
- Arrival Rate: 320 persons/min
- Capacity: 150 persons/min
- Queue Size: 1600
- Density: 5.2 persons/m² (DANGER)
- Transport: Queue spilling back 180 meters onto active bus transit lane

**ANALYSIS:**
- Operational Problem: Critical queue spillback obstructing primary emergency vehicle corridor
- Bottleneck: Gate 1 tailback extending past highway barrier line
- Explanation: Excess queue accumulation at Gate 1 has spilled back 180 meters, blocking the designated ambulance and shuttle lane on the approach road.

**ACTION:** Enforce immediate temporary holding pen at Nerul Plaza and re-route Gate 1 spillback attendees to Gate 4 Express Entry.
**PRIORITY:** CRITICAL
**DEADLINE:** 4 minutes
**EXPECTED_EFFECT:** Clears emergency vehicle transit lane within 7 minutes; reduces Gate 1 tailback by 120 meters.

**STRUCTURED OUTPUT JSON:**
```json
{
  "risk": "Emergency Highway Lane Blockade via Queue Spillback",
  "cause": "Gate 1 queue spilling 180m back into active roadway",
  "recommended_action": "Activate Nerul holding pen and reroute queue tail to Gate 4 Express Entry",
  "priority": "CRITICAL",
  "deadline_minutes": 4,
  "expected_effect": "Emergency corridor cleared in 7 mins; tailback reduced by 120m",
  "confidence": 97
}
```

---

## Example 8: spillback_safe (ID: pravaah_domain_08)

**INPUT:**
- Event Context: DY Patil Stadium — West Approach Road (T-100 min)
- Location: Gate 1 Approach Road
- Current Crowd: 1200
- Arrival Rate: 100 persons/min
- Capacity: 150 persons/min
- Queue Size: 80
- Density: 1.9 persons/m² (NORMAL)
- Transport: Pedestrians stay inside designated footpaths

**ANALYSIS:**
- Operational Problem: None. Queue is strictly contained within barricaded holding lines.
- Bottleneck: None
- Explanation: Queue length is 15 meters, well clear of roadway.

**ACTION:** NO_ACTION
**PRIORITY:** NONE
**DEADLINE:** 0 minutes
**EXPECTED_EFFECT:** Keep current barricade layout.

**STRUCTURED OUTPUT JSON:**
```json
{
  "risk": "None - Contained Queue Line",
  "cause": "Queue does not extend into transit lanes",
  "recommended_action": "Maintain standard protocol",
  "priority": "NONE",
  "deadline_minutes": 0,
  "expected_effect": "Roadway remains clear",
  "confidence": 98
}
```

---

## Example 9: wrong_gate_concentration (ID: pravaah_domain_09)

**INPUT:**
- Event Context: DY Patil Stadium — Train Arrival Peak (T-60 min)
- Location: Gate 1 North Forecourt
- Current Crowd: 5100
- Arrival Rate: 350 persons/min
- Capacity: 140 persons/min
- Queue Size: 1350
- Density: 5.6 persons/m² (WARNING)
- Transport: 75% of incoming train passengers walking directly to Gate 1 due to outdated signage

**ANALYSIS:**
- Operational Problem: 75% crowd concentration at Gate 1 despite Gates 4 & 5 being under-utilized
- Bottleneck: Pedestrian navigation error; attendees using default station-facing gate
- Explanation: Railway passengers naturally exit toward the closest visible gate (Gate 1) without realizing ticket category applies to all North & East gates.

**ACTION:** Send targeted geo-fenced SMS/app notifications to Nerul rail cohorts directing them to Gates 4 & 5; update station LED displays.
**PRIORITY:** HIGH
**DEADLINE:** 7 minutes
**EXPECTED_EFFECT:** Re-balances inflow split from 75/15/10 to 40/35/25 across Gates 1, 4, and 5; Gate 1 wait drops from 22 min to 7 min.

**STRUCTURED OUTPUT JSON:**
```json
{
  "risk": "Severe Ingress Concentration at Gate 1",
  "cause": "75% of rail attendees funneling to Gate 1 due to station proximity",
  "recommended_action": "Issue geo-fenced SMS nudges & station LED updates directing attendees to Gates 4 & 5",
  "priority": "HIGH",
  "deadline_minutes": 7,
  "expected_effect": "Inflow re-balanced across gates; Gate 1 wait drops to 7 minutes",
  "confidence": 96
}
```

---

## Example 10: railway_metro_surge (ID: pravaah_domain_10)

**INPUT:**
- Event Context: DY Patil Stadium — Suburban Rail Peak Pulse
- Location: Nerul Railway Station Exit Plaza
- Current Crowd: 4800
- Arrival Rate: 450 persons/min
- Capacity: 200 persons/min
- Queue Size: 980
- Density: 5.1 persons/m² (WARNING)
- Transport: Special event trains arriving at 6-minute intervals dropping 3,200 riders per train

**ANALYSIS:**
- Operational Problem: Pulsed train arrival surge overpowering station exit concourse
- Bottleneck: Station turnstiles and exit footbridge width
- Explanation: Train arrivals every 6 minutes deliver 3,200 passengers into a station concourse designed for 1,200/min sustained flow, causing rapid pressure spikes.

**ACTION:** Implement 3-minute pulsed holding gates at train platforms; divert 25% of crowd to Juinagar Shuttle Corridor.
**PRIORITY:** HIGH
**DEADLINE:** 5 minutes
**EXPECTED_EFFECT:** Smooths out peak surge spikes into steady 180 person/min batches; eliminates platform exit stampede risks.

**STRUCTURED OUTPUT JSON:**
```json
{
  "risk": "Station Exit Overcrowding during Rail Surges",
  "cause": "Pulsed arrivals delivering 3,200 passengers every 6 minutes",
  "recommended_action": "Institute 3-minute platform holding releases & divert portion to Juinagar shuttle",
  "priority": "HIGH",
  "deadline_minutes": 5,
  "expected_effect": "Surge spikes smoothed to 180 p/min manageable batch flow",
  "confidence": 94
}
```

---

## Example 11: road_parking_congestion (ID: pravaah_domain_11)

**INPUT:**
- Event Context: DY Patil Stadium — Sector 7 Parking Hub
- Location: Parking Lot B & C Feeder Road
- Current Crowd: 2900
- Arrival Rate: 180 persons/min
- Capacity: 90 persons/min
- Queue Size: 620
- Density: 3.8 persons/m² (ADVISORY_HIGH)
- Transport: Cab drop-offs double-parked on main feeder street, blocking shuttle movement

**ANALYSIS:**
- Operational Problem: Vehicle gridlock on feeder road delaying crowd shuttle turnaround by +25 mins
- Bottleneck: Unauthorized ride-share drop-offs on single-lane access road
- Explanation: Ride-share drivers stopping directly outside Lot B entrance instead of using designated drop-off hub 400m back.

**ACTION:** Activate traffic police diversion at Sector 7 junction; redirect all ride-share drop-offs to Seawoods Grand Central Hub.
**PRIORITY:** MEDIUM
**DEADLINE:** 10 minutes
**EXPECTED_EFFECT:** Feeder road vehicle throughput increases by 60%; shuttle cycle time restored to 12 minutes.

**STRUCTURED OUTPUT JSON:**
```json
{
  "risk": "Shuttle Gridlock via Unauthorized Roadside Drop-offs",
  "cause": "Ride-share vehicles blocking single-lane shuttle feeder road",
  "recommended_action": "Redirect ride-share drop-offs to Seawoods Hub & enforce clearway",
  "priority": "MEDIUM",
  "deadline_minutes": 10,
  "expected_effect": "Restores shuttle cycle time to 12 mins and clears feeder road",
  "confidence": 93
}
```

---

## Example 12: venue_capacity (ID: pravaah_domain_12)

**INPUT:**
- Event Context: DY Patil Stadium — Stand B Upper Tier
- Location: Stand B Concourse & Gates 12-14
- Current Crowd: 14200
- Arrival Rate: 160 persons/min
- Capacity: 80 persons/min
- Queue Size: 950
- Density: 5.8 persons/m² (CRITICAL)
- Transport: Internal stairwells congested, Stand B at 96% occupancy

**ANALYSIS:**
- Operational Problem: Stand B reaching physical seating limit (96%) with 950 attendees in stairwell queue
- Bottleneck: Stairwell entrance turnstiles into Stand B
- Explanation: Unreserved ticket holders crowding Stand B due to direct sightline preference, leaving Stand C under-filled.

**ACTION:** Close Stand B entry turnstiles; redirect remaining unseated attendees to Stand C East Tier via venue stewards.
**PRIORITY:** HIGH
**DEADLINE:** 4 minutes
**EXPECTED_EFFECT:** Prevents Stand B aisle blocking; fills Stand C to 85%; clears stairwell bottleneck in 6 minutes.

**STRUCTURED OUTPUT JSON:**
```json
{
  "risk": "Stand B Seating Saturation & Stairwell Blockade",
  "cause": "Stand B at 96% capacity with 950 queued in stairwell",
  "recommended_action": "Close Stand B turnstiles and redirect unseated attendees to Stand C",
  "priority": "HIGH",
  "deadline_minutes": 4,
  "expected_effect": "Clears stairwell in 6 mins; balances occupancy across Stand C",
  "confidence": 95
}
```

---

## Example 13: hotel_accommodation_saturation (ID: pravaah_domain_13)

**INPUT:**
- Event Context: Multi-Day Mega Event — Overnight Stay Planning (Day 1 Evening)
- Location: Belapur & Nerul Hotel District
- Current Crowd: 18500
- Arrival Rate: 400 persons/min
- Capacity: 0 persons/min
- Queue Size: 0
- Density: N/A
- Transport: Belapur hotels at 98% occupancy; Kharghar/Panvel hotels at 22% occupancy

**ANALYSIS:**
- Operational Problem: Severe local hotel saturation in Belapur forcing late arriving visitors to roam streets
- Bottleneck: Hotel room availability within 2km radius
- Explanation: Visitors concentrating in nearest Belapur/Nerul hotels without visibility into 10,000 vacant rooms in Kharghar and Panvel.

**ACTION:** Trigger Pravaah Accommodation Valve: push room booking vouchers and direct shuttle transport options for Kharghar & Panvel hotels.
**PRIORITY:** MEDIUM
**DEADLINE:** 20 minutes
**EXPECTED_EFFECT:** Diverts 3,500 overnight visitors to Kharghar/Panvel; relieves Belapur street crowding after 22:00.

**STRUCTURED OUTPUT JSON:**
```json
{
  "risk": "Overnight Visitor Stranding in Saturation Zones",
  "cause": "Belapur hotels at 98% while Kharghar/Panvel hotels are 78% empty",
  "recommended_action": "Activate Accommodation Valve nudges offering Kharghar/Panvel rooms + shuttles",
  "priority": "MEDIUM",
  "deadline_minutes": 20,
  "expected_effect": "Fills 3,500 vacant rooms in Kharghar/Panvel; clears Belapur street congestion",
  "confidence": 92
}
```

---

## Example 14: alternative_routes (ID: pravaah_domain_14)

**INPUT:**
- Event Context: DY Patil Stadium — Main Footbridge Crossing
- Location: West Promenade Overpass
- Current Crowd: 3800
- Arrival Rate: 210 persons/min
- Capacity: 110 persons/min
- Queue Size: 720
- Density: 5.3 persons/m² (DANGER)
- Transport: Narrow bridge width causing bidirectional pedestrian friction

**ANALYSIS:**
- Operational Problem: Bidirectional pedestrian congestion on narrow overpass creating crushing risk
- Bottleneck: West Promenade Overpass bottleneck
- Explanation: Two opposing crowd streams (entering vs exiting food courts) trying to cross 4-meter wide bridge simultaneously.

**ACTION:** Convert Overpass to one-way westbound flow; redirect eastbound crowd to South Ground-Level Plaza Path.
**PRIORITY:** HIGH
**DEADLINE:** 4 minutes
**EXPECTED_EFFECT:** Eliminates counter-flow friction; increases bridge throughput to 220 p/min; drops density to 3.0 p/m².

**STRUCTURED OUTPUT JSON:**
```json
{
  "risk": "Bidirectional Overpass Crush Hazard",
  "cause": "Opposing crowd streams bottlenecking on 4-meter bridge",
  "recommended_action": "Make Overpass one-way and divert eastbound flow to South Plaza Path",
  "priority": "HIGH",
  "deadline_minutes": 4,
  "expected_effect": "Eliminates counter-flow and drops density to 3.0 p/m²",
  "confidence": 96
}
```

---

## Example 15: crowd_redirection (ID: pravaah_domain_15)

**INPUT:**
- Event Context: DY Patil Stadium — Post-Show Egress Phase
- Location: Gate 2 Main Egress Corridor
- Current Crowd: 9200
- Arrival Rate: 520 persons/min
- Capacity: 300 persons/min
- Queue Size: 1800
- Density: 5.7 persons/m² (CRITICAL)
- Transport: Gate 2 egress clogged; Gate 6 egress completely clear

**ANALYSIS:**
- Operational Problem: Mass egress bottlenecking at Gate 2 while Gate 6 sits empty
- Bottleneck: Gate 2 exit turnstiles
- Explanation: Attendees exiting via the same gate they entered (Gate 2) due to habit, unaware that Gate 6 leads directly to the same train station.

**ACTION:** Broadcast high-decibel PA announcement in English, Hindi, and Marathi directing attendees to Gate 6 South Exit for faster train access.
**PRIORITY:** HIGH
**DEADLINE:** 3 minutes
**EXPECTED_EFFECT:** Diverts 45% of exiting crowd to Gate 6; clears Gate 2 concourse 10 minutes faster.

**STRUCTURED OUTPUT JSON:**
```json
{
  "risk": "Post-Show Egress Stampede Risk at Gate 2",
  "cause": "Habitual egress via Gate 2 leaving Gate 6 unutilized",
  "recommended_action": "Broadcast multilingual PA announcements directing crowd to Gate 6",
  "priority": "HIGH",
  "deadline_minutes": 3,
  "expected_effect": "Diverts 45% egress to Gate 6 and clears concourse 10 mins faster",
  "confidence": 97
}
```

---

## Example 16: event_schedule_changes (ID: pravaah_domain_16)

**INPUT:**
- Event Context: DY Patil Stadium — Main Artist Delay Notification
- Location: Outer Gates & Security Perimeter
- Current Crowd: 12500
- Arrival Rate: 380 persons/min
- Capacity: 200 persons/min
- Queue Size: 2100
- Density: 4.9 persons/m² (WARNING)
- Transport: Main show start delayed by 45 minutes due to technical setup

**ANALYSIS:**
- Operational Problem: Gate crowding caused by premature attendee arrival before revised show start
- Bottleneck: Security gates holding incoming crowd
- Explanation: Attendees rushing gates expecting 19:00 start, creating premature pressure spike when show start is pushed to 19:45.

**ACTION:** Announce 45-minute show delay over venue screens & app; activate Outer Fan Zone food stalls with live music to hold attendees outside gates.
**PRIORITY:** MEDIUM
**DEADLINE:** 8 minutes
**EXPECTED_EFFECT:** Spreads arrival peak across 45 additional minutes; reduces gate queue size from 2,100 to 600.

**STRUCTURED OUTPUT JSON:**
```json
{
  "risk": "Premature Gate Crowding due to Unannounced Show Delay",
  "cause": "Show delayed 45 mins; attendees rushing gates prematurely",
  "recommended_action": "Announce delay & activate Outer Fan Zone food/music stalls to buffer crowd",
  "priority": "MEDIUM",
  "deadline_minutes": 8,
  "expected_effect": "Spreads arrival peak and reduces gate queue by 70%",
  "confidence": 94
}
```

---

## Example 17: warning_timing (ID: pravaah_domain_17)

**INPUT:**
- Event Context: DY Patil Stadium — Impending Ingress Spike (T-50 min)
- Location: Gate 3 Forecourt
- Current Crowd: 3100
- Arrival Rate: 190 persons/min
- Capacity: 120 persons/min
- Queue Size: 420
- Density: 3.6 persons/m² (ADVISORY_HIGH)
- Transport: 3 upcoming trains scheduled to arrive simultaneously in 8 minutes

**ANALYSIS:**
- Operational Problem: Predicted density surge in 8 minutes when 3 trains disembark simultaneously
- Bottleneck: Imminent Gate 3 screening bottleneck
- Explanation: Current density (3.6 p/m²) is manageable now, but scheduled train arrivals will push density past 6.0 p/m² within 8 minutes if no action is taken NOW.

**ACTION:** Pre-emptively open 3 additional screening lanes at Gate 3 and position station marshals BEFORE train arrival.
**PRIORITY:** HIGH
**DEADLINE:** 5 minutes
**EXPECTED_EFFECT:** Prevents predicted 6.0 p/m² crush peak; maintains peak density below 3.8 p/m² upon train arrival.

**STRUCTURED OUTPUT JSON:**
```json
{
  "risk": "Imminent Crowd Crush Surge in 8 Minutes",
  "cause": "Simultaneous 3-train arrival scheduled to drop 4,000 passengers",
  "recommended_action": "Pre-emptively open 3 extra lanes at Gate 3 & deploy marshals before trains dock",
  "priority": "HIGH",
  "deadline_minutes": 5,
  "expected_effect": "Prevents predicted crush spike; caps density at safe 3.8 p/m²",
  "confidence": 96
}
```

---

## Example 18: no_action_safe (ID: pravaah_domain_18)

**INPUT:**
- Event Context: DY Patil Stadium — Mid Event Steady State
- Location: All Perimeter Gates & Plazas
- Current Crowd: 1500
- Arrival Rate: 40 persons/min
- Capacity: 150 persons/min
- Queue Size: 10
- Density: 1.1 persons/m² (NORMAL)
- Transport: Normal traffic, public transport running on schedule

**ANALYSIS:**
- Operational Problem: None. Ingress complete; steady state operations.
- Bottleneck: None
- Explanation: All gates operating well below capacity. Pedestrian density is minimal.

**ACTION:** NO_ACTION
**PRIORITY:** NONE
**DEADLINE:** 0 minutes
**EXPECTED_EFFECT:** Maintain standard monitoring. No operational changes.

**STRUCTURED OUTPUT JSON:**
```json
{
  "risk": "None - Normal Steady State",
  "cause": "Ingress complete; flow is calm and stable",
  "recommended_action": "Maintain routine monitoring",
  "priority": "NONE",
  "deadline_minutes": 0,
  "expected_effect": "Operations proceed normally without intervention",
  "confidence": 99
}
```

---

