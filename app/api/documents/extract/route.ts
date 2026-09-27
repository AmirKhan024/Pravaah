import { NextResponse } from 'next/server';
import { PDFParse } from 'pdf-parse';

export const dynamic = 'force-dynamic';

interface Body {
  filename: string;
  /** base64-encoded file bytes — nothing is written to disk; extraction happens in memory */
  base64: string;
}

const MAX_BYTES = 8 * 1024 * 1024;

/** Step A (SOURCE_OF_TRUTH's own "deterministic first" rule): extract text from an uploaded
 *  safety-document file. .txt is decoded as-is; .pdf is parsed with pdf-parse (a real, offline
 *  PDF text extractor — "PDF if a parser dependency exists or is trivial," per the brief; adding
 *  it turned out to be exactly that). Nothing here reads or interprets a number — that's Step B/C. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || typeof body.base64 !== 'string' || !body.filename) return NextResponse.json({ ok: false, reason: 'bad request' }, { status: 400 });
  let buf: Buffer;
  try {
    buf = Buffer.from(body.base64, 'base64');
  } catch {
    return NextResponse.json({ ok: false, reason: 'could not decode the file' });
  }
  if (buf.byteLength > MAX_BYTES) return NextResponse.json({ ok: false, reason: 'file is too large (max 8MB)' });

  const isPdf = /\.pdf$/i.test(body.filename) || (buf.length > 4 && buf.subarray(0, 4).toString('ascii') === '%PDF');
  try {
    if (isPdf) {
      const parser = new PDFParse({ data: buf });
      const result = await parser.getText();
      await parser.destroy?.();
      const text = (result.text || '').trim();
      if (!text) return NextResponse.json({ ok: false, reason: 'could not find any text in that PDF (it may be a scanned image with no text layer)' });
      return NextResponse.json({ ok: true, text });
    }
    const text = buf.toString('utf8').trim();
    if (!text) return NextResponse.json({ ok: false, reason: 'that file was empty' });
    return NextResponse.json({ ok: true, text });
  } catch {
    return NextResponse.json({ ok: false, reason: 'could not read that file — try pasting the text instead' });
  }
}
