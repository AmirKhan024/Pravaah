import type { Metadata } from 'next';
import ReportLoader from './ReportLoader';

export const metadata: Metadata = { title: 'Pravaah · After-event report' };

export default function Page() {
  return <ReportLoader />;
}
