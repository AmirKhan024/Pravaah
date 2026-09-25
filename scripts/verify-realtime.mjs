// Live Phase 2 verification: drives console + 1 phone through the whole Room flow over Realtime,
// confirms both sides open a genuine Supabase Realtime WebSocket, and times message delivery.
import { chromium } from 'playwright';
import path from 'node:path';

const out = process.argv[2] || '.';
const base = 'http://localhost:3000';
const browser = await chromium.launch();

const con = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const conWs = [];
con.on('websocket', (w) => conWs.push(w.url()));
con.on('pageerror', (e) => console.log('[console pageerror]', e.message));
await con.goto(base + '/console', { waitUntil: 'networkidle' });
await con.getByText('Rehearse the evening').click();
await con.waitForTimeout(1200);
await con.getByText('Skip to the warning').click();
await con.waitForTimeout(13000);
await con.getByText('Why does it break?').click();
await con.getByText('Find the fix').click();
await con.waitForTimeout(800);
await con.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.startsWith('Approve'));
  b?.click();
});
await con.waitForTimeout(1500);
await con.getByText('Open the room').first().click();
await con.waitForTimeout(2500);
const code = await con.locator('text=/^[A-Z]+-\\d{3}$/').first().textContent();
console.log('ROOM CODE:', code);
console.log('console realtime WS connected?', conWs.some((u) => u.includes('supabase.co')));

const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const phone = await phoneCtx.newPage();
const phoneWs = [];
phone.on('websocket', (w) => phoneWs.push(w.url()));
phone.on('pageerror', (e) => console.log('[phone pageerror]', e.message));
await phone.goto(base + '/join/' + code, { waitUntil: 'networkidle' });
await phone.getByText('English', { exact: true }).click();
await phone.waitForTimeout(2000);
console.log('phone realtime WS connected?', phoneWs.some((u) => u.includes('supabase.co')));

const t0 = Date.now();
await con.getByText("Send the plan's message to every phone").click();
let ms = -1;
for (let i = 0; i < 50; i++) {
  await phone.waitForTimeout(50);
  if (await phone.locator('text=Gate 5 is empty').count()) {
    ms = Date.now() - t0;
    break;
  }
}
console.log('PHONE SAW MESSAGE after', ms, 'ms', ms >= 0 && ms < 1000 ? '(Realtime, not the old 1.2s poll)' : '');
await phone.screenshot({ path: path.join(out, 'phase2-phone-message.png') });

const yes = phone.locator('button').filter({ hasText: /Yes/ }).first();
if (await yes.count()) await yes.click();
await con.getByText('Simulate 24 phones').click();
await con.waitForTimeout(3000);
await con.getByText('Run the evening with the room').click();
await con.waitForTimeout(4000);
await con.screenshot({ path: path.join(out, 'phase2-room-result.png') });
let outcomeSeen = false;
for (let i = 0; i < 20; i++) {
  await phone.waitForTimeout(150);
  if (await phone.locator('text=What happened to people like you').count()) {
    outcomeSeen = true;
    break;
  }
}
console.log('phone received personal outcome?', outcomeSeen);
await phone.screenshot({ path: path.join(out, 'phase2-phone-outcome.png') });

await browser.close();
console.log('DONE. room code =', code, '-- query Supabase directly for this code next.');
