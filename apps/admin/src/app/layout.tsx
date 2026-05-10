import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Fredoka, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const extenda = localFont({
  src: '../../../../packages/brand/assets/fonts/extenda-100-yotta.otf',
  variable: '--font-extenda',
  display: 'swap',
  weight: '900',
});

const fredoka = Fredoka({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-fredoka',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Bento Pop · Admin',
    template: '%s · Admin',
  },
  description: 'Backoffice de bento-pop.com — pilotage agenda, sondages, équipe, liens.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1a1a1a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${extenda.variable} ${fredoka.variable} ${jetbrains.variable}`}
    >
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
