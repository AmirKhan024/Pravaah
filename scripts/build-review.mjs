// Builds review.html from review-assets/manifest.json + the captions review-shots.mjs wrote into
// it. Regenerate whenever review-shots.mjs is re-run: node scripts/build-review.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'review-assets/manifest.json'), 'utf8'));
const byFile = Object.fromEntries(manifest.map((m) => [m.file.replace(/^\d+-/, ''), m]));
const shot = (name) => {
  const m = byFile[name + '.png'] || manifest.find((x) => x.file.includes('-' + name + '.png'));
  if (!m) throw new Error('missing shot: ' + name);
  return m;
};

const SECTIONS = [
  {
    n: '01',
    title: 'Cover page — first five seconds',
    intro:
      'This is what a judge sees before clicking anything. The right-hand panel is not a static illustration — it\'s the actual engine running live in the browser, showing the real do-nothing evening at DY Patil Stadium, with a live-measured <code>simulate()</code> timing badge. The headline no longer states a specific lead time (Phase 1 of this pass removed the "forty minutes early" claim, which the Decision Clock itself contradicted on most runs).',
    shots: ['cover-hero', 'cover-steps', 'cover-footer'],
  },
  {
    n: '02',
    title: 'The console — Rehearse, Predict, Explain',
    intro:
      'Left rail: five numbered steps. Center: a live MapLibre map with a custom canvas overlay. Below the top nav: the Decision Clock, redesigned in Phase 5 into its own full-width band — previously a small pill sharing the header bar with the logo and nav links.',
    shots: ['console-intro', 'console-story', 'console-live-calm', 'console-decision-clock', 'console-explain', 'console-explain-chain'],
  },
  {
    n: '03',
    title: 'Step 4 · Prove — now four tabs, not one long scroll',
    intro:
      'Phase 4 restructured this step: Plan / Why it works / Timing / Stress test, Plan shown by default, the Approve button sticky underneath every tab. "Build your own plan" moved out of the default demo path entirely, into a drawer behind a small "Advanced" link.',
    shots: ['console-prove-plan-tab', 'console-prove-why-tab', 'console-prove-timing-tab', 'console-prove-stress-tab', 'console-deck-drawer', 'console-redteam', 'console-board-drawer'],
  },
  {
    n: '04',
    title: 'Step 5 · Guide — orders, now with a real Telegram send',
    intro:
      'Crowd messages stay on their own card (MR/HI/EN, Play on PA, Copy, SMS) — untouched by Phase 3. Staff/transport/accommodation/food order cards gained a "Send to Telegram" button, shown here after a real send to a live ops chat, confirmed inline with a timestamp.',
    shots: ['console-guide', 'console-guide-orders'],
  },
  {
    n: '05',
    title: 'Black Box, disclosure, what-ifs, and the mobile view',
    intro:
      'The Black Box ledger is now Supabase-backed (Phase 2) instead of an in-memory array — same hash-chain math, byte-for-byte, only the storage changed. The mobile console notice was redesigned in Phase 6 from a near-blank dead end into something actually useful.',
    shots: ['console-ledger', 'console-ledger-tamper', 'console-about', 'console-whatif-rain', 'console-mobile-notice'],
  },
  {
    n: '06',
    title: '4 June 2025 replay — the sensitive one',
    intro: 'A reconstruction of the real Bengaluru stadium crush from public reporting, run through the same engine. Unchanged by this pass.',
    shots: ['replay-top', 'replay-variants', 'replay-sources'],
  },
  {
    n: '07',
    title: 'Any venue — the generalization proof',
    intro: 'Four cached venues plus live OpenStreetMap import; switching venues re-simulates and re-optimizes immediately. Unchanged by this pass.',
    shots: ['venues-default', 'venues-nms', 'venues-chinnaswamy'],
  },
  {
    n: '08',
    title: 'The Room — now genuinely backed by Supabase',
    intro:
      'Captured end-to-end with two real headless-browser "phones" (English + Marathi) plus simulated phones, against the running dev server with real Supabase credentials — not the in-memory fallback. Phase 1 also fixed a real vote-counting bug here (the live tally bar and the result footnote could previously disagree); Phase 2 moved all of this off the single dev-server process onto Supabase, with genuine Realtime WebSocket subscriptions confirmed live and the underlying rows confirmed by querying the database directly.',
    shots: ['room-open', 'phone-language', 'phone-joined-en', 'phone-joined-mr', 'room-broadcast', 'phone-message-en', 'phone-message-mr', 'room-tally', 'room-result', 'phone-outcome'],
  },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function figure(name) {
  const m = shot(name);
  return `    <figure>
      <img src="review-assets/${m.file}" alt="${esc(m.caption)}">
      <figcaption>
        <div class="cap">${m.caption}</div>
      </figcaption>
    </figure>`;
}

function section(s) {
  return `  <section>
    <div class="section-head"><span class="n">${s.n}</span><h2>${s.title}</h2></div>
    <p class="section-intro">${s.intro}</p>
    <div class="figset">
${s.shots.map(figure).join('\n')}
    </div>
  </section>`;
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pravaah — build review (wiring + polish pass)</title>
<style>
  :root{
    --ink:#101715; --panel:#16201E; --panel-2:#1B2624; --line:#26322F;
    --text:#DCE5E1; --dim:#7A8A85; --dimmer:#586662;
    --brass:#C9A961; --brass-dim:#8E7742;
    --safe:#6FB39A; --danger:#E0634F;
    --mono:ui-monospace,"SF Mono","Cascadia Mono","Roboto Mono",Menlo,Consolas,monospace;
    --sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;
    --serif:Georgia,"Times New Roman",serif;
  }
  *{box-sizing:border-box}
  body{
    margin:0; background:var(--ink); color:var(--text); font-family:var(--sans);
    font-size:14.5px; line-height:1.6; -webkit-font-smoothing:antialiased;
  }
  .wrap{max-width:1000px; margin:0 auto; padding:44px 24px 100px}
  .kicker{font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--brass-dim); font-weight:700}
  h1{font-family:var(--serif); font-size:40px; line-height:1.08; margin:12px 0 6px; letter-spacing:-.01em}
  h2{font-family:var(--serif); font-size:26px; margin:0 0 4px; letter-spacing:-.01em}
  p{color:var(--dim)}
  .lede{font-size:16px; line-height:1.6; color:var(--text); max-width:760px}
  a{color:var(--brass)}
  .num{font-family:var(--mono); font-variant-numeric:tabular-nums}
  .pill{display:inline-block; padding:3px 9px; border:1px solid var(--line); border-radius:99px; font-size:11px; color:var(--dim); margin:2px 6px 2px 0}
  .banner{border:1px solid var(--brass-dim); background:#1d1c14; border-radius:12px; padding:18px 20px; margin:24px 0; page-break-inside:avoid}
  .banner h2{color:var(--brass); font-size:18px; font-family:var(--sans); font-weight:700}
  .banner ol{margin:8px 0 0; padding-left:20px; color:var(--text)}
  .banner li{margin:5px 0}
  section{margin-top:44px; padding-top:22px; border-top:1px solid var(--line); page-break-before:auto}
  .section-head{display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; margin-bottom:4px}
  .section-head .n{font-family:var(--mono); color:var(--brass-dim); font-size:12px}
  .section-intro{max-width:780px; margin:8px 0 18px; font-size:13.5px}
  .section-intro code{font-family:var(--mono); background:var(--panel-2); padding:1px 5px; border-radius:4px; font-size:12px; color:var(--brass)}
  .figset{display:grid; grid-template-columns:1fr 1fr; gap:16px}
  @media print{ .figset{grid-template-columns:1fr 1fr} }
  figure{margin:0; background:var(--panel); border:1px solid var(--line); border-radius:12px; overflow:hidden; page-break-inside:avoid; break-inside:avoid}
  figure img{display:block; width:100%; height:auto; background:#0b1110; border-bottom:1px solid var(--line)}
  figcaption{padding:12px 16px}
  figcaption .cap{color:var(--text); font-size:12.5px; line-height:1.5}
  .qlist{background:var(--panel-2); border:1px solid var(--line); border-radius:12px; padding:18px 20px; page-break-inside:avoid}
  .qlist ol{margin:0; padding-left:20px}
  .qlist li{margin:8px 0; color:var(--text)}
  .grid2{display:grid; grid-template-columns:1fr 1fr; gap:18px}
  .footer-note{margin-top:50px; padding-top:20px; border-top:1px solid var(--line); font-size:12px; color:var(--dimmer)}
  code{font-family:var(--mono); background:var(--panel-2); padding:1px 5px; border-radius:4px; font-size:12px; color:var(--brass)}
</style>
</head>
<body>
<div class="wrap">

  <div class="kicker">Build review · wiring + polish pass · for an AI judge</div>
  <h1>Pravaah — verified after the fix-and-wire pass</h1>
  <p class="lede">
    This supersedes the earlier review. Since then: two real bugs were fixed (a wrong "40 minutes
    early" headline claim, and a vote-counting mismatch in The Room), The Room and the Black Box
    moved from an in-memory Map to a real Supabase project (verified live, including direct
    database queries), a one-way Telegram ops channel was added and sent a real message to a real
    chat, the Prove step was restructured from one long scroll into four tabs, the Decision Clock
    became an actual full-width hero (measured 64px numerals vs. 44px for anything else on the
    page), and the mobile console notice became a QR code instead of a dead end. All 45 automated
    tests pass; every screenshot below is unedited, taken against the real running app with real
    credentials, in this order.
  </p>

  <div class="banner">
    <h2>What we want from you</h2>
    <p style="color:var(--text)">
      Same judging context as before: HackCelestial 3.0, PS-8, ~320 teams / ~120 on this problem
      statement. Read the screenshots below in order, then answer:
    </p>
    <ol>
      <li><b>Does the UI now read as finished and premium?</b> Compare specifically against what you'd expect from the old single-scroll Prove step and the old small Decision Clock pill, if you reviewed those before — are the fixes proportionate to what was wrong, or is there still a gap?</li>
      <li><b>Is anything still inconsistent, unclear, or unfinished-looking?</b> Name it specifically, with the screenshot filename.</li>
      <li><b>Rank the next five highest-leverage changes</b> for a judge's first impression, same impact × effort framing as before.</li>
      <li><b>Two specific things we flagged but didn't fix — give us a verdict.</b> First: the Guide step (Step 5) still shows roughly 24 numbers on screen at once by our own count (see the "console-guide-orders" screenshot) — should it get the same tab treatment Prove just got, and if so what's the natural split? Second: we deliberately stopped short of building the Telegram "Acknowledge" button + webhook loop because it can't be tested without a public deployment — does a one-way send-only ops channel read as a complete feature on its own, or does its absence hurt more than we think?</li>
      <li><b>One thing to cut,</b> if forced to trade a feature for more polish time.</li>
    </ol>
  </div>

${SECTIONS.map(section).join('\n\n')}

  <section>
    <div class="section-head"><span class="n">09</span><h2>Your review</h2></div>
    <div class="qlist">
      <p style="color:var(--text); margin-top:0">Answer the five numbered questions above using only what you saw here. Reference screenshot filenames where useful (e.g. <code>09-console-prove-plan-tab.png</code>).</p>
    </div>
  </section>

  <div class="footer-note">
    Captured with Playwright/Chromium against a local Next.js dev server running with real Supabase and Telegram credentials. Screenshots are unedited PNGs; <span class="pill">${manifest.length} screenshots</span><span class="pill">8 sections</span><span class="pill">real Supabase + Telegram</span>.
    Source: <a href="https://github.com/AmirKhan024/Pravaah">github.com/AmirKhan024/Pravaah</a>.
  </div>

</div>
</body>
</html>
`;

fs.writeFileSync(path.join(root, 'review.html'), html);
console.log('wrote review.html —', manifest.length, 'shots across', SECTIONS.length, 'sections');
