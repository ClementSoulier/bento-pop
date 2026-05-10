import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Bungee, Fredoka, Yuji_Syuku } from 'next/font/google';
import './globals.css';
import { JsonLd } from '@/components/JsonLd';
import { organizationSchema, websiteSchema } from '@/lib/seo/structured-data';

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
    default: 'Bento Pop — Talk-show pop culture sur YouTube',
    template: '%s · Bento Pop',
  },
  description:
    'Bento Pop, le talk-show pop culture français animé par Dark Hifus. Émission YouTube hebdo (jeudi 18h) et podcast : cinéma, gaming, mangas et débats de société, en live depuis les plus grandes conventions.',
  applicationName: 'Bento Pop',
  generator: 'Next.js',
  category: 'entertainment',
  keywords: [
    'Bento Pop',
    'bento pop',
    'talk-show pop culture',
    'talk show pop culture',
    'émission pop culture',
    'émission YouTube',
    'talk-show YouTube',
    'talk show YouTube',
    'podcast pop culture',
    'pop culture France',
    'Dark Hifus',
    'cinéma',
    'gaming',
    'mangas',
    'animes',
    'webtoon',
    'K-culture',
    'conventions',
    'Japan Expo',
    'Paris Manga',
    'Comic Con',
  ],
  authors: [{ name: 'Bento Pop' }, { name: 'Dark Hifus' }],
  creator: 'Bento Pop',
  publisher: 'Liventure SAS',
  alternates: { canonical: '/' },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Bento Pop',
    title: 'Bento Pop — Talk-show pop culture sur YouTube',
    description:
      'Le talk-show pop culture français : cinéma, gaming, mangas et débats de société. Dark Hifus et sa bande, en live depuis les plus grandes conventions. Tous les jeudis 18h sur YouTube.',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bento Pop — Talk-show pop culture sur YouTube',
    description:
      'Talk-show pop culture FR · Cinéma, gaming, mangas, débats société · Live conventions · Jeudi 18h sur YouTube.',
    site: '@bentopop',
    creator: '@bentopop',
  },
  // PWA — ajoute les meta `apple-mobile-web-app-*` pour l'installation iOS
  // (Android lit directement le manifest pour ces réglages).
  appleWebApp: {
    capable: true,
    title: 'Bento Pop',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
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
      <body suppressHydrationWarning>
        <a href="#main" className="skip-link">
          Aller au contenu
        </a>
        <JsonLd data={[organizationSchema(), websiteSchema()]} />
        {children}
      </body>
    </html>
  );
}
