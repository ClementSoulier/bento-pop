import {
  CATEGORY_BY_ID,
  MAIN_CASES,
  type CaseMeta,
  paletteKeyForItem,
} from '@bento-pop/supabase-mobile/bento';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BentoItems } from '@/components/bento';
import type { Database } from '@/supabase/types';
import { PSEUDO_REGEX, escapeLikePattern, pickExactPseudo } from './pseudo-match';

/**
 * Chargement de la page publique d'un compte, `app/u/[pseudo].tsx`, et de
 * celle d'un bento nommé, `app/u/[pseudo]/[slug].tsx`.
 *
 * Point d'arrivée de tous les liens partagés et, depuis le chantier 6, de
 * toute la recherche. D'où deux exigences que l'ancien chargement ne tenait
 * pas (cf. `docs/UX-07-PAGE-BENTO-PUBLIQUE-MOBILE.md` §4.4 à §4.6) :
 *
 * - **Une requête et non deux.** `users` avec `bentos` en jointure externe :
 *   un aller-retour de moins, 89 ms → 46 ms mesurés, et la différence entre
 *   « ce pseudo n'existe pas » et « il n'a rien en ligne » sort gratuitement
 *   de la jointure. `!inner` rendrait zéro ligne dans les deux cas.
 * - **Une panne lève, elle ne devient pas `null`.** L'ancien chargement, par
 *   `findUserByPseudo`, avalait l'erreur : une coupure réseau affichait
 *   « Bento introuvable », sur la page où il est le plus grave de mentir.
 *
 * ─── Chantier 16 : plusieurs bentos par compte ──────────────────────────
 *
 * La jointure externe est **conservée**, et c'est un choix mesuré. Partir de
 * `bentos` pour remonter vers `users` aurait donné une requête insensible à la
 * migration, mais aurait rendu zéro ligne aussi bien pour un pseudo inconnu
 * que pour un pseudo sans rien en ligne : la distinction que le chantier 7
 * avait gagnée aurait demandé une seconde requête.
 *
 * Ce qui change, c'est la **forme de la relation**, et il faut la traiter des
 * deux côtés de la migration (cf. `docs/UX-16-PLUSIEURS-BENTOS.md` §4.3) :
 *
 * - tant que `bentos_user_id_key` existe, PostgREST voit un un-à-un et rend
 *   `bentos` en **objet** ;
 * - dès que cette contrainte devient partielle, il rend un **tableau**, et
 *   cela **même si aucun compte n'a deux bentos**.
 *
 * `bentoRows` absorbe les deux. Ce n'est pas le `raw[0]` sans ordre de la
 * landing : le choix du bento est ensuite explicite, sur `is_primary`.
 *
 * Client injecté, comme `feed.ts` : c'est la forme de l'URL qu'il faut
 * verrouiller, à commencer par le filtre sur la ressource imbriquée, qui
 * casse en silence.
 */

export type PublicBentoClient = SupabaseClient<Database>;

/**
 * Les champs sont ceux que la page rend, et rien d'autre : `year`,
 * `external_source`, `external_id`, `created_at` et les `id` de ligne
 * pesaient 21 % de la réponse sans jamais s'afficher. L'`id` de l'item reste,
 * il choisit la palette.
 *
 * `id`, `slug` et `is_primary` sont arrivés au chantier 16 : ils nomment le
 * bento, ce que rien ne savait faire avant.
 */
const PUBLIC_BENTO_SELECT = `
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
      items ( id, title, subtitle, image_url, image_credit )
    )
  )
` as const;

/**
 * Une ligne au plus est attendue, l'échappement rendant la requête exacte.
 * Cinq laissent `pickExactPseudo` utile si l'échappement venait à sauter.
 */
const PUBLIC_BENTO_LIMIT = 5;

/**
 * Même forme que la contrainte `bentos_slug_format` en base : 3 à 40
 * caractères, minuscules, chiffres et tirets, ni en tête ni en queue.
 * Vérifiée avant la requête, pour qu'un segment d'URL bricolé ne parte pas en
 * base.
 */
export const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

type RawPublicBento = {
  id: string;
  slug: string;
  is_primary: boolean;
  /** L'édition composée, ou `null` pour un bento libre. Chantier 13. */
  edition_id?: number | null;
  published_at: string | null;
  is_featured: boolean;
  /**
   * L'édition et **toutes** ses cases, vides comprises : une case vide n'a
   * pas de ligne `bento_items`, et sans elle la disposition serait déduite
   * des seules cases remplies.
   */
  editions?: {
    slug: string;
    title: string;
    bento_categories: {
      key: string; prompt: string; stamp: string; gender: string | null; display_order: number;
    }[] | null;
  } | null;
  bento_items:
    | {
        category_id: number;
        bento_categories?: { key: string } | null;
        items: {
          id: string;
          title: string;
          subtitle: string | null;
          image_url: string | null;
          image_credit: string | null;
        } | null;
      }[]
    | null;
};

