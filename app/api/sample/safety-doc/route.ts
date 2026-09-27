import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Serves the bundled, clearly-labelled SAMPLE safety document's raw text (data/ isn't public) —
 *  so the /owner/documents demo works in 10 seconds with no upload needed. */
export async function GET() {
  const text = await readFile(join(process.cwd(), 'data', 'sample', 'safety-doc.txt'), 'utf8');
  return NextResponse.json({ text });
}
