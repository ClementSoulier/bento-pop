import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { BentoAttributions } from '@/components/bento/BentoAttributions';
import { BentoIdentity } from '@/components/bento/BentoIdentity';
import {
  BentoCallToAction,
  BentoPageShell,
  BentoReportLink,
} from '@/components/bento/BentoPageShell';
import { PublicBentoGrid } from '@/components/bento/PublicBentoGrid';
import { bentoPath } from '@/lib/bento/metadata';
import type { FeaturedBento, PublicBento } from '@/lib/bento/queries';
import { mainBentoCases } from './cases';

/**
 * Le rendu d'une page publique de bento, partagé par les deux routes.
 *
 * `/u/<pseudo>` est la page du compte : son contenu principal est le bento
 * principal, affiché en entier, et les autres bentos sont accessibles en
 * dessous de l'identité. `/u/<pseudo>/<slug>` est la page d'un bento nommé.
 * Les deux rendent la même chose, à la liste près.
 *
 * Extrait de `u/[pseudo]/page.tsx` au chantier 16 : les deux routes doivent
 * rendre exactement la même page, et un rendu dupliqué aurait divergé au
 * premier ajustement.
 */

const CALL_TO_ACTION_BLURB =
  'Six cases, six choix : ton film, ta série, ton artiste, ta chanson, ton créateur et ton lieu. Gratuit, sans compte à créer.';

/** Le compte existe, son bento n'est pas en ligne. */
export function BentoUnpublishedView({
  pseudo,
  displayName,
}: {
  pseudo: string;
  displayName: string | null;
}) {
  return (
    <BentoPageShell pseudo={pseudo}>
      <div className="mx-auto max-w-[1180px]">
        <div className="mx-auto max-w-[420px]">
          <BentoIdentity
            pseudo={pseudo}
            displayName={displayName}
            subtitle="bento en cours de préparation"
          />
          <div className="mt-6">
            {/* La boîte vide plutôt qu'un message seul : elle montre ce
                qui va arriver, et donne une raison de revenir. Aucune
                donnée du bento non publié n'est lisible ici, la RLS
                l'interdit au client anonyme. */}
            <PublicBentoGrid cases={mainBentoCases({})} label={`Bento de @${pseudo}, pas encore terminé`} empty />
          </div>
          <p className="mt-6 text-center text-[15px] leading-[1.55] text-bento-ink/80">
            <span className="font-display block text-[clamp(20px,5vw,26px)] text-bento-ink">
              Ce bento n&apos;est pas encore terminé !
            </span>
            <span className="mt-2 block">
              @{pseudo} n&apos;a pas fini de garnir sa boîte. Repasse dans quelques jours, elle
              apparaîtra ici.
            </span>
          </p>
          <BentoCallToAction
            heading="Compose le tien"
            blurb="Six cases, six choix : ton film, ta série, ton artiste, ta chanson, ton créateur et ton lieu."
          />
        </div>
      </div>
    </BentoPageShell>
  );
}

/**
 * Les autres bentos du compte, sous l'identité.
 *
 * Ne rend rien tant qu'un compte n'a qu'un bento, ce qui est le cas de tous
 * au 16 septembre 2026 : aucune page existante ne change d'aspect. Le libellé
 * est le slug, seule chose qu'un bento porte aujourd'hui ; le chantier 13 lui
 * donnera un titre.
 */
function OtherBentos({ others }: { others: readonly FeaturedBento[] }) {
  if (others.length === 0) return null;
  return (
    <nav aria-label="Les autres bentos de ce compte" className="mt-5">
      <ul className="flex flex-wrap gap-2">
        {others.map((other) => (
          <li key={`${other.pseudo}/${other.slug}`}>
            <Link
              href={bentoPath(other.pseudo, other.isPrimary ? null : other.slug)}
              className="font-display inline-block rounded-full border-[2.5px] border-bento-ink bg-bento-cream px-3.5 py-1.5 text-[13px] tracking-wide text-bento-ink shadow-stamp"
            >
              {other.slug}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Le bento demandé est en ligne. */
export function BentoPublishedView({
  bento,
  others,
  canonicalUrl,
}: {
  bento: PublicBento;
  others: readonly FeaturedBento[];
  canonicalUrl: string;
}) {
  return (
    <BentoPageShell pseudo={bento.pseudo}>
      {/* Données structurées uniquement sur les pages indexables : décrire
          finement une page en `noindex` n'apporte rien et brouille le
          signal envoyé aux moteurs. */}
      {bento.isFeatured ? (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            url: canonicalUrl,
            dateCreated: bento.publishedAt,
            mainEntity: {
              '@type': 'Person',
              name: bento.displayName ?? `@${bento.pseudo}`,
              alternateName: `@${bento.pseudo}`,
              url: canonicalUrl,
            },
          }}
        />
      ) : null}

      {/*
        Trois éléments de grille, et **un seul** bloc d'identité.
        La première version le rendait deux fois, masqué par `lg:hidden`
        d'un côté et `hidden lg:block` de l'autre : deux `<h1>` dans le
        document, tous deux annoncés par un lecteur d'écran. Le placement
        explicite donne la même mise en page sans duplication.

        Mobile : identité, boîte, appel à l'action, dans l'ordre du DOM.
        Desktop : boîte à gauche sur deux rangées, identité puis appel à
        l'action empilés à droite. Colonnes bornées et centrées, sinon la
        colonne de droite s'étire et le bouton flotte au milieu du vide.
      */}
      <div className="mx-auto grid max-w-[940px] items-start gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,460px)] lg:grid-rows-[auto_1fr] lg:justify-center lg:gap-x-16 lg:gap-y-8">
        <div className="lg:col-start-2 lg:row-start-1">
          <BentoIdentity
            pseudo={bento.pseudo}
            displayName={bento.displayName}
            publishedAt={bento.publishedAt}
            isFeatured={bento.isFeatured}
            isGuest={bento.isGuest}
          />
          <OtherBentos others={others} />
        </div>

        <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <PublicBentoGrid cases={mainBentoCases(bento.slots)} label={`Les six choix de @${bento.pseudo}`} />
        </div>

        <div className="lg:col-start-2 lg:row-start-2">
          <BentoCallToAction heading="Compose le tien" blurb={CALL_TO_ACTION_BLURB} />
        </div>
      </div>

      {/* Les crédits viennent APRÈS l'appel à l'action. Placés juste sous la
          boîte, leurs six lignes repoussaient le seul bouton de la page
          hors de l'écran sur mobile. Ils restent complets et lisibles,
          simplement à leur juste priorité. */}
      <BentoAttributions slots={bento.slots} />
      <BentoReportLink pseudo={bento.pseudo} />
    </BentoPageShell>
  );
}
