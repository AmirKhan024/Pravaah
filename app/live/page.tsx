import type { Metadata } from 'next';
import LiveLoader from './LiveLoader';

export const metadata: Metadata = { title: 'Pravaah · Live Ops' };

export default function Page() {
  return <LiveLoader />;
}
