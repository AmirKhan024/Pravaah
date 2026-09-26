import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FILES = ['event', 'gates', 'tickets', 'arrivals', 'hotels', 'resources'] as const;
const DIR = join(process.cwd(), 'data', 'sample', 'dy-patil');

/** Serves the bundled illustrative fixture's raw CSV text — read server-side (data/ isn't public),
 *  parsed client-side by the same engine/csv.ts + engine/dataLoader.ts path a real upload uses. */
export async function GET() {
  const out: Record<string, string> = {};
  for (const f of FILES) out[f] = await readFile(join(DIR, f + '.csv'), 'utf8');
  return NextResponse.json(out);
}
