import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import {
  BentoPublishedView,
  BentoUnpublishedView,
} from '@/components/bento/BentoPublicView';
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
  const featured = await listFeaturedPseudos();
  // En minuscules : c'est la forme canonique des URL, donc la seule
  // qu'il serve à pré-rendre. Seuls les principaux : c'est cette route-ci,
  // les autres bentos ont la leur, `/u/<pseudo>/<slug>`. Dédoublonné parce
  // que Next refuse deux fois le même paramètre.
  const vus = new Set<string>();
  return featured
    .filter((bento) => bento.isPrimary)
    .map((bento) => canonicalPseudo(bento.pseudo))
    .filter((pseudo) => !vus.has(pseudo) && vus.add(pseudo))
    .map((pseudo) => ({ pseudo }));
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
    return <BentoUnpublishedView pseudo={lookup.pseudo} displayName={lookup.displayName} />;
  }

  return (
    <BentoPublishedView
      bento={lookup.bento}
      others={lookup.others}
      canonicalUrl={`${SITE_URL}${bentoPath(requested)}`}
    />
  );
}
