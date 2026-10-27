import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { BentoAchievements } from '@/components/bento/BentoAchievements';
import { BentoAttributions } from '@/components/bento/BentoAttributions';
import { BentoWhys } from '@/components/bento/BentoWhys';
import { BentoIdentity, formatPublishedDate } from '@/components/bento/BentoIdentity';
import {
  BentoCallToAction,
  BentoPageShell,
  BentoReportLink,
} from '@/components/bento/BentoPageShell';
import { PublicBentoGrid } from '@/components/bento/PublicBentoGrid';
import { VisitBeacon } from '@/components/bento/VisitBeacon';
import { bentoPath } from '@/lib/bento/metadata';
import { otherBentoTitle } from '@/lib/bento/others';
import type { FollowCounts, OtherBento, PublicBento, SocialLinks } from '@/lib/bento/queries';
import type { ShownAchievement } from '@bento-pop/supabase-mobile/bento';
import { mainBentoCases, publicCases } from './cases';

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
  avatar,
}: {
  pseudo: string;
  displayName: string | null;
  avatar: string | null;
}) {
  return (
    <BentoPageShell pseudo={pseudo}>
      <div className="mx-auto max-w-[1180px]">
        <div className="mx-auto max-w-[420px]">
          <BentoIdentity
            pseudo={pseudo}
            avatar={avatar}
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
 * est le titre de l'édition pour un bento d'édition, chantier 13, et le slug
 * pour un bento libre, seule chose qu'il porte. Depuis le chantier 21, la
 * bande résume la liste sous la boîte : même ordre, mêmes titres, « Bento
 * principal » compris, comme dans l'app.
 */
function OtherBentos({ others }: { others: readonly OtherBento[] }) {
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
              {otherBentoTitle(other)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Les autres bentos du compte, en entier, sous la page (chantier 21, D1, D2,
 * D9), comme dans l'app : chacun sous son titre et sa date, le titre menant à
 * sa page, et toute la boîte avec lui. Ses crédits d'images sous lui.
 *
 * Rien tant que le compte n'a qu'un bento : la page ne change pas d'un point.
 */
function AccountBentoList({ others }: { others: readonly OtherBento[] }) {
  if (others.length === 0) return null;
  return (
    <section
      aria-labelledby="autres-bentos"
      className="mx-auto mt-16 w-full max-w-[420px] lg:max-w-[940px]"
    >
      <h2
        id="autres-bentos"
        className="font-display-sm text-[10px] tracking-[0.18em] text-bento-ink/70"
      >
        Ses autres bentos
      </h2>
      <ul className="mt-6 grid gap-14 lg:grid-cols-2 lg:gap-x-16">
        {others.map((other) => {
          const title = otherBentoTitle(other);
          const cases = publicCases(other.cases, other.slots);
          return (
            <li key={other.id}>
              {/* Le lien porte le seul titre, et s'étend sur la boîte : un
                  lien qui engloberait la grille serait lu case par case. */}
              <div className="relative">
                <h3 className="font-display text-[clamp(20px,5vw,24px)] text-bento-ink">
                  <Link
                    href={bentoPath(other.pseudo, other.isPrimary ? null : other.slug)}
                    className="after:absolute after:inset-0 after:content-['']"
                  >
                    {title}
                  </Link>
                </h3>
                <p className="mt-1 text-[14px] leading-[1.5] text-bento-ink/70">
                  publié le <time dateTime={other.publishedAt}>{formatPublishedDate(other.publishedAt)}</time>
                </p>
                <div className="mt-4">
                  <PublicBentoGrid cases={cases} label={`${title}, un bento de @${other.pseudo}`} />
                </div>
              </div>
              <BentoAttributions
                cases={cases}
                headingId={`credits-${other.id}`}
                headingLevel="h4"
                className="mt-6"
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Le bento demandé est en ligne. */
export function BentoPublishedView({
  bento,
  others,
  visits,
  follows = null,
  links = null,
  achievements = [],
  canonicalUrl,
}: {
  bento: PublicBento;
  others: readonly OtherBento[];
  /**
   * Le compteur de visites, celui du rendu de la page, donc vieux de 5
   * minutes au plus ; `null` quand son propriétaire le masque. Chantier 8.
   */
  visits: number | null;
  /** Les nombres d'abonnés, de même ; `null` avant la migration. Chantier 23 (D16). */
  follows?: FollowCounts | null;
  /** Ses réseaux, de même ; `null` sans lien ou avant la migration. Chantier 25 (D15). */
  links?: SocialLinks | null;
  /** Ses succès, de même ; vides sans succès ou avant la migration. Chantier 27 (D13). */
  achievements?: readonly ShownAchievement[];
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
            avatar={bento.avatar}
            displayName={bento.displayName}
            publishedAt={bento.publishedAt}
            {...(bento.edition
              ? {
                  // Le titre de l'édition passe devant la date : sans lui, on
                  // ne comprend pas pourquoi cette boîte n'a pas les cases du
                  // bento principal.
                  subtitle: `${bento.edition.title}, publié le ${new Intl.DateTimeFormat('fr-FR', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  }).format(new Date(bento.publishedAt))}`,
                }
              : {})}
            isFeatured={bento.isFeatured}
            isGuest={bento.isGuest}
            visits={visits}
            follows={follows}
            links={links}
          />
          <OtherBentos others={others} />
          <VisitBeacon bentoId={bento.id} />
        </div>

        <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <PublicBentoGrid cases={publicCases(bento.cases, bento.slots)} label={`Les six choix de @${bento.pseudo}`} />
        </div>

        <div className="lg:col-start-2 lg:row-start-2">
          <BentoCallToAction heading="Compose le tien" blurb={CALL_TO_ACTION_BLURB} />
        </div>
      </div>

      {/* Les crédits viennent APRÈS l'appel à l'action. Placés juste sous la
          boîte, leurs six lignes repoussaient le seul bouton de la page
          hors de l'écran sur mobile. Ils restent complets et lisibles,
          simplement à leur juste priorité. Avant la liste des autres
          bentos, qui ont chacun les leurs : les crédits restent près de
          leurs images. */}
      <BentoWhys cases={publicCases(bento.cases, bento.slots)} whys={bento.whys} />
      <BentoAttributions cases={publicCases(bento.cases, bento.slots)} />
      <BentoAchievements achievements={achievements} />
      <AccountBentoList others={others} />
      <BentoReportLink pseudo={bento.pseudo} />
    </BentoPageShell>
  );
}
