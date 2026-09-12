import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { JsonLd } from '@/components/JsonLd';
import { BentoAttributions } from '@/components/bento/BentoAttributions';
import { BentoIdentity } from '@/components/bento/BentoIdentity';
import {
  BentoCallToAction,
  BentoPageShell,
  BentoReportLink,
} from '@/components/bento/BentoPageShell';
import { PublicBentoGrid } from '@/components/bento/PublicBentoGrid';
import { bentoDescription, bentoPath, bentoRobots, bentoTitle } from '@/lib/bento/metadata';
import { canonicalPseudo, needsCanonicalRedirect } from '@/lib/bento/pseudo';
import { listFeaturedPseudos, lookupPublicBento } from '@/lib/bento/queries';
import { smartAppBanner } from '@/lib/bento/stores';

/**
 * Bento public partageable — la cible des liens produits par l'app.
 *
 * C'est la page qui manquait : `shareBento()` côté mobile partage
 * `https://bento-pop.com/u/<pseudo>`, et jusqu'ici cette adresse renvoyait
 * un 404, sans aperçu dans les messageries. Chaque partage réussi était une
 * acquisition perdue.
 */

/**
 * 5 minutes. Un bento change rarement ; le rendu à la demande ferait payer
 * un aller-retour Supabase à chaque robot d'aperçu social et à chaque
 * partage viral. La revalidation à la demande via `POST /api/revalidate`
 * accepte déjà `{ paths: ["/u/<pseudo>"] }` si on veut supprimer cette
 * fenêtre plus tard.
 */
export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://bento-pop.com';

/**
 * Déduplication à l'échelle de la requête.
 *
 * `generateMetadata` et le composant de page ont tous deux besoin du bento.
 * Sans `cache()`, Next appellerait Supabase deux fois par rendu : la
 * déduplication automatique de Next ne couvre que `fetch()`, pas une
 * fonction asynchrone quelconque.
 */
const getBento = cache(lookupPublicBento);

/**
 * Pré-rend les bentos mis en avant au build. Les autres sont générés à la
 * demande puis mis en cache (`dynamicParams` vaut `true` par défaut).
 */
export async function generateStaticParams() {
  const pseudos = await listFeaturedPseudos();
  // En minuscules : c'est la forme canonique des URL, donc la seule
  // qu'il serve à pré-rendre.
  return pseudos.map((pseudo) => ({ pseudo: canonicalPseudo(pseudo) }));
}

type PageProps = { params: Promise<{ pseudo: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { pseudo: requested } = await params;

  // La page redirigera ; inutile de composer des métadonnées, et surtout
  // inutile d'interroger la base pour une URL qu'on va abandonner.
  if (needsCanonicalRedirect(requested)) return {};

  const lookup = await getBento(requested);

  if (lookup.kind === 'not-found') {
    return { title: 'Bento introuvable', robots: { index: false, follow: true } };
  }

  const canonicalPath = bentoPath(requested);
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  // La bannière Smart App de Safari : gratuite, native, et elle gère seule
  // « Ouvrir » ou « Obtenir » selon que l'app est installée.
  const other = { 'apple-itunes-app': smartAppBanner(canonicalUrl) };

  if (lookup.kind === 'unpublished') {
    const title = bentoTitle(lookup.pseudo);
    const description = `@${lookup.pseudo} n'a pas encore terminé son bento pop culture. Reviens bientôt.`;
    return {
      title,
      description,
      alternates: { canonical: canonicalPath },
      // Une page en 200 sans contenu réel serait lue comme un « soft 404 »
      // par Google. Le `noindex` supprime le problème à la racine.
      robots: { index: false, follow: true },
      openGraph: { type: 'profile', title, description, url: canonicalPath },
      twitter: { card: 'summary_large_image', title, description },
      other,
    };
  }

  const { bento } = lookup;
  const title = bentoTitle(bento.pseudo);
  const description = bentoDescription(bento.pseudo, bento.slots);

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    // `noindex` sauf pour les bentos curés par l'équipe, cf. spec §8. Les
    // aperçus Open Graph fonctionnent indépendamment de cette directive.
    robots: bentoRobots(bento.isFeatured),
    openGraph: { type: 'profile', title, description, url: canonicalPath },
    twitter: { card: 'summary_large_image', title, description },
    other,
  };
}

export default async function PublicBentoPage({ params }: PageProps) {
  const { pseudo: requested } = await params;

  // Avant toute entrée-sortie : la casse se normalise lexicalement, donc
  // une URL non canonique ne doit coûter ni requête Supabase ni entrée de
  // cache. Cf. `canonicalPseudo` pour le raisonnement.
  if (needsCanonicalRedirect(requested)) {
    permanentRedirect(bentoPath(canonicalPseudo(requested)));
  }

  const lookup = await getBento(requested);

  if (lookup.kind === 'not-found') notFound();

  if (lookup.kind === 'unpublished') {
    return (
      <BentoPageShell pseudo={lookup.pseudo}>
        <div className="mx-auto max-w-[1180px]">
          <div className="mx-auto max-w-[420px]">
            <BentoIdentity
              pseudo={lookup.pseudo}
              displayName={lookup.displayName}
              subtitle="bento en cours de préparation"
            />
            <div className="mt-6">
              {/* La boîte vide plutôt qu'un message seul : elle montre ce
                  qui va arriver, et donne une raison de revenir. Aucune
                  donnée du bento non publié n'est lisible ici, la RLS
                  l'interdit au client anonyme. */}
              <PublicBentoGrid
                slots={{}}
                label={`Bento de @${lookup.pseudo}, pas encore terminé`}
                empty
              />
            </div>
            <p className="mt-6 text-center text-[15px] leading-[1.55] text-bento-ink/80">
              <span className="font-display block text-[clamp(20px,5vw,26px)] text-bento-ink">
                Ce bento n&apos;est pas encore terminé !
              </span>
              <span className="mt-2 block">
                @{lookup.pseudo} n&apos;a pas fini de garnir sa boîte. Repasse dans quelques jours,
                elle apparaîtra ici.
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

  const { bento } = lookup;
  const canonicalUrl = `${SITE_URL}${bentoPath(requested)}`;

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
        </div>

        <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <PublicBentoGrid slots={bento.slots} label={`Les six choix de @${bento.pseudo}`} />
        </div>

        <div className="lg:col-start-2 lg:row-start-2">
          <BentoCallToAction
            heading="Compose le tien"
            blurb="Six cases, six choix : ton film, ta série, ton artiste, ta chanson, ton créateur et ton lieu. Gratuit, sans compte à créer."
          />
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
