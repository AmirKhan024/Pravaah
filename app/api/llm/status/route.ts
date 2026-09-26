import { NextResponse } from 'next/server';
import { getNugenConfig } from '@/lib/nugen';
import { llmEnabled } from '@/lib/groq';

export const dynamic = 'force-dynamic';

export async function GET() {
  const nugenConfig = getNugenConfig();
  const groqActive = llmEnabled();

  return NextResponse.json({
    ok: true,
    nugen: {
      ...nugenConfig,
      trainingCorpus: [
        'docs/nugen_alignment/pravaah_crowd_safety_sop.md',
        'docs/nugen_alignment/pravaah_scenario_patching.md',
      ],
      compliance: {
        hackathon: 'HackCelestial 3.0',
        requirement: 'Mandatory Nugen Intelligence Customization & Inference',
        pipeline: 'Base Model (qwen-v2p5-0p5b-instruct) -> Nugen Alignment (Crowd Dynamics Corpus) -> Domain Model -> Pravaah Inference',
      },
    },
    groqFallbackActive: groqActive,
  });
}
