import 'server-only';
/*
 * Groq — used ONLY for (1) turning a typed what-if into a validated structured patch and
 * (2) re-wording message text whose numbers are locked behind placeholders.
 * An LLM output never becomes a number on screen (SOURCE_OF_TRUTH §3.2, §14.4).
 */
export const llmEnabled = () => !!process.env.GROQ_API_KEY && process.env.NEXT_PUBLIC_DEMO_OFFLINE !== '1';

export async function groqJSON(system: string, user: string, timeoutMs = 9000): Promise<unknown | null> {
  if (!llmEnabled()) return null;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        temperature: 0,
        reasoning_effort: 'low',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    const c = j.choices?.[0]?.message?.content;
    return c ? JSON.parse(c) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
