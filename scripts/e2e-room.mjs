// Dev check: console + phones, full Room loop with the realistic response taxonomy.
// usage: node scripts/e2e-room.mjs <outDir> [baseUrl]
import { chromium } from 'playwright';
import path from 'node:path';

const out = process.argv[2] || '.';
const base = process.argv[3] || process.env.PRAVAAH_BASE_URL || 'http://localhost:3000';
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

// three phones: one accepts, one declines, one says it already moved — exercises the richer
// response taxonomy (§9 of the room-upgrade brief), not just yes/no.
const phones = [];
for (const [i, lang] of [
  ['a', 'English'],
  ['b', 'मराठी'],
  ['c', 'हिंदी'],
]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  log(p, 'phone-' + i);
  await p.goto(base + '/join/' + code, { waitUntil: 'networkidle' });
  await p.getByText(lang, { exact: true }).click();
  await p.waitForTimeout(1500);
  phones.push(p);
}
await phones[0].screenshot({ path: path.join(out, 'phone-profile.png') });
// the new attendee-profile screen, gating the waiting/message view (§6-8)
for (const p of phones) {
  const enter = p.getByText(/Enter the crowd|भीड़ में शामिल हों|गर्दीत सामील व्हा/).first();
  if (await enter.count()) await enter.click();
}
await phones[0].waitForTimeout(500);
await phones[0].screenshot({ path: path.join(out, 'phone-joined.png') });
await con.getByText("Send the plan's message to every phone").click().catch(() => con.getByText('Send the plan').click());
await con.waitForTimeout(2500);
await phones[0].screenshot({ path: path.join(out, 'phone-message.png') });
await phones[1].screenshot({ path: path.join(out, 'phone-message-mr.png') });

// accept / decline / already-moved, one per phone (matches message.yes/message.no's own copy
// plus the new "I already moved" button — see Phone.tsx)
const clicks = [/Yes|हो|हाँ/, /No thanks|नहीं|नको|रहने दें/, /already moved|पहले ही जा चुका|आधीच निघालो/];
for (let i = 0; i < phones.length; i++) {
  const btn = phones[i].locator('button').filter({ hasText: clicks[i] }).first();
  if (await btn.count()) await btn.click();
  await phones[i].waitForTimeout(300);
  // group-follow micro-question, if this phone's group size > 1 (§12)
  const groupBtn = phones[i].getByText(/All of us|हम सब|आम्ही सर्व/).first();
  if (await groupBtn.count()) await groupBtn.click();
}
await phones[0].screenshot({ path: path.join(out, 'phone-responded.png') });

await con.getByText('Simulate 24 phones').click();
await con.waitForTimeout(6000);
await con.screenshot({ path: path.join(out, 'room-live-breakdown.png') });
await con.getByText('Run the evening with the room').click();
await con.waitForTimeout(3500);
await con.screenshot({ path: path.join(out, 'room-result.png') });
await phones[0].waitForTimeout(2500);
await phones[0].screenshot({ path: path.join(out, 'phone-outcome.png') });
await browser.close();
console.log('done');
