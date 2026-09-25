import { NextResponse } from 'next/server';
import os from 'node:os';

export const dynamic = 'force-dynamic';

/** LAN addresses of the demo laptop, so phones on the same Wi-Fi can reach The Room */
export async function GET() {
  const out: string[] = [];
  for (const list of Object.values(os.networkInterfaces()))
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254')) out.push(a.address);
  // prefer typical home/venue Wi-Fi ranges
  out.sort((a, b) => Number(b.startsWith('192.168')) - Number(a.startsWith('192.168')));
  return NextResponse.json({ ips: out });
}
