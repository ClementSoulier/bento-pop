import type { ReactNode } from 'react';
import { Nav } from '@/sections/Nav/Nav';
import { Footer } from '@/sections/Footer/Footer';

type LegalPageProps = {
  eyebrow: string;
  title: string;
  updatedAt?: string;
  children: ReactNode;
};

/**
 * Squelette commun aux pages légales (mentions légales, confidentialité…).
 *
 * Garde le Nav sticky en haut + Footer en bas pour rester dans le parcours,
 * et applique une typo « prose » sobre adaptée à de longs textes statiques.
 */
export function LegalPage({ eyebrow, title, updatedAt, children }: LegalPageProps) {
  return (
    <>
      <Nav />
      <main id="main" tabIndex={-1} className="bg-bento-yellow px-7 pb-24 pt-16">
        <article className="mx-auto max-w-[760px]">
          <header className="mb-12">
            <p className="mb-3 inline-flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.3em] text-bento-ink">
              <span className="inline-block h-[3px] w-7 rounded-[3px] bg-bento-red" />
              {eyebrow}
            </p>
            <h1 className="font-display text-[clamp(36px,5vw,64px)] whitespace-pre-line">{title}</h1>
            {updatedAt ? (
              <p className="mt-3 text-[14px] text-bento-ink/65">
                Dernière mise à jour : {updatedAt}
              </p>
            ) : null}
          </header>
          <div className="legal-prose">{children}</div>
        </article>
      </main>
      <Footer />
    </>
  );
}
