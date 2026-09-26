import type { Metadata } from 'next';
import Visit from './Visit';

export const metadata: Metadata = { title: 'Pravaah · Your visit' };

export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <Visit roomId={decodeURIComponent(roomId).toUpperCase()} />;
}
