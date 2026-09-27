import { NextResponse } from 'next/server';
import { isNugenEnabled, nugenJSON } from '@/lib/nugen';
import { groqJSON, llmEnabled } from '@/lib/groq';

export const dynamic = 'force-dynamic';

export interface OperationalStateInput {
  location: string;
  crowd: number;
  arrival_rate?: number;
  capacity_per_minute?: number;
  queue_growth?: number;
  density?: string;
  transport_conditions?: string;
  alternate_gates?: Array<{ gate?: string; route?: string; capacity_available?: number }>;
  accommodation_status?: string;
  alternative_accommodation?: Array<{ zone?: string; rooms_available?: number }>;
}

export interface AlignedAdvisoryOutput {
  risk: string;
  cause: string;
  recommended_action: string;
  priority: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  deadline_minutes: number;
  expected_effect: string;
  confidence: number;
}

const SYSTEM_PROMPT = `You are the Pravaah Crowd Safety AI — a domain-aligned model for mega-event crowd management.

You receive structured operational state data from the Pravaah simulation engine and produce structured JSON recommendations.

Your response MUST be valid JSON with these fields:
{
  "risk": "<short risk title>",
  "cause": "<root cause explanation>",
  "recommended_action": "<specific operational action>",
  "priority": "NONE | LOW | MEDIUM | HIGH | CRITICAL",
  "deadline_minutes": <integer>,
  "expected_effect": "<quantitative expected outcome>",
  "confidence": <0-100>
}

Rules:
- If the situation is safe (low density, normal queues), set priority to "NONE" and recommended_action to "Maintain routine monitoring".
- Never hallucinate density numbers — use only the values provided in the state input.
- Be specific about which gate, zone, corridor, or transport route to act on.
- Include quantitative expected outcomes (e.g., "reduces density from 5.9 to 3.2 p/m²").
- deadline_minutes must reflect urgency: CRITICAL < 5 min, HIGH 5-10 min, MEDIUM 10-20 min, LOW > 20 min.`;

// Local deterministic fallback when live API inference is offline/unavailable
function fallbackAdvisory(input: OperationalStateInput): AlignedAdvisoryOutput {
  const densityVal = parseFloat(input.density || '0');
  const queue = input.queue_growth || 0;

  if (densityVal >= 5.5 || queue >= 1200) {
    return {
      risk: `${input.location} — Critical Surge & Flow Blockade`,
      cause: `Arrival rate (${input.arrival_rate || 200}/min) exceeds capacity (${input.capacity_per_minute || 100}/min) with queue growth of ${queue} persons.`,
      recommended_action: input.alternate_gates?.[0]?.gate
        ? `Activate holding pen and redirect ingress flow to ${input.alternate_gates[0].gate}`
        : `Open auxiliary overflow lanes and delay station platform releases by 4 minutes`,
      priority: 'CRITICAL',
      deadline_minutes: 4,
      expected_effect: `Reduces peak density to safe threshold (<3.5 p/m²) within 7 minutes`,
      confidence: 96,
    };
  }

  if (densityVal >= 4.0 || queue >= 500) {
    return {
      risk: `${input.location} — Elevating Ingress Pressure`,
      cause: `Queue growth rate spiking ahead of scheduled main stage event.`,
      recommended_action: `Open secondary screening turnstiles and broadcast crowd dispersal announcements`,
      priority: 'HIGH',
      deadline_minutes: 8,
      expected_effect: `Stabilizes queue growth and prevents spillback onto access corridors`,
      confidence: 93,
    };
  }

  if (input.accommodation_status?.includes('90%') || input.accommodation_status?.includes('occupancy')) {
    return {
      risk: `Hotel District Capacity Saturation`,
      cause: input.accommodation_status,
      recommended_action: `Trigger accommodation valve nudges redirecting overflow to Kharghar & Panvel clusters`,
      priority: 'MEDIUM',
      deadline_minutes: 20,
      expected_effect: `Fills 3,500+ vacant rooms in neighboring clusters; prevents street stranding`,
      confidence: 91,
    };
  }

  return {
    risk: 'Safe Operational State',
    cause: 'Crowd density and ingress rates remain well within safety thresholds.',
    recommended_action: 'Maintain routine monitoring',
    priority: 'NONE',
    deadline_minutes: 0,
    expected_effect: 'Continuous nominal operations',
    confidence: 99,
  };
}

export async function POST(req: Request) {
  try {
    const input = (await req.json()) as OperationalStateInput;
    if (!input || !input.location) {
      return NextResponse.json({ ok: false, error: 'Invalid state input' }, { status: 400 });
    }

    const nugenOn = isNugenEnabled();
    const groqOn = llmEnabled();

    let advisory: AlignedAdvisoryOutput | null = null;
    let source: 'nugen' | 'llm' | 'fallback' = 'fallback';
    let confidenceScore: number | null = null;
    let modelUsed: string = 'pravaah-domain-rules';

    // 1. Mandatory Nugen Aligned Model Inference
    if (nugenOn) {
      const nugenRes = await nugenJSON<AlignedAdvisoryOutput>(SYSTEM_PROMPT, JSON.stringify(input));
      if (nugenRes && nugenRes.data && nugenRes.data.risk) {
        advisory = nugenRes.data;
        source = 'nugen';
        confidenceScore = nugenRes.confidenceScore ?? 95;
        modelUsed = nugenRes.model;
      }
    }

    // 2. Groq Fallback
    if (!advisory && groqOn) {
      const groqRes = (await groqJSON(SYSTEM_PROMPT, JSON.stringify(input))) as AlignedAdvisoryOutput | null;
      if (groqRes && groqRes.risk) {
        advisory = groqRes;
        source = 'llm';
        modelUsed = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
      }
    }

    // 3. Fallback Deterministic Domain Rule Engine
    if (!advisory) {
      advisory = fallbackAdvisory(input);
      source = 'fallback';
    }

    return NextResponse.json({
      ok: true,
      source,
      model: modelUsed,
      confidenceScore,
      advisory,
      alignmentMeta: {
        alignmentId: process.env.NUGEN_ALIGNMENT_ID || 'nugen-pravaah-alignment-v1',
        modelId: process.env.NUGEN_MODEL_ID || 'nugen-aligned-pravaah',
        domain: 'Event Crowd Dynamics, Gate Ingress & Safety Protocols',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
