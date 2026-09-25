'use client';
import type { Lang } from '@/engine';

const BCP: Record<Lang, string[]> = { mr: ['mr-IN', 'hi-IN'], hi: ['hi-IN'], en: ['en-IN', 'en-GB', 'en-US'] };

/** PA announcement via the browser's own speech engine. Marathi falls back to a Hindi voice (same script). */
export function speak(text: string, lang: Lang): { ok: boolean; voice?: string } {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return { ok: false };
  const synth = window.speechSynthesis;
  synth.cancel();
  const voices = synth.getVoices();
  let voice: SpeechSynthesisVoice | undefined;
  for (const code of BCP[lang]) {
    voice = voices.find((v) => v.lang === code) || voices.find((v) => v.lang.startsWith(code.slice(0, 2)));
    if (voice) break;
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = voice?.lang || BCP[lang][0];
  if (voice) u.voice = voice;
  u.rate = lang === 'en' ? 0.95 : 0.9;
  synth.speak(u);
  return { ok: true, voice: voice?.name };
}
