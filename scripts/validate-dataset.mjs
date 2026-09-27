import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATASET_PATH = path.join(ROOT, 'docs', 'nugen_alignment', 'pravaah_nugen_dataset.json');

function validateDataset() {
  console.log('=' .repeat(60));
  console.log('  PRAVAAH — NUGEN DATASET VALIDATOR');
  console.log('=' .repeat(60));

  if (!fs.existsSync(DATASET_PATH)) {
    console.error(`[X] Error: Dataset file not found at ${DATASET_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(DATASET_PATH, 'utf-8');
  const items = JSON.parse(raw);

  let errors = 0;
  const categories = new Set();
  let safeCount = 0;

  items.forEach((item, idx) => {
    const id = item.id || `item_${idx}`;

    // Validate Input
    if (!item.input || !item.input.location || item.input.current_crowd === undefined) {
      console.error(`[X] ${id}: Invalid or missing INPUT structure`);
      errors++;
    }

    // Validate Analysis
    if (!item.analysis || !item.analysis.operational_problem || !item.analysis.cause_explanation) {
      console.error(`[X] ${id}: Invalid or missing ANALYSIS structure`);
      errors++;
    }

    // Validate Action
    if (!item.action) {
      console.error(`[X] ${id}: Missing ACTION field`);
      errors++;
    }

    // Validate Priority
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'NONE'];
    if (!validPriorities.includes(item.priority)) {
      console.error(`[X] ${id}: Invalid PRIORITY value '${item.priority}'`);
      errors++;
    }

    // Validate Deadline
    if (typeof item.deadline_minutes !== 'number') {
      console.error(`[X] ${id}: DEADLINE must be a number`);
      errors++;
    }

    // Validate Expected Effect
    if (!item.expected_effect) {
      console.error(`[X] ${id}: Missing EXPECTED_EFFECT`);
      errors++;
    }

    // Track safe examples
    if (item.action === 'NO_ACTION' || item.priority === 'NONE') {
      safeCount++;
    }

    categories.add(item.category);
  });

  console.log(`\nDataset File: ${DATASET_PATH}`);
  console.log(`Total Scenarios:         ${items.length}`);
  console.log(`Categories Covered:      ${categories.size}`);
  console.log(`Safe / No-Action Cases:  ${safeCount}`);
  console.log(`Validation Errors:       ${errors}`);

  if (errors === 0) {
    console.log('\n[✓] DATASET VALIDATION SUCCESSFUL — 100% SCHEMA COMPLIANT!');
  } else {
    console.error('\n[X] DATASET VALIDATION FAILED!');
    process.exit(1);
  }
}

validateDataset();
