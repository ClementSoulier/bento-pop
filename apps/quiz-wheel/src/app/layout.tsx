import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Bungee, Fredoka } from 'next/font/google';
import './globals.css';

const extenda = localFont({
  src: '../../../../packages/brand/assets/fonts/extenda-100-yotta.otf',
  variable: '--font-extenda',
  display: 'swap',
  weight: '900',
});

const fredoka = Fredoka({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-fredoka',
  display: 'swap',
});

const bungee = Bungee({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-bungee',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Bento Pop · Quiz',
  description: 'Tirage au sort de jeu sur la boîte bento Bento Pop.',
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
      className={`${extenda.variable} ${fredoka.variable} ${bungee.variable}`}
    >
      {/*
        suppressHydrationWarning : certaines extensions navigateur (ColorZilla,
        Grammarly, Compose, …) injectent des attributs (`cz-shortcut-listen`,
        `data-new-gr-c-s-check-loaded`, …) sur <body> avant l'hydratation.
        Le DOM ne correspond plus au HTML serveur — React loggue un warning
        sans rien casser. On le fait taire localement, ciblé sur <body>.
      */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
