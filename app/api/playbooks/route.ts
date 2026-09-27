import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Serves the editable playbook table's raw CSV text (data/playbooks.csv isn't public) — parsed
 *  client-side by the same engine/csv.ts + engine/playbook.ts path everything else uses. */
export async function GET() {
  const text = await readFile(join(process.cwd(), 'data', 'playbooks.csv'), 'utf8');
  return NextResponse.json({ playbooks: text });
}
