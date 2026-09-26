// Replaces src="review-assets/<file>.png" in review.html with an inline base64 data: URI,
// so the report opens standalone (no dependency on the review-assets/ folder next to it).
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const htmlPath = path.join(root, 'review.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const re = /src="review-assets\/([^"]+\.png)"/g;
let n = 0;
let totalBytes = 0;
html = html.replace(re, (match, file) => {
  const full = path.join(root, 'review-assets', file);
  const buf = fs.readFileSync(full);
  totalBytes += buf.length;
  n++;
  const b64 = buf.toString('base64');
  return `src="data:image/png;base64,${b64}"`;
});

fs.writeFileSync(htmlPath, html);
console.log(`inlined ${n} images, ${(totalBytes / 1e6).toFixed(1)} MB source -> review.html is now ${(fs.statSync(htmlPath).size / 1e6).toFixed(1)} MB`);
