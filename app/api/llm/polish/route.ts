import { NextResponse } from 'next/server';
import { groqJSON, llmEnabled } from '@/lib/groq';

export const dynamic = 'force-dynamic';

const NAMES: Record<string, string> = { mr: 'Marathi', hi: 'Hindi', en: 'English' };
// a number together with its unit is one locked token, so the model cannot drop or change either
const DIGITS = /₹?[0-9०-९]+(?:[,.][0-9०-९]+)*(?:\s*(?:more\s+|extra\s+|जास्त\s+|ज़्यादा\s+)?(?:minutes?|mins?|मिनिटं|मिनिटे|मिनिट|मिनट|people|लोक|लोग))?/g;

/*
 * Re-word a crowd message for a PA announcement or SMS. Every number is swapped for a
 * placeholder BEFORE the model sees it, and re-injected after. Output containing any digit,
 * a missing placeholder or an extra one is rejected and the fixed template is used instead.
 */
export async function POST(req: Request) {
  const { text, lang } = (await req.json().catch(() => ({}))) as { text?: string; lang?: string };
  const src = String(text || '').slice(0, 600);
  if (!src || !NAMES[lang || '']) return NextResponse.json({ ok: false }, { status: 400 });
  if (!llmEnabled()) return NextResponse.json({ ok: false, text: src, reason: 'offline' });
  const nums: string[] = [];
  const masked = src.replace(DIGITS, (m) => {
    nums.push(m);
    return `[[${nums.length - 1}]]`;
  });
  const raw = (await groqJSON(
    `You rewrite short crowd-guidance messages for a stadium public-address system in ${NAMES[lang!]}. Keep it calm, warm, plain and short (max 2 sentences). Each placeholder like [[0]] stands for a number with its unit (for example "eight minutes"); keep every placeholder exactly once, unchanged, and in a sentence where its meaning stays clear. Never write any digit or number word. Never add facts. Return JSON {"text": "..."} in ${NAMES[lang!]}.`,
    masked,
  )) as { text?: string } | null;
  const out = raw?.text;
  if (!out || typeof out !== 'string') return NextResponse.json({ ok: false, text: src, reason: 'no output' });
  const ph: string[] = out.match(/\[\[(\d+)\]\]/g) || [];
  const clean = out.replace(/\[\[(\d+)\]\]/g, '');
  const sameSet = ph.length === nums.length && nums.every((_, i) => ph.includes(`[[${i}]]`));
  if (/[0-9०-९]/.test(clean) || !sameSet) return NextResponse.json({ ok: false, text: src, reason: 'rejected: the model changed a number' });
  const final = out.replace(/\[\[(\d+)\]\]/g, (_, i) => nums[+i]);
  return NextResponse.json({ ok: true, text: final });
}
