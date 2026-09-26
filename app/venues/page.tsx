import type { Metadata } from 'next';
import VenuesLoader from './VenuesLoader';

export const metadata: Metadata = { title: 'Pravaah · Any venue in 60 seconds' };

export default function Page() {
  return <VenuesLoader />;
}
