// Dev helper: drive the app in headless Chromium, print console errors, save screenshots.
// usage: node scripts/shot.mjs <url> <outDir> [steps-json]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [url = 'http://localhost:3000/console', out = '.', stepsArg = '[]'] = process.argv.slice(2);
const steps = JSON.parse(stepsArg);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log('[console.' + m.type() + ']', m.text().slice(0, 400));
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'networkidle' });
let i = 0;
for (const s of steps) {
  if (s.wait) await page.waitForTimeout(s.wait);
  if (s.click) await page.getByText(s.click, { exact: false }).first().click({ timeout: 8000 }).catch((e) => console.log('click failed', s.click, e.message.split('\n')[0]));
  if (s.key) await page.keyboard.press(s.key);
  if (s.eval) console.log('eval:', await page.evaluate(s.eval));
  if (s.viewport) await page.setViewportSize(s.viewport);
  if (s.shot) {
    const f = path.join(out, `${String(i++).padStart(2, '0')}-${s.shot}.png`);
    await page.screenshot({ path: f });
    console.log('shot', f);
  }
}
await browser.close();
