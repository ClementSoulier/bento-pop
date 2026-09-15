import { CATEGORY_BY_ID, paletteKeyForItem } from '@bento-pop/supabase-mobile/bento';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BentoItems } from '@/components/bento';
import type { Database } from '@/supabase/types';
import { PSEUDO_REGEX, escapeLikePattern, pickExactPseudo } from './pseudo-match';

/**
 * Chargement de la page bento publique, `app/u/[pseudo].tsx`.
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
 * `bentos` revient en objet et non en tableau : `bentos.user_id` est
 * `unique`, PostgREST expose donc la relation en un-à-un.
 */
const PUBLIC_BENTO_SELECT = `
  pseudo,
  display_name,
  kind,
  bentos (
    published_at,
    is_featured,
    bento_items (
      category_id,
      items ( id, title, subtitle, image_url, image_credit )
    )
  )
` as const;

/**
 * Une ligne au plus est attendue, l'échappement rendant la requête exacte.
 * Cinq laissent `pickExactPseudo` utile si l'échappement venait à sauter.
 */
const PUBLIC_BENTO_LIMIT = 5;

export type PublicBentoRow = {
  pseudo: string;
  display_name: string | null;
  kind: string;
  bentos: {
    published_at: string | null;
    is_featured: boolean;
    bento_items:
      | {
          category_id: number;
          items: {
            id: string;
            title: string;
            subtitle: string | null;
            image_url: string | null;
            image_credit: string | null;
          } | null;
        }[]
      | null;
  } | null;
};

export type PublicBento = {
  pseudo: string;
  displayName: string | null;
  /** Bento composé par l'équipe pour un créateur rencontré hors de l'app. */
  isGuest: boolean;
  isFeatured: boolean;
  /** Chaîne PostgREST, reprise telle quelle. */
  publishedAt: string;
  slots: BentoItems;
};

/**
 * `null` : ce pseudo n'existe pas. `{ bento: null }` : il existe et n'a rien
 * en ligne, jamais publié ou retiré depuis.
 */
export type PublicBentoResult = { pseudo: string; bento: PublicBento | null } | null;

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
 */
export function mapPublicBento(row: PublicBentoRow): NonNullable<PublicBentoResult> {
  const bento = row.bentos;
  if (!bento?.published_at) return { pseudo: row.pseudo, bento: null };

  const slots: BentoItems = {};
  for (const link of bento.bento_items ?? []) {
    const cat = CATEGORY_BY_ID[link.category_id];
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
  if (Object.keys(slots).length === 0) return { pseudo: row.pseudo, bento: null };

  return {
    pseudo: row.pseudo,
    bento: {
      pseudo: row.pseudo,
      displayName: row.display_name,
      // Comparaison à la chaîne, comme dans le fil : une valeur inconnue se
      // lit « pas invité » au lieu de faire planter le mapping.
      isGuest: row.kind === 'editorial',
      isFeatured: bento.is_featured,
      publishedAt: bento.published_at,
      slots,
    },
  };
}

/**
 * Charge la page publique d'un pseudo.
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
  options: { signal?: AbortSignal } = {},
): Promise<PublicBentoResult> {
  const wanted = pseudo.trim();
  if (!PSEUDO_REGEX.test(wanted)) return null;

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
  return row ? mapPublicBento(row) : null;
}
