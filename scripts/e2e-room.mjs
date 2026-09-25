// Dev check: console + two phones, full Room loop. usage: node scripts/e2e-room.mjs <outDir>
import { chromium } from 'playwright';
import path from 'node:path';

const out = process.argv[2] || '.';
const base = 'http://localhost:3000';
const browser = await chromium.launch();
const log = (p, tag) => {
  p.on('pageerror', (e) => console.log(`[${tag} pageerror]`, e.message));
  p.on('console', (m) => m.type() === 'error' && console.log(`[${tag} error]`, m.text().slice(0, 300)));
};
const con = await browser.newPage({ viewport: { width: 1600, height: 900 } });
log(con, 'console');
await con.goto(base + '/console', { waitUntil: 'networkidle' });
await con.getByText('Rehearse the evening').click();
await con.waitForTimeout(1200);
await con.getByText('Skip to the warning').click();
await con.waitForTimeout(13000);
await con.getByText('Why does it break?').click();
await con.getByText('Find the fix').click();
await con.waitForTimeout(800);
await con.getByText('Approve', { exact: false }).first().click();
await con.waitForTimeout(1500);
await con.getByText('Open the room').first().click();
await con.waitForTimeout(1500);
const code = await con.locator('text=/^[A-Z]+-\\d{3}$/').first().textContent();
console.log('room', code);
await con.screenshot({ path: path.join(out, 'room-open.png') });

const phones = [];
for (const [i, lang] of [['a', 'English'], ['b', 'मराठी']]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  log(p, 'phone-' + i);
  await p.goto(base + '/join/' + code, { waitUntil: 'networkidle' });
  await p.getByText(lang, { exact: true }).click();
  await p.waitForTimeout(1500);
  phones.push(p);
}
await phones[0].screenshot({ path: path.join(out, 'phone-joined.png') });
await con.getByText("Send the plan's message to every phone").click().catch(() => con.getByText('Send the plan').click());
await con.waitForTimeout(2500);
await phones[0].screenshot({ path: path.join(out, 'phone-message.png') });
await phones[1].screenshot({ path: path.join(out, 'phone-message-mr.png') });
for (const p of phones) {
  const yes = p.locator('button').filter({ hasText: /Yes|हो|हाँ/ }).first();
  if (await yes.count()) await yes.click();
}
await con.getByText('Simulate 24 phones').click();
await con.waitForTimeout(6000);
await con.getByText('Run the evening with the room').click();
await con.waitForTimeout(3500);
await con.screenshot({ path: path.join(out, 'room-result.png') });
await phones[0].waitForTimeout(2500);
await phones[0].screenshot({ path: path.join(out, 'phone-outcome.png') });
await browser.close();
console.log('done');
