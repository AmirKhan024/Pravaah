# The 5-minute demo: what to click

This is for the team presenting on stage. Run `npm run dev` on the demo laptop, connect it and the audience to the same Wi-Fi, and open `http://localhost:3000/console` on the projector. Rehearse it 15 times. Record a backup video.

| Time | Say | Do |
|---|---|---|
| 0:00 | "4 June 2025. Eleven people died outside a stadium in Bengaluru. The crowd was not violent. It arrived faster than the gates could take it." Pause. | Cover page (`/`). The visual behind you is the engine, running live. |
| 0:30 | "You're in the crowd tonight." | Press **R** (or *The Room*). QR code full-screen. Wait for about 10 phones to join. Close it with **Esc**. |
| 0:45 | "Pravaah rehearses the evening before anyone leaves home." | **Rehearse the evening**. Let it play, or use *Skip to the warning*. |
| 1:00 | "The map is calm. 0.2 people per square metre. Pravaah ran it sixty times: 93% end in a crush at the West forecourt, most likely 19:12." | Step 2 opens by itself. Point at the **Decision Clock**: it is ticking, with the live "act now" number. |
| 1:45 | "Remove one cause, re-run the evening. Two different causes each explain every dangerous minute. Mismatch, not shortage." | **Why does it break?** |
| 2:15 | "We tried 181 plans. Here are the ones that fail, with proof. The winner costs ₹0." | **Find the fix**. Show *Fixes that look right, but fail*, then the cost-of-waiting line. |
| 2:45 | "Approve." | **Approve "Zero rupees"**. Then *Open the room*, **Send the plan's message**. Phones buzz. Judges vote. **Run the evening with the room**: "The room said yes X%. The model predicted Y%." Ravi walks in. |
| 3:30 | "We tried to break our own plan." | **Red team this plan**. "Safe on N of 192. Here's the one night it's worse than doing nothing, and the backup." |
| 4:00 | "Name a venue." | `/venues`: type the venue a judge names, or open Pillai campus (cached). |
| 4:30 | "Every forecast and approval is sealed in the Black Box." | *Black Box* → **Verify** → **Try to tamper** (it catches the change). Close: "Same 84,000 people. Same stadium. Same evening. Different decisions." |

**Fallbacks**
- No network: set `NEXT_PUBLIC_DEMO_OFFLINE=1`. The map draws on ink with no tiles. The Room runs as a simulation on the laptop. What-ifs use word matching.
- Phones won't connect: in The Room, **Simulate 24 phones** (fake phones vote with the model's own probability).
- Running late: the live clock speed is bottom right (*Real time / 15× / 60×*). If the clock hits zero, that is a feature: "waiting turned a free fix into one that costs ₹99,413."
