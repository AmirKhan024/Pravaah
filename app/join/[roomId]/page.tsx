import type { Metadata } from 'next';
import Phone from './Phone';

export const metadata: Metadata = { title: 'Pravaah · You are in the crowd' };

export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <Phone roomId={decodeURIComponent(roomId).toUpperCase()} />;
}
