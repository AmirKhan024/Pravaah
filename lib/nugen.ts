import 'server-only';

/*
 * Nugen Intelligence Integration (HackCelestial 3.0 Mandatory Requirement)
 *
 * Demonstrates:
 * Base AI Model (qwen-v2p5-0p5b-instruct) ->
 * Nugen Train-Time Alignment (docs/nugen_alignment/) ->
 * Domain-Specific Aligned Model (NUGEN_MODEL_ID) ->
 * Project Integration (Inference with Confidence Scoring)
 *
 * Architectural Rule:
 * An LLM output NEVER produces a number, density, cost, or probability on screen.
 * The aligned model is strictly used for:
 * (1) Interpreting organizer what-if scenario queries into validated JSON patches
 * (2) Re-wording crowd advisories and announcements behind locked placeholders
 */

export interface NugenInferenceResult<T = unknown> {
  data: T | null;
  confidenceScore: number | null;
  model: string;
  source: 'nugen';
}

export const isNugenEnabled = () =>
  !!process.env.NUGEN_API_KEY &&
  !!process.env.NUGEN_MODEL_ID &&
  process.env.NEXT_PUBLIC_DEMO_OFFLINE !== '1';

export function getNugenConfig() {
  return {
    enabled: isNugenEnabled(),
    apiKey: process.env.NUGEN_API_KEY ? 'present' : 'missing',
    baseModel: 'qwen-v2p5-0p5b-instruct',
    alignedModelId: process.env.NUGEN_MODEL_ID || null,
    alignmentProjectId: process.env.NUGEN_ALIGNMENT_ID || null,
    provider: 'Nugen Intelligence',
    domain: 'Event Crowd Dynamics, Gate Ingress & Safety Protocols',
  };
}

export async function nugenChatCompletion(
  system: string,
  user: string,
  timeoutMs = 9000
): Promise<{ content: string | null; confidenceScore: number | null; model: string } | null> {
  if (!isNugenEnabled()) return null;

  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);

  try {
    const res = await fetch('https://api.nugen.in/api/v3/inference/chat/completions', {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.NUGEN_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.NUGEN_MODEL_ID,
        temperature: 0,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    if (!res.ok) {
      console.warn(`[Nugen] API returned status ${res.status}: ${res.statusText}`);
      return null;
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      confidence_score?: number | null;
      model?: string;
    };

    const content = json.choices?.[0]?.message?.content || null;
    const confidenceScore = json.confidence_score ?? null;
    const model = json.model || process.env.NUGEN_MODEL_ID || 'nugen-aligned';

    return { content, confidenceScore, model };
  } catch (err) {
    console.warn('[Nugen] Request failed:', err);
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function nugenJSON<T = Record<string, unknown>>(
  system: string,
  user: string,
  timeoutMs = 9000
): Promise<NugenInferenceResult<T> | null> {
  const result = await nugenChatCompletion(system, user, timeoutMs);
  if (!result || !result.content) return null;

  try {
    // Extract JSON block if wrapped in markdown code fence
    let raw = result.content.trim();
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    }
    const data = JSON.parse(raw) as T;
    return {
      data,
      confidenceScore: result.confidenceScore,
      model: result.model,
      source: 'nugen',
    };
  } catch {
    console.warn('[Nugen] Failed to parse JSON from response:', result.content);
    return null;
  }
}
