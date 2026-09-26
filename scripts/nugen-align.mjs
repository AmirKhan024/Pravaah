#!/usr/bin/env node
/**
 * Nugen Intelligence Model Alignment Script (Node.js) for Pravaah
 * HackCelestial 3.0 Mandatory Requirement
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env.local');
const API_URL = 'https://api.nugen.in/api/v3';

function readEnv() {
  const env = {};
  if (fs.existsSync(ENV_FILE)) {
    const lines = fs.readFileSync(ENV_FILE, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [k, ...v] = trimmed.split('=');
        env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  }
  return env;
}

function updateEnv(key, val) {
  let content = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf-8') : '';
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${val}`);
  } else {
    content += (content.endsWith('\n') || !content ? '' : '\n') + `${key}=${val}\n`;
  }
  fs.writeFileSync(ENV_FILE, content, 'utf-8');
}

async function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function main() {
  console.log('='.repeat(60));
  console.log('  PRAVAAH - NUGEN INTELLIGENCE MODEL ALIGNMENT');
  console.log('  HackCelestial 3.0 Mandatory Technology Pipeline');
  console.log('='.repeat(60));

  const env = readEnv();
  const apiKey = process.env.NUGEN_API_KEY || env.NUGEN_API_KEY;

  if (!apiKey) {
    console.error('\n[!] Error: NUGEN_API_KEY not set.');
    console.error('Please add NUGEN_API_KEY=your_key in .env.local or set it in your terminal.');
    console.error('Sign up here: https://nugen.in/signup?invite=PILLAIUNIV2026');
    process.exit(1);
  }

  const authHeader = { Authorization: `Bearer ${apiKey}` };

  // 1. Upload Domain Corpus
  const corpusDir = path.join(ROOT, 'docs', 'nugen_alignment');
  const files = fs.readdirSync(corpusDir).filter((f) => f.endsWith('.md'));
  console.log(`\n[1/4] Found ${files.length} domain document(s) in docs/nugen_alignment/`);

  const docIds = [];
  for (const filename of files) {
    console.log(`  -> Uploading: ${filename}`);
    const filePath = path.join(corpusDir, filename);
    const content = fs.readFileSync(filePath);
    const blob = new Blob([content], { type: 'text/markdown' });

    const form = new FormData();
    form.append('file', blob, filename);
    form.append('category', 'crowd_dynamics_safety');

    const res = await fetch(`${API_URL}/documents/upload`, {
      method: 'POST',
      headers: authHeader,
      body: form,
    });

    if (!res.ok) {
      console.error(`  [X] Upload failed (${res.status}):`, await res.text());
      continue;
    }

    const data = await res.json();
    const docId = data.document_id || (data.document_ids && data.document_ids[0]);
    if (docId) {
      console.log(`  [✓] Registered document ID: ${docId}`);
      docIds.push(docId);
    }
  }

  if (docIds.length === 0) {
    console.error('\n[X] Could not upload domain documents. Please check your API key.');
    process.exit(1);
  }

  // 2. Create Alignment Project
  console.log('\n[2/4] Triggering Domain Alignment Project...');
  const baseModel = 'qwen-v2p5-0p5b-instruct';
  const alignRes = await fetch(`${API_URL}/alignment-projects/create`, {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      alignment_name: 'Pravaah-Crowd-Safety-Alignment',
      base_model_id: baseModel,
      document_ids: docIds,
      description: 'Alignment for Pravaah event crowd safety and scenario simulation',
    }),
  });

  if (!alignRes.ok) {
    console.error(`[X] Alignment project creation failed (${alignRes.status}):`, await alignRes.text());
    process.exit(1);
  }

  const projectData = await alignRes.json();
  const alignmentId = projectData.alignment_id;
  console.log(`[✓] Alignment Project Created: ${alignmentId}`);
  updateEnv('NUGEN_ALIGNMENT_ID', alignmentId);

  // 3. Poll for Status
  console.log('\n[3/4] Aligning base model to Pravaah crowd domain...');
  let alignedModelId = null;
  const start = Date.now();

  while (true) {
    await sleep(10000);
    const sec = Math.round((Date.now() - start) / 1000);
    try {
      const pollRes = await fetch(`${API_URL}/alignment-projects/${alignmentId}/status`, {
        headers: authHeader,
      });
      if (pollRes.ok) {
        const stat = await pollRes.json();
        const status = (stat.status || 'UNKNOWN').toUpperCase();
        console.log(`  [${sec}s] Alignment status: ${status}`);

        if (status === 'COMPLETED' || status === 'READY' || status === 'SUCCESS') {
          alignedModelId = stat.model_id || stat.aligned_model_id;
          break;
        }
        if (status === 'FAILED' || status === 'ERROR') {
          console.error('[X] Alignment workflow failed:', stat);
          process.exit(1);
        }
      }
    } catch (e) {
      console.warn(`  Polling notice: ${e.message}`);
    }
  }

  console.log(`\n[✓] DOMAIN ALIGNMENT COMPLETE!`);
  console.log(`    Aligned Model ID: ${alignedModelId}`);
  updateEnv('NUGEN_MODEL_ID', alignedModelId);

  // 4. Test Live Inference
  console.log('\n[4/4] Verifying live inference with domain confidence score...');
  const testRes = await fetch(`${API_URL}/inference/chat/completions`, {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: alignedModelId,
      messages: [
        {
          role: 'system',
          content: 'You convert an event organiser\'s what-if question into a JSON scenario patch for a crowd simulator.',
        },
        { role: 'user', content: 'What if 20% more people come and it rains?' },
      ],
      temperature: 0,
    }),
  });

  if (testRes.ok) {
    const inf = await testRes.json();
    console.log('\n' + '='.repeat(60));
    console.log('  LIVE INFERENCE CONFIRMATION');
    console.log('='.repeat(60));
    console.log('Model ID:        ', alignedModelId);
    console.log('Confidence Score:', inf.confidence_score ? `${inf.confidence_score}%` : 'N/A');
    console.log('Sample Output:   ', inf.choices?.[0]?.message?.content);
    console.log('='.repeat(60));
    console.log('\nSetup fully completed! Pravaah is configured to use your Nugen-aligned model.');
  } else {
    console.log('Inference check returned status:', testRes.status);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
