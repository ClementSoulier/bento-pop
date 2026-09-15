import {
  CATEGORY_BY_ID,
  CATEGORY_META,
  CATEGORY_ORDER,
  paletteKeyForItem,
} from '@bento-pop/supabase-mobile/bento';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BentoItems } from '@/components/bento';
import type { Database } from '@/supabase/types';
import { relativeDate } from './relative-date';

/**
 * Couche de données du fil « La table ».
 *
 * **Le client Supabase est un paramètre, pas un import.** Le reste de l'app
 * importe le singleton de `@/supabase/client`, qui tire au chargement
 * `react-native-url-polyfill`, AsyncStorage et `expo-constants`, et qui jette
 * si les variables d'environnement manquent. Un module qui l'importe est
 * inchargeable dans node, donc intestable ailleurs que sur un appareil.
 *
 * Or c'est précisément la forme de la requête qu'il faut verrouiller ici : la
 * syntaxe du `.or()` de pagination est ce qui casse en silence, et une erreur
 * PostgREST se solde par un fil vide sans message. Le client injecté permet de
 * pointer un vrai `supabase-js` sur un bouchon HTTP et d'exercer le
 * constructeur d'URL réel.
 *
 * `bento-actions.ts` et `pseudo.ts` gagneraient à suivre. C'est du ressort du
 * chantier 5, qui réécrit de toute façon le flux de publication.
 */

export type FeedClient = SupabaseClient<Database>;

/**
 * Clé du fil dans le cache React Query. Partagée avec les mutations qui
 * l'invalident (`public-bento-query.ts`) : écrite deux fois à la main, elle
 * pourrait changer d'un côté et l'invalidation rater en silence.
 */
export const FEED_QUERY_KEY = ['feed'] as const;

/**
 * Huit bentos par page : environ 15 Ko mesurés, et cinq écrans de défilement
 * avant l'appel suivant.
 */
export const PAGE_SIZE = 8;

/**
 * Les champs demandés sont exactement ceux que `Tile` rend. `year`,
 * `external_source` et `external_id` sont volontairement absents : ils
 * n'apparaissent nulle part dans le fil et alourdiraient chaque page.
 */
const FEED_SELECT = `
  id,
  published_at,
  is_featured,
  users:user_id ( pseudo, display_name, kind ),
  bento_items (
    category_id,
    items ( id, title, subtitle, image_url, image_credit )
  )
` as const;

export type FeedRow = {
  id: string;
  published_at: string | null;
  is_featured: boolean;
  users: { pseudo: string; display_name: string | null; kind: string } | null;
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
};

export type FeedBento = {
  bentoId: string;
  pseudo: string;
  displayName: string | null;
  isFeatured: boolean;
  /**
   * Bento composé par l'équipe pour un créateur rencontré hors de l'app.
   *
   * L'information ne se déduit d'aucune autre : sans elle, le fil attribue à
   * quelqu'un une composition qu'il n'a pas faite dans l'app.
   */
  isGuest: boolean;
  /**
   * Chaîne renvoyée par PostgREST, **opaque**. Ne jamais la reconstruire via
   * `new Date(...).toISOString()` : cf. `cursorOf`.
   */
  publishedAt: string;
  slots: BentoItems;
};

export type FeedCursor = { publishedAt: string; id: string };

export type FeedPage = {
  bentos: FeedBento[];
  /** `null` quand la page est incomplète, donc qu'il n'y a plus rien après. */
  nextCursor: FeedCursor | null;
};

/**
 * Ligne PostgREST vers modèle de vue. Pure, pour être testable sans réseau.
 *
 * Renvoie `null` quand la ligne ne peut pas produire un post exploitable :
 *
 * - `users` nul (relation cassée) : la carte mènerait à un cul-de-sac ;
 * - `published_at` nul : impossible via le filtre de `loadFeedPage`, mais le
 *   type l'autorise et le fil trie dessus ;
 * - zéro case lisible : une boîte entièrement vide occuperait un écran entier
 *   sans rien apprendre.
 *
 * Une case isolée manquante n'écarte pas la ligne : la case est simplement
 * absente de `slots`, et `BentoGrid` y rend une `EmptyTile`. C'est ce qui
 * arrive quand un item est `pending`, la RLS le masquant à tout le monde sauf
 * à son auteur.
 */
export function mapFeedRow(row: FeedRow): FeedBento | null {
  const user = row.users;
  if (!user || !row.published_at) return null;

  const slots: BentoItems = {};
  for (const link of row.bento_items ?? []) {
    const cat = CATEGORY_BY_ID[link.category_id];
    const item = link.items;
    // `cat` indéfini : une 7e catégorie déployée en base avant les clients.
    if (!cat || !item) continue;
    slots[cat] = {
      title: item.title,
      subtitle: item.subtitle ?? undefined,
      imageUrl: item.image_url ?? undefined,
      imageCredit: item.image_credit ?? undefined,
      paletteKey: paletteKeyForItem(item.id),
    };
  }
  if (Object.keys(slots).length === 0) return null;

  return {
    bentoId: row.id,
    pseudo: user.pseudo,
    displayName: user.display_name,
    isFeatured: row.is_featured,
    // Comparaison à la chaîne plutôt qu'au type : une valeur inconnue,
    // ajoutée en base avant que les clients ne soient déployés, doit se lire
    // comme « pas invité » et non faire planter le mapping.
    isGuest: user.kind === 'editorial',
    publishedAt: row.published_at,
    slots,
  };
}

