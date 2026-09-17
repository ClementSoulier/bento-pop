import { createMobileAnonClient, type MobileClient } from '@/lib/supabase/mobile';
import { isValidPseudo } from './pseudo';
import type { CaseMeta } from '@bento-pop/supabase-mobile/bento';
import {
  bentoCases,
  mapBentoItems,
  type BentoSlots,
  type RawBentoItemRow,
  type RawCaseRow,
} from './map';

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
  kind,
  bentos (
    id,
    slug,
    is_primary,
    edition_id,
    published_at,
    is_featured,
    editions (
      slug,
      title,
      bento_categories ( key, prompt, stamp, gender, display_order )
    ),
    bento_items (
      category_id,
      bento_categories ( key ),
      items ( id, title, subtitle, year, image_url, image_credit )
    )
  )
` as const;

export type PublicBento = {
  /** Casse canonique, telle que stockée en base. */
  readonly pseudo: string;
  /** Adresse du bento : `/u/<pseudo>/<slug>`. Chantier 16. */
  readonly slug: string;
  /** Celui que `/u/<pseudo>` met en avant. */
  readonly isPrimary: boolean;
  readonly displayName: string | null;
  readonly publishedAt: string;
  readonly isFeatured: boolean;
  /**
   * Bento composé par l'équipe pour un créateur rencontré hors de l'app.
   *
   * Affiché parce que l'information ne se déduit d'aucune autre : sans elle,
   * la page attribue à une personne réelle une composition qu'elle n'a pas
   * faite elle-même.
   */
  readonly isGuest: boolean;
  readonly slots: BentoSlots;
  /**
   * Les cases de ce bento, dans l'ordre de la boîte, vides comprises.
   *
   * Leur nombre décide de la disposition. Six pour le bento principal, de
   * deux à six pour une édition.
   */
  readonly cases: readonly CaseMeta[];
  /** L'édition composée, ou `null` pour un bento libre. */
  readonly edition: { readonly slug: string; readonly title: string } | null;
};

/**
 * Résultat de la résolution d'une URL `/u/<pseudo>`.
 *
 * `unpublished` est un état à part entière, pas une erreur : le profil
 * existe mais son bento n'est pas publié. La page répond alors 200 avec
 * l'écran « pas encore terminé » (décision produit, cf. spec §6.5.1).
 */
export type BentoLookup =
  | {
      readonly kind: 'published';
      readonly bento: PublicBento;
      /** Les autres bentos publiés du compte, sans celui de `bento`. */
      readonly others: readonly OtherBento[];
    }
  | { readonly kind: 'unpublished'; readonly pseudo: string; readonly displayName: string | null }
  | { readonly kind: 'not-found' };

type RawBentoRow = {
  readonly id: string;
  readonly slug: string;
  readonly is_primary: boolean;
  /** L'édition composée, ou `null` pour un bento libre. Chantier 13. */
  readonly edition_id: number | null;
  readonly published_at: string | null;
  readonly is_featured: boolean;
  /**
   * L'édition, avec **toutes** ses cases, vides comprises.
   *
   * Imbriquée dans la même requête plutôt que lue à part : les cases vides
   * n'ont pas de ligne `bento_items`, et sans elles la disposition serait
   * déduite des seules cases remplies. Une boîte incomplète rétrécirait au
   * lieu de montrer des emplacements.
   */
  readonly editions: {
    readonly slug: string;
    readonly title: string;
    readonly bento_categories: readonly RawCaseRow[] | null;
  } | null;
  readonly bento_items: readonly RawBentoItemRow[] | null;
};

type RawUserRow = {
  readonly pseudo: string;
  readonly display_name: string | null;
  readonly kind: string;
  // Relation « to-one » côté PostgREST, mais certaines versions du client
  // la typent en tableau. On accepte les deux et on normalise.
  readonly bentos: RawBentoRow | readonly RawBentoRow[] | null;
};

type FeaturedRow = {
  readonly featured_order: number | null;
  readonly slug: string;
  readonly is_primary: boolean;
  readonly users: { readonly pseudo: string } | null;
};

/** Une adresse de bento indexable : `/u/<pseudo>` ou `/u/<pseudo>/<slug>`. */
export type FeaturedBento = {
  readonly pseudo: string;
  readonly slug: string;
  readonly isPrimary: boolean;
};

/** Un autre bento du compte, tel que la page le nomme. */
export type OtherBento = FeaturedBento & {
  /**
   * Le titre de l'édition composée, ou `null` pour un bento libre. C'est lui
   * qui nomme le lien : le slug est une adresse, pas un titre. Chantier 13.
   */
  readonly editionTitle: string | null;
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
function bentoRows(raw: RawUserRow['bentos']): readonly RawBentoRow[] {
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw as RawBentoRow];
}

/**
 * Le bento que l'adresse demande, choisi **explicitement**.
 *
 * Ce qui remplace `firstBento`, et pourquoi. `raw[0]` prenait la première
 * ligne rendue par une requête sans `order by` : avec deux bentos, la page
 * pouvait changer de bento d'une régénération ISR à l'autre, et un brouillon
 * arrivé en tête masquait un bento publié en forçant un `noindex`. Ici :
 *
 * - avec un `slug`, c'est celui-là ou rien ;
 * - sans slug, le principal, et à défaut le plus ancien publié, jamais « le
 *   premier venu ».
 *
 * Les chaînes `published_at` sont ISO : l'ordre lexicographique est l'ordre
 * chronologique.
 */
function pickBento(
  rows: readonly RawBentoRow[],
  slug: string | null,
): { chosen: RawBentoRow | null; others: readonly RawBentoRow[] } {
  const published = rows
    .filter((row): row is RawBentoRow & { published_at: string } => Boolean(row.published_at))
    .slice()
    .sort((a, b) => a.published_at.localeCompare(b.published_at));

  const chosen = slug
    ? (published.find((row) => row.slug === slug) ?? null)
    : (published.find((row) => row.is_primary) ?? published[0] ?? null);

  return { chosen, others: chosen ? published.filter((row) => row.id !== chosen.id) : [] };
}

/**
 * Résout un pseudo d'URL en bento affichable.
 *
 * Le `client` est injectable pour les tests ; en production, l'appelant
 * laisse la valeur par défaut.
 */
export async function lookupPublicBento(
  requestedPseudo: string,
  slug: string | null = null,
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

  const { chosen: bento, others } = pickBento(bentoRows(user.bentos), slug);

  // `bentos_read_published` masque déjà les bentos non publiés au client
  // anon : `bento` est donc `null` aussi bien pour « pas de bento du tout »
  // que pour « bento en cours ». Le test `published_at` est une ceinture,
  // pas la vraie garantie. Avec un `slug`, c'est aussi « rien à cette
  // adresse » : l'appelant en fait un 404 de segment plutôt qu'un repli sur
  // le principal.
  if (!bento?.published_at) {
    return { kind: 'unpublished', pseudo: user.pseudo, displayName: user.display_name };
  }

  return {
    kind: 'published',
    others: others.map((row) => ({
      pseudo: user.pseudo,
      slug: row.slug,
      isPrimary: row.is_primary,
      editionTitle: row.editions?.title ?? null,
    })),
    bento: {
      pseudo: user.pseudo,
      slug: bento.slug,
      isPrimary: bento.is_primary,
      displayName: user.display_name,
      publishedAt: bento.published_at,
      isFeatured: bento.is_featured,
      // Comparaison à la chaîne : une valeur inconnue, ajoutée en base avant
      // le déploiement de la landing, doit se lire « pas invité » plutôt que
      // faire échouer la page.
      isGuest: user.kind === 'editorial',
      slots: mapBentoItems(bento.bento_items ?? []),
      // La liste complète des cases, vides comprises : c'est elle qui décide
      // de la disposition. Celles de l'édition quand il en compose une, les
      // six du bento principal sinon.
      cases: bentoCases(bento.editions?.bento_categories, bento.edition_id !== null),
      edition: bento.editions
        ? { slug: bento.editions.slug, title: bento.editions.title }
        : null,
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
): Promise<FeaturedBento[]> {
  if (!client) return [];

  const { data, error } = await client
    .from('bentos')
    .select('featured_order, slug, is_primary, users:user_id ( pseudo )')
    .eq('is_featured', true)
    .not('published_at', 'is', null)
    .order('featured_order', { ascending: true, nullsFirst: false })
    .overrideTypes<FeaturedRow[], { merge: false }>();

  if (error) {
    console.error('[bento/queries] featured list failed:', error.message);
    return [];
  }

  // Une entrée par bento, et non par personne : un compte peut en avoir
  // plusieurs mis en avant, et chacun a sa propre adresse. Dédoublonné sur
  // l'adresse, parce que deux bentos d'un même compte produisaient sinon deux
  // fois `/u/<pseudo>` dans le sitemap et dans `generateStaticParams`.
  const vues = new Set<string>();
  const sorties: FeaturedBento[] = [];
  for (const row of data ?? []) {
    const pseudo = row.users?.pseudo;
    if (!pseudo) continue;
    const cle = `${pseudo.toLowerCase()}/${row.is_primary ? '' : row.slug}`;
    if (vues.has(cle)) continue;
    vues.add(cle);
    sorties.push({ pseudo, slug: row.slug, isPrimary: row.is_primary });
  }
  return sorties;
}
