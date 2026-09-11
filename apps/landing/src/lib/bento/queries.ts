import { createMobileAnonClient, type MobileClient } from '@/lib/supabase/mobile';
import { isValidPseudo } from './pseudo';
import { mapBentoItems, type BentoSlots, type RawBentoItemRow } from './map';

/**
 * Accès aux bentos publics du projet Supabase mobile.
 *
 * Coquille impure : elle interroge Supabase et délègue toute la logique de
 * transformation aux fonctions pures de `map.ts`, qui sont testées
 * unitairement. Ce qui reste ici est couvert par les tests d'intégration
 * HTTP du lot 7.
 */

/** Colonnes lues, en une seule requête. */
const BENTO_SELECT = `
  pseudo,
  display_name,
  bentos (
    id,
    published_at,
    is_featured,
    bento_items (
      category_id,
      items ( id, title, subtitle, year, image_url, image_credit )
    )
  )
` as const;

export type PublicBento = {
  /** Casse canonique, telle que stockée en base. */
  readonly pseudo: string;
  readonly displayName: string | null;
  readonly publishedAt: string;
  readonly isFeatured: boolean;
  readonly slots: BentoSlots;
};

/**
 * Résultat de la résolution d'une URL `/u/<pseudo>`.
 *
 * `unpublished` est un état à part entière, pas une erreur : le profil
 * existe mais son bento n'est pas publié. La page répond alors 200 avec
 * l'écran « pas encore terminé » (décision produit, cf. spec §6.5.1).
 */
export type BentoLookup =
  | { readonly kind: 'published'; readonly bento: PublicBento }
  | { readonly kind: 'unpublished'; readonly pseudo: string; readonly displayName: string | null }
  | { readonly kind: 'not-found' };

type RawBentoRow = {
  readonly id: string;
  readonly published_at: string | null;
  readonly is_featured: boolean;
  readonly bento_items: readonly RawBentoItemRow[] | null;
};

type RawUserRow = {
  readonly pseudo: string;
  readonly display_name: string | null;
  // Relation « to-one » côté PostgREST, mais certaines versions du client
  // la typent en tableau. On accepte les deux et on normalise.
  readonly bentos: RawBentoRow | readonly RawBentoRow[] | null;
};

type FeaturedRow = {
  readonly featured_order: number | null;
  readonly users: { readonly pseudo: string } | null;
};

/**
 * Les types `Raw*` ci-dessus sont posés via `overrideTypes<…, { merge: false }>()`
 * plutôt que laissés à l'inférence : le `Database` du projet mobile est
 * écrit à la main et sa table `users` déclare `Relationships: []`. PostgREST
 * sait joindre `bentos`, mais le typage de supabase-js n'a pas de quoi le
 * déduire et produirait un `SelectQueryError`. À supprimer le jour où les
 * types seront régénérés par `supabase gen types` avec les relations
 * complètes (cf. le script `gen-types` du package).
 */
function firstBento(raw: RawUserRow['bentos']): RawBentoRow | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : (raw as RawBentoRow);
}

/**
 * Résout un pseudo d'URL en bento affichable.
 *
 * Le `client` est injectable pour les tests ; en production, l'appelant
 * laisse la valeur par défaut.
 */
export async function lookupPublicBento(
  requestedPseudo: string,
  client: MobileClient | null = createMobileAnonClient(),
): Promise<BentoLookup> {
  // Garde-fou avant toute I/O. Vaut aussi comme protection : `_` est
  // autorisé par la contrainte SQL et reste un joker `ilike`.
  if (!isValidPseudo(requestedPseudo)) return { kind: 'not-found' };

  // Variables d'env absentes : la page 404 et le reste du site continue.
  if (!client) return { kind: 'not-found' };

  const { data, error } = await client
    .from('users')
    .select(BENTO_SELECT)
    // `ilike` sans joker explicite, mais `_` en entrée en est un : `a_c`
    // matcherait `abc`. On ne peut pas s'en remettre à `maybeSingle()`
    // (qui échouerait sur 2 lignes) ni à la première ligne venue. On
    // ramène donc un petit lot et on exige l'égalité exacte ci-dessous.
    // L'index unique sur `lower(pseudo)` garantit au plus une vraie
    // correspondance.
    .ilike('pseudo', requestedPseudo)
    .limit(5)
    .overrideTypes<RawUserRow[], { merge: false }>();

  if (error) {
    // Panne réseau ou Supabase indisponible. On log côté serveur et on
    // rend un 404 plutôt qu'une erreur 500 : une page de partage cassée
    // vaut mieux qu'une page d'erreur, et les scrapers sociaux ne
    // réessaient pas sur un 500.
    console.error('[bento/queries] lookup failed:', error.message);
    return { kind: 'not-found' };
  }

  const wanted = requestedPseudo.toLowerCase();
  const user = (data ?? []).find((row) => row.pseudo.toLowerCase() === wanted);
  if (!user) return { kind: 'not-found' };

  const bento = firstBento(user.bentos);

  // `bentos_read_published` masque déjà les bentos non publiés au client
  // anon : `bento` est donc `null` aussi bien pour « pas de bento du tout »
  // que pour « bento en cours ». Le test `published_at` est une ceinture,
  // pas la vraie garantie.
  if (!bento?.published_at) {
    return { kind: 'unpublished', pseudo: user.pseudo, displayName: user.display_name };
  }

  return {
    kind: 'published',
    bento: {
      pseudo: user.pseudo,
      displayName: user.display_name,
      publishedAt: bento.published_at,
      isFeatured: bento.is_featured,
      slots: mapBentoItems(bento.bento_items ?? []),
    },
  };
}

/**
 * Pseudos des bentos mis en avant par l'équipe.
 *
 * Sert à `generateStaticParams` (pré-rendu au build) et au `sitemap.ts` :
 * ce sont les seules pages indexables, cf. la politique d'indexation de la
 * spec §8. Renvoie un tableau vide si Supabase est injoignable, ce qui
 * dégrade le pré-rendu sans casser le build.
 */
export async function listFeaturedPseudos(
  client: MobileClient | null = createMobileAnonClient(),
): Promise<string[]> {
  if (!client) return [];

  const { data, error } = await client
    .from('bentos')
    .select('featured_order, users:user_id ( pseudo )')
    .eq('is_featured', true)
    .not('published_at', 'is', null)
    .order('featured_order', { ascending: true, nullsFirst: false })
    .overrideTypes<FeaturedRow[], { merge: false }>();

  if (error) {
    console.error('[bento/queries] featured list failed:', error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => row.users?.pseudo)
    .filter((pseudo): pseudo is string => Boolean(pseudo));
}
