import type { Metadata } from 'next';
import SetupLoader from './SetupLoader';

export const metadata: Metadata = { title: 'Pravaah · Give it your event' };

export default function Page() {
  return <SetupLoader />;
}
