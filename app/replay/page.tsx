import type { Metadata } from 'next';
import ReplayLoader from './ReplayLoader';

export const metadata: Metadata = { title: 'Pravaah · 4 June 2025, a reconstruction' };

export default function Page() {
  return <ReplayLoader />;
}
