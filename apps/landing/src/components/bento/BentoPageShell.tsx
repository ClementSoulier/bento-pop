import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import logo from '@bento-pop/brand/assets/logo/bento-pop.png';
import { Footer } from '@/sections/Footer/Footer';
import { StampLink } from '@/components/StampButton';
import { APP_STORE_URL, PLAY_STORE_URL, appDeepLink } from '@/lib/bento/stores';

/**
 * Habillage commun aux trois états de `/u/[pseudo]` : bento publié, bento
 * pas encore terminé, et page introuvable.
 *
 * **Pas de `<Nav />`.** Le visiteur type arrive d'un lien partagé dans une
 * messagerie, sur mobile, pour voir le bento d'un proche. Le nav complet du
 * site pousserait ce contenu hors de l'écran et proposerait des
 * destinations qui ne l'intéressent pas encore. On garde une barre
 * minimale : le logo, cliquable, qui suffit à situer la marque.
 *
 * Le `<Footer />` standard est conservé, pour les obligations légales et la
 * cohérence de site.
 */
export function BentoPageShell({
  children,
  pseudo,
}: {
  children: ReactNode;
  /** Absent sur la page introuvable : pas de lien profond à proposer. */
  pseudo?: string;
}) {
  return (
    <>
      {/*
        Le `body` porte un `padding-top` de 76px pour compenser le nav en
        position fixe des autres pages. Ici il n'y a pas de nav : sans cette
        marge négative, on perdrait 76px avant le bento, c'est-à-dire
        exactement ce qui décide qu'il soit visible ou non sans scroller.
      */}
      <div style={{ marginTop: 'calc(-1 * var(--bp-nav-height))' }}>
        <header className="mx-auto flex max-w-[1180px] items-center justify-between px-5 pb-2 pt-5 md:px-7">
          <Link href="/" aria-label="Accueil Bento Pop">
            <Image src={logo} alt="Bento Pop" priority className="h-auto w-[112px]" />
          </Link>
          {pseudo ? (
            <a
              href={appDeepLink(pseudo)}
              className="font-body text-[12px] font-bold uppercase tracking-[0.14em] text-bento-ink/65 underline underline-offset-4 hover:text-bento-ink"
            >
              Ouvrir dans l&apos;app
            </a>
          ) : null}
        </header>

        <main id="main" tabIndex={-1} className="bg-bento-yellow px-5 pb-16 pt-4 md:px-7">
          {children}
        </main>
      </div>
      <Footer />
    </>
  );
}

/**
 * Bloc de conversion, l'unique appel à l'action de la page.
 *
 * Les deux magasins sont affichés côte à côte plutôt que détectés : lire le
 * `user-agent` rendrait la page dynamique et supprimerait l'ISR, pour un
 * gain marginal. Le cas iOS est de toute façon traité gratuitement par la
 * bannière Smart App de Safari (cf. `stores.ts`).
 *
 * Libellés textuels et non badges officiels : les visuels d'Apple et de
 * Google ne sont pas dans le paquet de marque, et une reproduction
 * approximative poserait un problème de conformité. Les remplacer par les
 * badges officiels plus tard ne touchera que ce composant.
 */
export function BentoCallToAction({ heading, blurb }: { heading: string; blurb: string }) {
  return (
    <section
      aria-labelledby="bento-cta"
      className="mx-auto mt-10 w-full max-w-[420px] rounded-[24px] border-[4px] border-bento-ink bg-bento-cream p-5 shadow-stamp lg:mt-0 lg:max-w-none"
    >
      <h2 id="bento-cta" className="font-display text-[clamp(22px,4vw,30px)] text-bento-ink">
        {heading}
      </h2>
      <p className="mt-2 text-[14px] leading-[1.5] text-bento-ink/80">{blurb}</p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <StampLink
          href={APP_STORE_URL}
          variant="primary"
          target="_blank"
          rel="noopener noreferrer"
        >
          Sur l&apos;App Store
        </StampLink>
        <StampLink href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
          Sur Google Play
        </StampLink>
      </div>
    </section>
  );
}

/**
 * Lien de signalement.
 *
 * La page publie du contenu utilisateur sur le domaine de la marque : il
 * faut un chemin de signalement accessible sans compte. Un `mailto`
 * pré-rempli est le minimum viable, cohérent avec le `submitReport` de
 * l'app, et ne demande aucune infrastructure.
 */
export function BentoReportLink({ pseudo }: { pseudo: string }) {
  const subject = encodeURIComponent(`Signalement du bento @${pseudo}`);
  const body = encodeURIComponent(
    `Bonjour,\n\nJe signale le bento publié à l'adresse https://bento-pop.com/u/${pseudo}.\n\nMotif :\n`,
  );
  return (
    <p className="mt-10 text-center text-[12px] text-bento-ink/60">
      Un contenu inapproprié ?{' '}
      <a
        href={`mailto:contact@bento-pop.com?subject=${subject}&body=${body}`}
        className="underline underline-offset-[3px] hover:text-bento-ink"
      >
        Signaler ce bento
      </a>
    </p>
  );
}
