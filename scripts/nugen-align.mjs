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
  console.log('  PRAVAAH — NUGEN INTELLIGENCE MODEL ALIGNMENT');
  console.log('  HackCelestial 3.0 Mandatory Technology Pipeline');
  console.log('='.repeat(60));

  const env = readEnv();
  const apiKey = process.env.NUGEN_API_KEY || env.NUGEN_API_KEY;

  if (!apiKey) {
    console.error('\n[!] Error: NUGEN_API_KEY not set in .env.local or environment.');
    process.exit(1);
  }

  updateEnv('NUGEN_API_KEY', apiKey);
  const authHeader = { Authorization: `Bearer ${apiKey}` };

  // 1. Upload Pravaah Domain Dataset
  const datasetPath = path.join(ROOT, 'docs', 'nugen_alignment', 'pravaah_nugen_dataset.json');
  if (!fs.existsSync(datasetPath)) {
    console.error(`[!] Error: Dataset file not found at ${datasetPath}`);
    process.exit(1);
  }

  console.log(`\n[1/4] Uploading Pravaah domain dataset (${datasetPath})...`);
  const content = fs.readFileSync(datasetPath);
  const blob = new Blob([content], { type: 'application/json' });

  const form = new FormData();
  form.append('files', blob, 'pravaah_nugen_dataset.json');

  const uploadRes = await fetch(`${API_URL}/documents/create`, {
    method: 'POST',
    headers: authHeader,
    body: form,
  });

  if (!uploadRes.ok) {
    console.error(`  [X] Upload failed (${uploadRes.status}):`, await uploadRes.text());
    process.exit(1);
  }

  const uploadData = await uploadRes.json();
  const docId = uploadData.document_ids?.[0];
  console.log(`  [✓] Registered Nugen Document ID: ${docId}`);

  // 2. Create Alignment Project
  console.log('\n[2/4] Triggering Domain Alignment Project...');
  const baseModel = 'llama-v3p2-3b-reasoning';
  const alignRes = await fetch(`${API_URL}/alignment-projects/create`, {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      alignment_name: 'Pravaah-Crowd-Safety-Alignment',
      base_model_id: baseModel,
      document_ids: [docId],
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
    await sleep(5000);
    const sec = Math.round((Date.now() - start) / 1000);
    try {
      const pollRes = await fetch(`${API_URL}/alignment-projects/${alignmentId}/status`, {
        headers: authHeader,
      });
      if (pollRes.ok) {
        const stat = await pollRes.json();
        const status = (stat.status || 'UNKNOWN').toUpperCase();
        console.log(`  [${sec}s] Alignment status: ${status} ${stat.queue_position ? `(Queue: ${stat.queue_position})` : ''}`);

        if (status === 'COMPLETED' || status === 'READY' || status === 'SUCCESS') {
          alignedModelId = stat.model_id || stat.aligned_model_id || `nugen-${alignmentId}`;
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

  console.log('\nSetup fully completed! Pravaah is configured to use your Nugen-aligned model.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
