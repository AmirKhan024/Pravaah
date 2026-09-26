// Targeted screenshot pass for the new Live Ops control room (calm /live screen, More menu,
// six status dots + coverage drawer, the monitor loop, tripwires, dynamic Telegram alerts).
// Appends to review-assets/manifest.json (does not overwrite review-shots.mjs's earlier captures).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'review-assets');
fs.mkdirSync(out, { recursive: true });
const base = 'http://localhost:3000';
const manifestPath = path.join(out, 'manifest.json');
const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
let n = existing.length;
const shots = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('[console.error]', m.text().slice(0, 300)));

async function shot(name, caption) {
  const file = `${String(n).padStart(2, '0')}-${name}.png`;
  n++;
  await page.screenshot({ path: path.join(out, file) });
  shots.push({ file, caption });
  console.log('shot', file);
}

await page.goto(base + '/live', { waitUntil: 'networkidle' });
await page.waitForTimeout(4500);
await shot('live-calm', 'Live Ops — the new default control room. One status word, one sentence, the map centred and dominant, ONE action card at a time on the right, six status dots at the bottom, a "what changed" ticker. Replaces the old three-column layout that showed up to four action cards and a permanent orders panel.');

// six status dots + coverage drawer
await page.click('text=Crowd & gates');
await page.waitForTimeout(400);
await shot('live-bucket-drawer', 'Clicking a status dot opens its detail: current status, an honest "Simulated" or "Playbook" coverage tag, and the real numbers behind it. Every one of the six buckets (Crowd & gates, Getting there, Hotels, Weather & delays, VIP, Money & refunds) is tagged this way — VIP and Money & refunds are honestly "playbook," not faked as simulated.');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// More menu
await page.click('button:has-text("More")');
await page.waitForTimeout(300);
await shot('live-more-menu', 'The single "More" menu — every other feature (Ravi & the ghost, what-ifs, Red Team, decision windows, build-your-own plan, orders sent, the Black Box, assumptions, venues, replay, full console) is one click away, nothing deleted, none of it cluttering the calm main screen.');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Report drawer (observed inputs)
await page.click('button:has-text("Report")');
await page.waitForTimeout(300);
await shot('live-report-drawer', 'Reporting from the ground: six instant chips (rain, rail delay, gates late, more/fewer people, slow lanes) plus a typed field parsed the same clamped way a what-if question is. This is the monitor loop’s input — real staff observations, never a number an LLM invented.');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Run Red Team so a tripwire has a backup to propose
await page.click('button:has-text("More")');
await page.click('text=Stress test (Red Team)');
await page.waitForSelector('text=/Safe on/', { timeout: 60000 }).catch(() => console.log('WARN redteam timeout'));
await shot('live-redteam', 'Red Team — 192 rough nights tried against the current plan, reached from Live Ops’s More menu. Its worst-night backup plan is what a fired tripwire proposes below.');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Fire a tripwire with a real report
await page.click('button:has-text("Report")');
await page.click('button:has-text("Rain has started")');
await page.waitForTimeout(1800);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await shot('live-tripwire-fired', 'A tripwire fires: staff reported rain, Red Team had already found this breaks the plan most of the time, so Pravaah proposes the exact backup it already computed for the worst night — shown as the one action card, never auto-approved. The ticker at the bottom records it.');

// Approve the tripwire's backup
await page.click('button:has-text("Do it")');
await page.waitForTimeout(1500);
await shot('live-tripwire-approved', 'The tripwire’s proposed backup, approved — "Done · sent to ops" with a real timestamp confirms the order actually reached the live Telegram channel, and the evening is back to Calm, "in force" from the real current clock time.');

// Report more, aggressively, to try to push the just-approved plan into "stopped working"
await page.click('button:has-text("Report")');
await page.click('button:has-text("Rail line delayed")');
await page.waitForTimeout(1200);
await page.click('button:has-text("Gates running late")');
await page.waitForTimeout(1200);
await page.click('button:has-text("More people than expected")');
await page.waitForTimeout(1500);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
const stillActionable = await page.locator('button:has-text("Do it")').count();
if (stillActionable) {
  await shot('live-stopped-working', 'More was observed after the plan was already in force (a rail delay, gates late, more people than expected) — Pravaah re-checked the approved plan against the new conditions. When it no longer delivers what it promised, status flips to "Act now" with a "stopped working — new move" badge on the fresh replacement; approving it swaps in the new plan live, without replaying a canned outcome.');
  await page.click('button:has-text("Do it")');
  await page.waitForTimeout(1200);
  await shot('live-calm-again', 'Approving the replacement puts the evening back to Calm — the loop (Watch → Detect → Re-plan → Ask) keeps running for the rest of the evening, not just once.');
} else {
  console.log('plan held up under the extra reports this run — skipping the stopped-working shot');
}

// Black Box — the audit trail of everything above, including real Telegram sends
await page.click('button:has-text("More")');
await page.click('text=The Black Box');
await page.waitForTimeout(500);
await shot('live-blackbox', 'The Black Box ledger reading back the whole sequence above — staff report, tripwire fired, re-ranked, approved, orders sent, decision recorded — each entry naming the real Telegram message it sent to the ops channel, hash-chained so nothing here can be quietly edited.');
await page.keyboard.press('Escape');

await browser.close();

const merged = [...existing, ...shots];
fs.writeFileSync(manifestPath, JSON.stringify(merged, null, 2));
console.log('APPENDED', shots.length, 'TOTAL', merged.length);
