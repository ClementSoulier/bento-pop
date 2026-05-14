import type { Metadata } from 'next';
import Link from 'next/link';
import { Nav } from '@/sections/Nav/Nav';
import { Footer } from '@/sections/Footer/Footer';
import { Eyebrow } from '@/components/Eyebrow';
import { StampLink } from '@/components/StampButton';

export const metadata: Metadata = {
  title: 'Page introuvable',
  description: "Cette page n'existe pas ou a été déplacée.",
  // Explicite, mais Next.js noindex déjà les 404 par défaut. On le garde
  // pour la cohérence et pour éviter toute ambiguïté côté crawlers.
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <Nav />
      <main
        id="main"
        tabIndex={-1}
        className="grid min-h-[70vh] place-items-center bg-bento-yellow px-5 py-20 md:px-7"
      >
        <div className="mx-auto max-w-[640px] text-center">
          <Eyebrow>Erreur 404</Eyebrow>
          <h1 className="font-display mt-4 text-[clamp(48px,8vw,96px)] leading-none text-bento-ink">
            Bentro… euh, perdu ?
          </h1>
          <p className="mt-6 text-[17px] leading-[1.5] text-bento-ink/75 text-pretty">
            La page que tu cherches n&apos;existe pas (ou plus). Pas de panique —
            on te ramène à la maison.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <StampLink href="/" variant="primary" size="lg">
              Retour à l&apos;accueil
            </StampLink>
            <StampLink href="/emissions">Voir les émissions</StampLink>
            <StampLink href="/podcasts">Voir les podcasts</StampLink>
          </div>
          <p className="mt-12 font-mono text-[11px] uppercase tracking-[0.2em] text-bento-ink/50">
            Si tu pensais arriver quelque part en particulier,{' '}
            <Link href="mailto:contact@bento-pop.com" className="underline hover:text-bento-ink">
              écris-nous
            </Link>
            .
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
