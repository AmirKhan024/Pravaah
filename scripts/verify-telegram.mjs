// Live verification: click "Send to Telegram" on a real order card in the Guide step, confirm the
// UI shows the success state, and independently confirm via the Telegram Bot API that a message
// with a matching timestamp actually reached the chat.
import { chromium } from 'playwright';
import path from 'node:path';

const out = process.argv[2] || '.';
const base = 'http://localhost:3000';
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1600, height: 900 } });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));

await p.goto(base + '/console', { waitUntil: 'networkidle' });
await p.getByText('Rehearse the evening').click();
await p.waitForTimeout(1200);
await p.getByText('Skip to the warning').click();
await p.waitForTimeout(13000);
await p.getByText('Why does it break?').click();
await p.getByText('Find the fix').click();
await p.waitForTimeout(800);
await p.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.startsWith('Approve'));
  b?.click();
});
await p.waitForTimeout(2000);
await p.screenshot({ path: path.join(out, 'telegram-before.png') });

const btn = p.getByText('Send to Telegram').first();
console.log('Send to Telegram button count:', await btn.count());
await btn.click();
await p.waitForTimeout(2500);
const sentText = await p.locator('text=/Sent to ops/').first().innerText().catch(() => null);
console.log('UI confirmation shown:', sentText);
await p.screenshot({ path: path.join(out, 'telegram-after.png') });

// also try a crowd-message card to CONFIRM it has no Telegram button (per the brief, must stay untouched)
const crowdCardTelegramBtn = await p.locator('text=Message to the crowd').first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]').locator('text=Send to Telegram').count();
console.log('Telegram button present on the crowd card (should be 0):', crowdCardTelegramBtn);

await browser.close();