export type PublicBentoRow = {
  pseudo: string;
  display_name: string | null;
  kind: string;
  /** Objet avant la levée de `bentos_user_id_key`, tableau après. */
  bentos: RawPublicBento | RawPublicBento[] | null;
};

export type PublicBento = {
  id: string;
  slug: string;
  isPrimary: boolean;
  pseudo: string;
  displayName: string | null;
  /** Bento composé par l'équipe pour un créateur rencontré hors de l'app. */
  isGuest: boolean;
  isFeatured: boolean;
  /** Chaîne PostgREST, reprise telle quelle. */
  publishedAt: string;
  slots: BentoItems;
  /** Les cases du bento, vides comprises. Leur nombre fait la disposition. */
  cases: readonly CaseMeta[];
  /** Le titre de l'édition composée, ou `null` pour un bento libre. */
  editionTitle: string | null;
};

/** De quoi lister les autres bentos d'un compte sans charger leurs cases. */
export type PublicBentoRef = {
  id: string;
  slug: string;
  isFeatured: boolean;
  publishedAt: string;
};

/**
 * `null` : ce pseudo n'existe pas. `{ bento: null }` : il existe et n'a rien
 * en ligne, jamais publié ou retiré depuis.
 *
 * `others` liste les autres bentos publiés du compte, sans celui de `bento`.
 * Vide tant qu'un compte n'a qu'un bento, donc tant que la page n'affiche
 * rien de neuf.
 */
export type PublicBentoResult = {
  pseudo: string;
  bento: PublicBento | null;
  others: PublicBentoRef[];
} | null;

/**
 * La relation imbriquée, toujours en tableau, quel que soit l'état du schéma.
 *
 * À garder même une fois la migration passée partout : PostgREST choisit la
 * forme d'après les contraintes, et une contrainte qui reviendrait ferait
 * silencieusement replonger la réponse en objet.
 */
