import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Bungee, Fredoka, Yuji_Syuku } from 'next/font/google';
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

const bungee = Bungee({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-bungee',
  display: 'swap',
});

const yujiSyuku = Yuji_Syuku({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-yuji-syuku',
  display: 'swap',
});

// `||` (et pas `??`) pour traiter aussi la chaîne vide comme « non défini » :
// au build Docker, un ARG non transmis devient une ENV "" et casserait `new URL("")`.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bento-pop.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Bento Pop · Le Talk-Show Pop Culture',
    template: '%s · Bento Pop',
  },
  description:
    'Bento Pop : le talk-show pop culture qui parcourt la France. Cinéma, gaming, mangas et débats de société, en live depuis les plus grandes conventions.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Bento Pop',
    title: 'Bento Pop · Le Talk-Show Pop Culture',
    description:
      'Cinéma, gaming, mangas et débats de société. Dark Hifus et sa bande, en live depuis les plus grandes conventions.',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bento Pop · Le Talk-Show Pop Culture',
    description:
      'Cinéma, gaming, mangas et débats de société. En live depuis les plus grandes conventions.',
  },
  // PWA — ajoute les meta `apple-mobile-web-app-*` pour l'installation iOS
  // (Android lit directement le manifest pour ces réglages).
  appleWebApp: {
    capable: true,
    title: 'Bento Pop',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#fbbf24',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${extenda.variable} ${fredoka.variable} ${bungee.variable} ${yujiSyuku.variable}`}
    >
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
