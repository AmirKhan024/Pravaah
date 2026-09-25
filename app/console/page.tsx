import type { Metadata } from 'next';
import ConsoleLoader from './ConsoleLoader';

export const metadata: Metadata = { title: 'Pravaah · Organiser console' };

export default function Page() {
  return <ConsoleLoader />;
}