export function bentoRows(raw: PublicBentoRow['bentos']): RawPublicBento[] {
  if (raw === null || raw === undefined) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/**
 * Ligne PostgREST vers modèle de vue. Pure, pour être testable sans réseau.
 *
 * Mêmes règles que `mapFeedRow`, pour qu'un bento absent du fil ne s'affiche
 * pas ici, et inversement :
 *
 * - `published_at` nul se lit « rien en ligne ». Impossible via le filtre de
 *   `loadPublicBento`, mais la RLS laisse son brouillon à l'auteur, et un
 *   filtre perdu ne doit pas afficher un brouillon comme publié ;
 * - une case de catégorie inconnue est ignorée : une 7e catégorie déployée en
 *   base avant les clients ne doit écraser aucune case ;
 * - une case dont l'item est masqué par la RLS devient vide. C'est un item en
 *   attente ou rejeté, que la RLS ne montre qu'à celui qui l'a proposé ;
 * - zéro case lisible se lit « rien en ligne », comme le fil qui écarte la
 *   ligne : une boîte entièrement vide n'apprend rien.
 *
 * **Le choix du bento**, quand un compte en a plusieurs. Avec un `slug`,
 * c'est celui-là ou rien : une adresse qui nomme un bento ne doit jamais en
 * afficher un autre. Sans slug, celui qui porte `is_primary`, et à défaut le
 * plus ancien publié. Ce défaut n'est pas décoratif : sans lui, un compte dont
 * le principal est en brouillon afficherait « rien en ligne » alors qu'un
 * autre de ses bentos est public, exactement le défaut mesuré côté landing
 * (§4.6 de la spéc du 16).
 *
 * Le tri se fait ici et non dans la requête : les autres bentos du compte
 * reviennent de toute façon, et les garder permet à la page d'un bento nommé
 * de mener aux autres au lieu d'être un cul-de-sac. C'est aussi ce que fait
 * la landing, et les deux doivent rendre la même page.
 */
export function mapPublicBento(
  row: PublicBentoRow,
  slug: string | null = null,
): NonNullable<PublicBentoResult> {
  const published = bentoRows(row.bentos)
    .filter((b): b is RawPublicBento & { published_at: string } => Boolean(b.published_at))
    // Chaînes ISO : l'ordre lexicographique est l'ordre chronologique.
    .sort((a, b) => a.published_at.localeCompare(b.published_at));

  const chosen = slug
    ? published.find((b) => b.slug === slug)
    : (published.find((b) => b.is_primary) ?? published[0]);
  if (!chosen) return { pseudo: row.pseudo, bento: null, others: [] };

  const others = published
    .filter((b) => b.id !== chosen.id)
    .map((b) => ({
      id: b.id,
      slug: b.slug,
      isFeatured: b.is_featured,
      publishedAt: b.published_at,
    }));

  const slots: BentoItems = {};
  for (const link of chosen.bento_items ?? []) {
    // La clé jointe d'abord : une case d'édition n'est pas dans la table des
    // six, et la deviner reviendrait à poser un item dans la mauvaise case.
    const cat = link.bento_categories?.key ?? CATEGORY_BY_ID[link.category_id];
    const item = link.items;
    if (!cat || !item) continue;
    slots[cat] = {
      title: item.title,
      subtitle: item.subtitle ?? undefined,
      imageUrl: item.image_url ?? undefined,
      imageCredit: item.image_credit ?? undefined,
      paletteKey: paletteKeyForItem(item.id),
    };
  }
  if (Object.keys(slots).length === 0) return { pseudo: row.pseudo, bento: null, others };

  return {
    pseudo: row.pseudo,
    others,
    bento: {
      id: chosen.id,
      slug: chosen.slug,
      isPrimary: chosen.is_primary,
      // Les cases du bento, vides comprises : leur nombre fait la
      // disposition, et une édition n'a pas les six du principal.
      cases: chosen.edition_id != null
        ? [...(chosen.editions?.bento_categories ?? [])]
            .sort((a, b) => a.display_order - b.display_order)
            .map((c) => ({
              key: c.key, prompt: c.prompt, stamp: c.stamp,
              gender: c.gender === 'f' ? ('f' as const) : ('m' as const),
            }))
        : MAIN_CASES,
      editionTitle: chosen.editions?.title ?? null,
      pseudo: row.pseudo,
      displayName: row.display_name,
      // Comparaison à la chaîne, comme dans le fil : une valeur inconnue se
      // lit « pas invité » au lieu de faire planter le mapping.
      isGuest: row.kind === 'editorial',
      isFeatured: chosen.is_featured,
      publishedAt: chosen.published_at,
      slots,
    },
  };
}

/**
 * Charge la page publique d'un pseudo.
 *
 * `slug` vise un bento nommé plutôt que le principal. Le choix se fait dans
 * `mapPublicBento`, sur la liste complète des bentos publiés du compte : un
 * slug inconnu rend « rien à cette adresse » au lieu de retomber sur le
 * principal, et la page d'un bento nommé peut mener aux autres.
 *
 * Un pseudo hors format ne déclenche aucune requête : il ne peut pas exister.
 *
 * L'erreur remonte avec son statut HTTP, que `query-client.ts` lit pour ne
 * pas réessayer une 4xx : sans lui, une requête refusée serait retentée deux
 * fois avant d'afficher quoi que ce soit. Une panne réseau arrive avec le
 * statut 0 et reste réessayable, de même qu'une requête annulée par `signal`.
 *
 * **Aucun réessai caché.** `postgrest-js` 2.105 réessaie de lui-même trois fois
 * une lecture qui échoue sur le réseau, ou qui reçoit un 503 ou un 520, après
 * 1, 2 puis 4 s : sept secondes avant de rendre l'erreur, découvertes parce
 * qu'un test de panne réseau durait sept secondes. Empilées sous le réessai de
 * React Query, ces tentatives multiplieraient les requêtes et repousseraient
 * « Connexion perdue » bien au-delà de la borne choisie. Le réessai de cette
 * requête vit en un seul endroit, `public-bento-query.ts`.
 */
export async function loadPublicBento(
  client: PublicBentoClient,
  pseudo: string,
  options: { signal?: AbortSignal; slug?: string } = {},
): Promise<PublicBentoResult> {
  const wanted = pseudo.trim();
  if (!PSEUDO_REGEX.test(wanted)) return null;
  if (options.slug !== undefined && !SLUG_REGEX.test(options.slug)) return null;

  let request = client
    .from('users')
    .select(PUBLIC_BENTO_SELECT)
    .ilike('pseudo', escapeLikePattern(wanted))
    // Filtre sur la ressource imbriquée, et non `!inner` : un compte sans
    // rien en ligne revient avec `bentos: null` au lieu de disparaître.
    .not('bentos.published_at', 'is', null)
    .limit(PUBLIC_BENTO_LIMIT)
    .retry(false);
  if (options.signal) request = request.abortSignal(options.signal);

  const { data, error, status } = await request;

  if (error) {
    throw Object.assign(new Error(`Public bento load failed: ${error.message}`), { status });
  }

  // Le `Database` écrit à la main ne décrit pas les relations imbriquées,
  // cf. `loadFeedPage` : une seule assertion, sur la forme documentée par
  // `PUBLIC_BENTO_SELECT`.
  const rows = (data ?? []) as unknown as PublicBentoRow[];
  const row = pickExactPseudo(rows, wanted);
  return row ? mapPublicBento(row, options.slug ?? null) : null;
}
