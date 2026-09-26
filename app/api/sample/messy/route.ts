import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FILES: Record<string, string> = { csv: 'messy-export.csv', whatsapp: 'whatsapp-list.txt' };
const DIR = join(process.cwd(), 'data', 'sample', 'messy');

/** Serves the two bundled messy-registration fixtures' raw text — read server-side (data/ isn't
 *  public), parsed client-side by the same lib/registrations/parse.ts path a real paste/upload uses. */
export async function GET(req: Request) {
  const which = new URL(req.url).searchParams.get('which') || 'csv';
  const file = FILES[which];
  if (!file) return NextResponse.json({ ok: false, reason: 'unknown sample' }, { status: 400 });
  const text = await readFile(join(DIR, file), 'utf8');
  return NextResponse.json({ ok: true, text, filename: file });
}
