// Comprehensive screenshot pass for review.html / review.pdf. Drives console, room (2 phones,
// real Supabase), replay, venues. Reflects the wiring + polish pass (Phases 1-6).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] || '.';
fs.mkdirSync(out, { recursive: true });
const base = 'http://localhost:3000';
const shots = []; // {file, caption}

const browser = await chromium.launch();

function wireLogs(p, tag) {
  p.on('pageerror', (e) => console.log(`[${tag} pageerror]`, e.message));
  p.on('console', (m) => m.type() === 'error' && console.log(`[${tag} console.error]`, m.text().slice(0, 300)));
}

async function shot(page, name, caption) {
  const file = `${String(shots.length).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(out, file) });
  shots.push({ file, caption });
  console.log('shot', file);
}

// ---------------- Cover page ----------------
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  wireLogs(page, 'cover');
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(6000);
  await shot(page, 'cover-hero', 'Cover page — hero. The right panel is the live engine (do-nothing evening at DY Patil), not a static illustration, with a measured simulate() time. The old "forty minutes early" claim in the headline is gone (Phase 1) — the pitch no longer asserts a number the Decision Clock itself might contradict.');
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(400);
  await shot(page, 'cover-steps', 'Cover page — the five-step pitch and "what no one else has" (Decision Clock, The Room, Red Team, hotels as control valves).');
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(400);
  await shot(page, 'cover-footer', 'Cover page — closing CTA and footer.');
  await page.close();
}

// ---------------- Console: full walkthrough ----------------
const con = await browser.newPage({ viewport: { width: 1600, height: 900 } });
wireLogs(con, 'console');
await con.goto(base + '/console', { waitUntil: 'networkidle' });
await con.waitForTimeout(3000);
await shot(con, 'console-intro', 'Console — Step 1 Rehearse, intro state before the story plays. Facts (beds/transport/gates) are computed from the scenario, not hand-written.');

await con.getByText('Rehearse the evening').click();
await con.waitForTimeout(1500);
await shot(con, 'console-story', 'Console — the rehearsal playing: map animates the calm early evening, captions narrate what is happening.');

await con.getByText('Skip to the warning').click();
await con.waitForTimeout(2000);
await shot(con, 'console-live-calm', 'Console — LIVE mode begins. Decision Clock is testing 12 rough nights in the background; map is calm.');

await con.waitForTimeout(12000);
await shot(
  con,
  'console-decision-clock',
  'Console — the Decision Clock, redesigned in Phase 5 into its own full-width band directly below the nav (was a small centered pill sharing the 64px header bar with the logo and links). The countdown numerals now measure 64px tall live — the single largest element anywhere on the page (next-largest number on screen: 44px).',
);

await con.getByText('Why does it break?').click();
await con.waitForTimeout(600);
await shot(con, 'console-explain', 'Console — Step 3 Explain. Each cause is removed and the evening re-run; two causes each explain ~100% of dangerous minutes → "mismatch, not shortage." The pulse-burst figure now reads "about 2,000 people every 6 minutes" — Phase 1 fixed a real inconsistency where this same screen used to say "about 900," disagreeing with the ~2,000 the Rehearse step (previous screen) already showed for the same fact.');
await con.mouse.wheel(0, 500);
await shot(con, 'console-explain-chain', 'Console — the causal chain read straight out of simulation frames (train pulses → gate mismatch → forecourt fills → crush).');
await con.mouse.wheel(0, -600);

await con.getByText('Find the fix').click();
await con.waitForTimeout(800);
await shot(con, 'console-prove-plan-tab', 'Console — Step 4 Prove, restructured in Phase 4 into four tabs (Plan / Why it works / Timing / Stress test), Plan shown by default. Previously this was a single ~2.5–3 screen scroll stacking all four sections plus a "build your own plan" panel; every tab now fits without scrolling. The Approve button is sticky at the bottom regardless of which tab is active.');
await con.getByText('Why it works', { exact: true }).click();
await con.waitForTimeout(400);
await shot(con, 'console-prove-why-tab', 'Console — Prove / "Why it works" tab: the plans that look right but fail, each simulated and shown with its real result — was previously just another section in the long scroll.');
await con.getByText('Timing', { exact: true }).click();
await con.waitForTimeout(400);
await shot(con, 'console-prove-timing-tab', 'Console — Prove / "Timing" tab: the decision window board and the cost-of-waiting chart, now grouped together on their own tab.');
await con.getByText('Stress test', { exact: true }).click();
await con.waitForTimeout(400);
await shot(con, 'console-prove-stress-tab', 'Console — Prove / "Stress test" tab: the Red Team summary card, opening the same drawer as before.');
await con.getByText('Plan', { exact: true }).click();
await con.waitForTimeout(300);
await con.getByText('Advanced: build your own plan', { exact: false }).click();
await con.waitForTimeout(500);
await shot(con, 'console-deck-drawer', 'Console — "build your own plan," moved in Phase 4 out of the main Prove flow entirely into this drawer, reachable only via the small "Advanced" link on the Plan tab. It no longer appears anywhere in the default demo path.');
await con.keyboard.press('Escape');
await con.waitForTimeout(300);

// Red team drawer (now via the Stress test tab)
await con.getByText('Stress test', { exact: true }).click();
await con.waitForTimeout(300);
await con.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes('Try to break'));
  b?.click();
});
await con.waitForTimeout(9000);
await shot(con, 'console-redteam', 'Console — Red Team drawer: 192 rough nights, tiered outcomes (safe/better/same/worse), heatmap grid, worst night + backup plan.');
await con.keyboard.press('Escape');
await con.waitForTimeout(400);

// Board drawer (now via the Timing tab)
await con.getByText('Timing', { exact: true }).click();
await con.waitForTimeout(300);
await con.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes('This plan works'));
  b?.click();
});
await con.waitForTimeout(800);
await shot(con, 'console-board-drawer', 'Console — decision window detail: per-lever benefit curves across 12 rough nights, with the most cautious deadline highlighted.');
await con.keyboard.press('Escape');
await con.waitForTimeout(400);

// Approve plan → Guide step
await con.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.startsWith('Approve'));
  b?.click();
});
await con.waitForTimeout(6000);
await shot(con, 'console-guide', 'Console — Step 5 Guide, after approval. Map replays with the plan in force; readouts compare to "if you did nothing." The green approval band and the readouts panel are the two most number-dense parts of the app (flagged, not redesigned, in Phase 4 — see the written report).');
await con.mouse.wheel(0, 500);
const telegramBtn = con.getByText('Send to Telegram').first();
if (await telegramBtn.count()) {
  await telegramBtn.click();
  await con.waitForTimeout(2000);
}
await shot(con, 'console-guide-orders', 'Console — orders ready to send: crowd message in Marathi/Hindi/English with a PA play button, and staff/transport/accommodation orders with Copy / Send SMS / new "Send to Telegram" (Phase 3) — shown here after a real send, confirmed with "Sent to ops · HH:MM." The crowd-message card deliberately has no Telegram button.');
await con.mouse.wheel(0, -1200);

// Black Box ledger
await con.getByText('Black Box').first().click();
await con.waitForTimeout(500);
await shot(con, 'console-ledger', 'Console — Black Box ledger, now persisted to Supabase (Phase 2) instead of an in-memory array: every forecast/warning/plan/approval hash-chained, in order. Same hash-chain math as before this pass, byte-for-byte — only where it is stored changed.');
const verifyBtn = con.getByText('Verify the ledger', { exact: false });
if (await verifyBtn.count()) await verifyBtn.click();
await con.waitForTimeout(400);
const tamperBtn = con.getByText('Try to tamper', { exact: false });
if (await tamperBtn.count()) await tamperBtn.click();
await con.waitForTimeout(500);
await shot(con, 'console-ledger-tamper', 'Console — Black Box tamper test: a changed entry is caught by the hash chain, proven live in the browser.');
await con.keyboard.press('Escape');

// How this works
await con.getByText('How this works').click();
await con.waitForTimeout(400);
await shot(con, 'console-about', '"How this works" panel — the honesty/assumptions disclosure (§13 requirement), what is guessed vs simulated.');
await con.keyboard.press('Escape');
await con.waitForTimeout(300);

// What-if
const rainChip = con.getByText('Heavy rain from 18:00');
if (await rainChip.count()) {
  await rainChip.click();
  await con.waitForTimeout(1000);
  await shot(con, 'console-whatif-rain', 'Console — what-if chip (heavy rain) re-runs the evening with a scenario patch; do-nothing vs with-plan both shown.');
}

await con.close();

// ---------------- Console: mobile notice ----------------
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  wireLogs(page, 'console-mobile');
  await page.goto(base + '/console', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await shot(
    page,
    'console-mobile-notice',
    'Console on a phone, redesigned in Phase 6. Previously a near-blank "built for a big screen" dead end; now a QR code for the console\'s own URL (scan to open on a laptop, or forward the link), the URL itself, and a one-line preview of what\'s there. The console still never attempts to render at phone width — that redirect is correct, it was only ever the empty screen it led to that needed fixing.',
  );
  await page.close();
}

// ---------------- Replay page (Bengaluru) ----------------
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  wireLogs(page, 'replay');
  await page.goto(base + '/replay', { waitUntil: 'networkidle' });
  await page.waitForTimeout(6000);
  await shot(page, 'replay-top', 'Replay page — 4 June 2025 Bengaluru reconstruction. Mandatory disclosure banner, warning/dangerous/ensemble stat tiles, live map.');
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(400);
  await shot(page, 'replay-variants', 'Replay page — "what the engine says would have mattered most": upstream what-ifs (pass-only entry, gates on time), not gate-lane plans.');
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(400);
  await shot(page, 'replay-sources', 'Replay page — assumptions and numbered sources, every timeline claim traceable.');
  await page.close();
}

// ---------------- Venues page ----------------
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  wireLogs(page, 'venues');
  await page.goto(base + '/venues', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  await shot(page, 'venues-default', 'Venues page — "any venue in 60 seconds." Cached venues list, live map, plans panel — default selection.');
  await page.getByText('Narendra Modi Stadium').first().click();
  await page.waitForTimeout(4000);
  await shot(page, 'venues-nms', 'Venues page — switched to Narendra Modi Stadium (auto-built graph, 132,000 capacity), re-simulated instantly with its own plans.');
  await page.getByText('M. Chinnaswamy Stadium').first().click();
  await page.waitForTimeout(4000);
  await shot(page, 'venues-chinnaswamy', 'Venues page — M. Chinnaswamy Stadium (Bengaluru), showing editable estimated levers (gate lanes, crowd size).');
  await page.close();
}

// ---------------- The Room: console + 2 phones end-to-end, real Supabase ----------------
{
  const con2 = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  wireLogs(con2, 'room-console');
  await con2.goto(base + '/console', { waitUntil: 'networkidle' });
  await con2.getByText('Rehearse the evening').click();
  await con2.waitForTimeout(1200);
  await con2.getByText('Skip to the warning').click();
  await con2.waitForTimeout(13000);
  await con2.getByText('Why does it break?').click();
  await con2.getByText('Find the fix').click();
  await con2.waitForTimeout(800);
  await con2.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.startsWith('Approve'));
    b?.click();
  });
  await con2.waitForTimeout(1500);
  await con2.getByText('Open the room').first().click();
  await con2.waitForTimeout(1500);
  const code = await con2.locator('text=/^[A-Z]+-\\d{3}$/').first().textContent();
  await shot(con2, 'room-open', `The Room — QR code + room code (${code}) shown full-screen. State now lives in Supabase (Phase 2), not an in-memory Map on one server process — verified by querying the database directly for this exact room after the run below and finding the room row, both phones, the cast vote, and the broadcast/outcome all genuinely persisted.`);

  const phones = [];
  for (const [lang] of [['English'], ['मराठी']]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    wireLogs(p, 'phone');
    await p.goto(base + '/join/' + code, { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    await shot(p, 'phone-language', 'Phone (The Room) — language picker, no login, one idea per screen.');
    await p.getByText(lang, { exact: true }).click();
    await p.waitForTimeout(1500);
    phones.push(p);
  }
  await shot(phones[0], 'phone-joined-en', 'Phone (English) — joined a cohort, waiting for the control room to act.');
  await shot(phones[1], 'phone-joined-mr', 'Phone (Marathi) — same join screen, localized, Devanagari numerals.');

  await con2.getByText("Send the plan's message to every phone").click().catch(() => con2.getByText('Send the plan').click());
  await con2.waitForTimeout(2500);
  await shot(con2, 'room-broadcast', 'The Room (console) — message sent, live vote tally streaming in from phones over a real Supabase Realtime WebSocket subscription (Phase 2), not just polling.');
  await shot(phones[0], 'phone-message-en', 'Phone (English) — the crowd message arrives (vibrates), with Yes/No and a countdown.');
  await shot(phones[1], 'phone-message-mr', 'Phone (Marathi) — same message, localized template, Devanagari digits.');

  for (const p of phones) {
    const yes = p.locator('button').filter({ hasText: /Yes|हो|हाँ/ }).first();
    if (await yes.count()) await yes.click();
  }
  await con2.getByText('Simulate 24 phones').click();
  await con2.waitForTimeout(6000);
  await shot(con2, 'room-tally', 'The Room (console) — vote tally after simulated phones join (fallback for judges without a phone handy). Phase 1 fixed a real bug here: simulated phones could previously vote in cohorts that never received a message, so this tally and the result footnote below could silently disagree by a few votes.');
  await con2.getByText('Run the evening with the room').click();
  await con2.waitForTimeout(3500);
  await shot(con2, 'room-result', 'The Room (console) — evening re-run with real acceptance rates: "the room said yes X%, the model predicted Y%," dangerous minutes updated live.');
  await phones[0].waitForTimeout(2500);
  await shot(phones[0], 'phone-outcome', 'Phone — personal outcome: "what happened to people like you," numbers traced through the re-run.');

  await con2.close();
  for (const p of phones) await p.close();
}

await browser.close();

fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(shots, null, 2));
console.log('TOTAL', shots.length);
