import type { SupabaseClient } from '@supabase/supabase-js';
import { cleanTitle } from './text';
import type { Database } from '@/supabase/types';

/**
 * Propositions par défaut de la recherche d'item, le bloc « AU MENU ».
 *
 * Remplace l'écran vide « Tape pour chercher », qui laissait 78 % de la
 * modale en crème au moment précis où l'utilisateur ne sait pas quoi mettre
 * dans sa case. Cf. `docs/UX-03-RECHERCHE-ITEM.md`.
 *
 * **Le client est un paramètre, pas un import.** Même raison que dans
 * `feed.ts` : le singleton de `@/supabase/client` tire
 * `react-native-url-polyfill`, AsyncStorage et `expo-constants` au
 * chargement, ce qui rend inchargeable dans node tout module qui l'importe.
 * `items.ts`, voisin immédiat de celui-ci, en souffre et n'a aucun test.
 *
 * **Ce n'est pas un palmarès.** Au 12 septembre 2026, au plus 3 items par
 * catégorie ont été choisis plus d'une fois sur 26 bentos publiés, et zéro
 * pour « Chanson ». Le tri est donc surtout porté par ses critères de
 * départage. L'écran doit dire « voici le catalogue », pas « voici les
 * favoris » : c'est ce que règle le libellé, pas cette couche.
 */

export type SuggestionsClient = SupabaseClient<Database>;

/**
 * Douze propositions : quatre rangées de trois, dont une et demie visible
 * au-dessus du clavier. Assez pour remplir l'écran, assez peu pour que
 * l'egress reste tenable (environ 1,7 Mo par case ouverte, la moitié des
 * images du catalogue étant hébergées chez Supabase et servies en pleine
 * résolution faute de transformation d'image sur le plan gratuit).
 */
export const SUGGESTIONS_COUNT = 12;

/** Ligne renvoyée par la RPC `popular_items`. */
export type SuggestionRow =
  Database['public']['Functions']['popular_items']['Returns'][number];

export type SuggestedItem = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  imageCredit: string | null;
  /** Nombre de bentos publiés contenant cet item. Jamais `undefined`. */
  picks: number;
};

/**
 * Ligne PostgREST vers modèle de vue. Pure, donc testable sans réseau.
 *
 * `picks` est ramené à 0 quand il est absent ou nul : la fonction SQL le
 * garantit avec un `coalesce`, mais un `undefined` qui remonterait jusqu'au
 * rendu produirait « choisi undefined fois » dans le libellé VoiceOver.
 */
export function mapSuggestionRow(row: SuggestionRow): SuggestedItem {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    imageUrl: row.image_url,
    imageCredit: row.image_credit,
    picks: row.picks ?? 0,
  };
}

/**
 * Libellé lu par VoiceOver pour une tuile de proposition.
 *
 * Le nombre de choix n'est énoncé qu'à partir de 2. En dessous, il
 * annoncerait « choisi 1 fois » sur des items qui n'ont aucune popularité
 * réelle, ce qui vendrait un classement inexistant à quelqu'un qui ne peut
 * pas voir la grille pour en juger.
 */
export function suggestionAccessibilityLabel(item: SuggestedItem): string {
  const parts = [cleanTitle(item.title)];
  if (item.subtitle) parts.push(item.subtitle);
  if (item.picks >= 2) parts.push(`choisi ${item.picks} fois`);
  return parts.join(', ');
}

/**
 * Charge les propositions d'une catégorie.
 *
 * **Lève au lieu de renvoyer une liste vide.** Sans ça, une panne réseau et
 * un catalogue vide donneraient le même résultat, et l'écran ne pourrait pas
 * les distinguer. Il choisit ensuite de rester silencieux sur l'erreur (une
 * panne de suggestion ne doit pas ressembler à une panne de l'écran), mais
 * c'est sa décision, pas celle de cette couche.
 */
export async function loadSuggestions(
  client: SuggestionsClient,
  category: string,
  options?: { excludeItemId?: string | null; limit?: number },
): Promise<SuggestedItem[]> {
  const { data, error } = await client.rpc('popular_items', {
    category_key: category,
    lim: options?.limit ?? SUGGESTIONS_COUNT,
    // `null` explicite et non `undefined` : `supabase-js` sérialise le corps
    // en JSON, et une clé absente laisserait Postgres appliquer son défaut,
    // qui est justement `null`. Le passer noir sur blanc rend le corps de la
    // requête identique dans les deux cas, donc assertable en test.
    exclude_item: options?.excludeItemId ?? null,
  });

  if (error) throw new Error(`Suggestions load failed: ${error.message}`);

  return (data ?? []).map(mapSuggestionRow);
}
