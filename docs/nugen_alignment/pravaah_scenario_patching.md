# Pravaah Scenario Patching & Multilingual Training Corpus

## Overview
This document contains domain training pairs and alignment directives for interpreting organizer scenario questions into Pravaah simulation parameters.

### Domain Rules:
1. "turnoutPct": Represents percentage increase or decrease in attendees.
   - "20% more people" -> 20
   - "15% fewer people" -> -15
   - "heavy crowd" / "lots of extra people" -> 12
   - "small crowd" -> -10
2. "rain":
   - "what if it rains" / "heavy rainfall" / "पाऊस पडला तर" / "बारिश हो जाए तो" -> true
3. "railFailAt":
   - "train line stops at 7 pm" / "Churchgate trains halt at 19:30" / "लोकल 6:30 वाजता बंद पडली" -> "19:00", "19:30", "18:30"
4. "gatesLateMin":
   - "gates open 30 minutes late" / "गेट अर्धा तास उशिरा उघडले" -> 30
5. "showDelayMin":
   - "match starts 45 minutes late" / "concert delayed by an hour" -> 45, 60
6. "slowLanes":
   - "slow bag checks" / "security scanner breakdown" / "तपासणी संथ झाली" / "बैग चेकिंग धीमी हो गई" -> true

### Verified Domain Examples:

#### Example 1 (Ingress surge + rain):
Query: "What if 25% extra visitors show up and heavy rain begins at the stadium?"
Output:
```json
{
  "rain": true,
  "railFailAt": null,
  "showDelayMin": 0,
  "gatesLateMin": 0,
  "turnoutPct": 25,
  "slowLanes": false,
  "understood": true
}
```

#### Example 2 (Marathi - Transit Breakdown & Gate Delay):
Query: "रेल्वे संध्याकाळी 7 वाजता बंद पडली आणि गेट 20 मिनिटे उशिरा उघडले तर काय होईल?"
Output:
```json
{
  "rain": false,
  "railFailAt": "19:00",
  "showDelayMin": 0,
  "gatesLateMin": 20,
  "turnoutPct": 0,
  "slowLanes": false,
  "understood": true
}
```

#### Example 3 (Hindi - Slow Security Screening):
Query: "अगर बैग चेकिंग बहुत धीमी गति से हो रही हो और मैच आधा घंटा देरी से शुरू हो?"
Output:
```json
{
  "rain": false,
  "railFailAt": null,
  "showDelayMin": 30,
  "gatesLateMin": 0,
  "turnoutPct": 0,
  "slowLanes": true,
  "understood": true
}
```

#### Example 4 (Out of Domain):
Query: "Who won the cricket match yesterday?"
Output:
```json
{
  "rain": false,
  "railFailAt": null,
  "showDelayMin": 0,
  "gatesLateMin": 0,
  "turnoutPct": 0,
  "slowLanes": false,
  "understood": false
}
```
