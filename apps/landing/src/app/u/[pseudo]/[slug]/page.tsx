import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { BentoPublishedView } from '@/components/bento/BentoPublicView';
import { bentoDescription, bentoPath, bentoRobots, bentoTitle } from '@/lib/bento/metadata';
import { canonicalPseudo, needsCanonicalRedirect } from '@/lib/bento/pseudo';
import { lookupPublicBento } from '@/lib/bento/queries';
import { smartAppBanner } from '@/lib/bento/stores';

/**
 * Un bento nommé d'un compte, `/u/<pseudo>/<slug>`.
 *
 * Même page que `/u/<pseudo>`, à ceci près qu'elle rend le bento que l'adresse
 * nomme et non le principal. Une adresse inconnue **404** : elle ne retombe
 * jamais sur le principal, sans quoi un lien mort afficherait silencieusement
 * autre chose que ce qu'il annonce.
 *
 * Le principal est joignable ici comme ailleurs, sa canonique renvoyant sur
 * `/u/<pseudo>` : une seule adresse est indexée par bento.
 *
 * Cf. `docs/UX-16-PLUSIEURS-BENTOS.md` §5.3.
 */
export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://bento-pop.com';

/**
 * Même raison que sur la route du compte : `generateMetadata` et la page ont
 * tous deux besoin du bento, et la déduplication de Next ne couvre que
 * `fetch()`.
 */
const getBento = cache(lookupPublicBento);

/**
 * Aucun pré-rendu au build : un bento nommé n'existe pas encore au 16
 * septembre 2026, et `dynamicParams` vaut `true` par défaut, donc la page se
 * génère à la demande puis se met en cache.
 */
export async function generateStaticParams() {
  return [];
}

type PageProps = { params: Promise<{ pseudo: string; slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { pseudo: requested, slug } = await params;
  if (needsCanonicalRedirect(requested)) return {};

  const lookup = await getBento(requested, slug);
  if (lookup.kind !== 'published') {
    return { title: 'Bento introuvable', robots: { index: false, follow: true } };
  }

  const { bento } = lookup;
  // La canonique d'un principal est l'adresse du compte : c'est elle que
  // portent les liens déjà partagés, et deux URL pour un même contenu se
  // départagent ici plutôt que dans l'index de Google.
  const canonicalPath = bentoPath(requested, bento.isPrimary ? null : bento.slug);
  const title = bentoTitle(bento.pseudo);
  const description = bentoDescription(bento.pseudo, bento.slots);

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    robots: bentoRobots(bento.isFeatured),
    openGraph: { type: 'profile', title, description, url: canonicalPath },
    twitter: { card: 'summary_large_image', title, description },
    other: { 'apple-itunes-app': smartAppBanner(`${SITE_URL}${canonicalPath}`) },
  };
}

export default async function NamedBentoPage({ params }: PageProps) {
  const { pseudo: requested, slug } = await params;

  if (needsCanonicalRedirect(requested)) {
    permanentRedirect(bentoPath(canonicalPseudo(requested), slug));
  }

  const lookup = await getBento(requested, slug);

  // « Pas de bento à cette adresse » et « ce pseudo n'existe pas » se rendent
  // pareil ici : dans les deux cas l'adresse demandée ne désigne rien.
  if (lookup.kind !== 'published') notFound();

  return (
    <BentoPublishedView
      bento={lookup.bento}
      others={lookup.others}
      canonicalUrl={`${SITE_URL}${bentoPath(requested, lookup.bento.isPrimary ? null : slug)}`}
    />
  );
}