/**
 * Curseur de pagination, repris **mot pour mot** de la réponse PostgREST.
 *
 * Le faire transiter par `new Date(x).toISOString()` le tronquerait à la
 * milliseconde. `published_at` est un `timestamptz`, donc en précision
 * microseconde : un curseur ramené de `.227431` à `.227` exclurait toutes les
 * lignes situées entre les deux, qui disparaîtraient du fil sans trace.
 */
export function cursorOf(row: FeedRow): FeedCursor | null {
  if (!row.published_at) return null;
  return { publishedAt: row.published_at, id: row.id };
}

/**
 * Libellé lu par VoiceOver pour un post entier.
 *
 * Le post est un seul élément accessible : le laisser ouvert ferait parcourir
 * une soixantaine de vues par bento, le rendre opaque sans libellé viderait le
 * fil de son contenu pour un utilisateur non voyant. L'énumération donne tout
 * en un balayage, sur un élément activable.
 */
export function feedAccessibilityLabel(bento: FeedBento, now?: number): string {
  const when = relativeDate(bento.publishedAt, now);
  const parts = [when ? `Bento de @${bento.pseudo}, publié ${when}.` : `Bento de @${bento.pseudo}.`];
  // Même priorité qu'à l'écran : « invité » d'abord, parce que c'est la seule
  // information qu'un lecteur ne peut déduire de rien d'autre.
  if (bento.isGuest) parts.push("Bento invité, composé par l'équipe.");
  else if (bento.isFeatured) parts.push("Coup de cœur de l'équipe.");
  for (const cat of CATEGORY_ORDER) {
    const slot = bento.slots[cat];
    // Les cases vides sont omises, sinon VoiceOver énoncerait « Film
    // undefined » sur un bento incomplet.
    if (!slot) continue;
    parts.push(`${CATEGORY_META[cat].label} : ${slot.title}.`);
  }
  return parts.join(' ');
}

/**
 * Charge une page du fil, triée `published_at desc` avec `id` en départage.
 *
 * Le départage n'est pas cosmétique : la pagination par curseur exige un ordre
 * total, sans quoi deux bentos publiés à la même microseconde se
 * chevaucheraient ou se sauteraient d'une page à l'autre.
 *
 * Pas de `range()` : un décalage numérique produit doublons et trous dès
 * qu'une ligne est insérée en tête pendant le défilement, ce qui est le
 * comportement normal d'un fil trié par date de publication.
 *
 * Le `.not('published_at', 'is', null)` explicite est nécessaire malgré le
 * tri : la RLS `bentos_read_published` laisse aussi passer le brouillon de
 * l'utilisateur courant, qui apparaîtrait en tête du fil public.
 */
export async function loadFeedPage(
  client: FeedClient,
  cursor?: FeedCursor | null,
): Promise<FeedPage> {
  let query = client.from('bentos').select(FEED_SELECT).not('published_at', 'is', null);

  if (cursor) {
    // `.or()` du client et jamais une URL construite à la main : le `+` du
    // décalage horaire, laissé brut, est décodé en espace et PostgREST répond
    // `22007 invalid input syntax for type timestamp with time zone`.
    // `supabase-js` passe par `URL.searchParams`, qui l'encode en `%2B`.
    query = query.or(
      `published_at.lt.${cursor.publishedAt},` +
        `and(published_at.eq.${cursor.publishedAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query
    .order('published_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE);

  // On lève au lieu de renvoyer une liste vide. `loadFeaturedBentos` faisait
  // `if (error || !data) return []`, ce qui rendait une panne réseau
  // indiscernable d'une base vide : l'écran affichait « pas encore de
  // contenu » pendant que Supabase était tombé.
  if (error) throw new Error(`Feed load failed: ${error.message}`);

  // Le `Database` écrit à la main ne décrit pas les relations imbriquées, donc
  // le type inféré par PostgREST n'est pas exploitable. Une seule assertion
  // ici, sur la forme documentée par `FEED_SELECT`, plutôt qu'un `as` par
  // champ dans le mapping.
  const rows = (data ?? []) as unknown as FeedRow[];

  const bentos = rows.map(mapFeedRow).filter((b): b is FeedBento => b !== null);

  // Le curseur vient de la **dernière ligne brute**, pas du dernier bento
  // retenu. Si la dernière ligne est écartée par `mapFeedRow`, la reprendre
  // depuis le dernier bento retenu redemanderait indéfiniment la même page.
  const last = rows.length === PAGE_SIZE ? rows[rows.length - 1] : undefined;

  return { bentos, nextCursor: last ? cursorOf(last) : null };
}
