import type { Metadata, Viewport } from 'next';
import { Inter, Instrument_Serif, JetBrains_Mono, Noto_Sans_Devanagari } from 'next/font/google';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';
import { THEME_BOOTSTRAP } from '@/lib/theme';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jbmono', display: 'swap' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });
const deva = Noto_Sans_Devanagari({ subsets: ['devanagari'], weight: ['400', '500', '600'], variable: '--font-deva', display: 'swap' });

export const metadata: Metadata = {
  title: 'Pravaah — rehearse the evening before it happens',
  description:
    'A flight simulator for event organisers. Pravaah rehearses the whole evening, finds the minute the crowd will break, proves the cause, tests every fix, and tells you how long you have left to act.',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#f5f2ec',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${mono.variable} ${serif.variable} ${deva.variable}`}>
      <head>
        {/* runs before paint so the stored theme applies with no flash — see lib/theme.ts */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
