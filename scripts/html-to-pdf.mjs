// Renders review.html (with images already inlined as base64) to review.pdf.
// usage: node scripts/html-to-pdf.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'review.html');
const dest = path.join(root, 'review.pdf');

const browser = await chromium.launch();
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file:///' + src.split(path.sep).join('/'), { waitUntil: 'networkidle', timeout: 120_000 });
await page.waitForTimeout(500);
const broken = await page.evaluate(() => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).length);
console.log('page loaded. JS errors:', errs.length, 'broken images:', broken);

await page.pdf({
  path: dest,
  format: 'A4',
  printBackground: true,
  margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate:
    '<div style="width:100%;font-size:8px;color:#7A8A85;padding:0 12mm;display:flex;justify-content:space-between;font-family:ui-monospace,monospace"><span>Pravaah — build review</span><span class="pageNumber"></span>/<span class="totalPages"></span></div>',
});
await browser.close();

const size = fs.statSync(dest).size;
console.log('wrote', dest, (size / 1e6).toFixed(1) + ' MB');
