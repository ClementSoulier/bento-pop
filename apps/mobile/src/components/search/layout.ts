import { CATEGORY_META } from '@bento-pop/supabase-mobile/bento';
import type { CategoryKey } from '@bento-pop/supabase-mobile/types';

/**
 * Géométrie et libellés de la modale de recherche d'item.
 *
 * Aucun import de `react-native` : le module doit rester chargeable sous
 * `node:test`. Même raison et même forme que `components/feed/layout.ts`.
 */

/** Padding horizontal de la liste (16 × 2) plus les deux gouttières (10 × 2). */
export const GRID_CHROME = 32 + 20;

/** Trois tuiles par rangée, comme le `numColumns={3}` de la liste. */
export const COLUMNS = 3;

/** Rapport hauteur / largeur du visuel d'une tuile, format affiche. */
export const TILE_ASPECT = 3 / 2;

/**
 * Hauteur du bandeau de sous-titre sous le visuel, quand il y en a un
 * (`paddingVertical: 6` deux fois plus une ligne de 11 pt).
 */
export const TILE_SUBTITLE_HEIGHT = 23;

/**
 * Largeur d'une tuile.
 *
 * Calculée à chaque rendu et non une fois au chargement du module : la
 * version figée, `Dimensions.get('window').width` au niveau du fichier,
 * gardait la largeur qu'avait l'écran au démarrage de l'app et restait donc
 * fausse après une rotation. C'est le défaut déjà corrigé sur le fil.
 *
 * Le plancher évite une largeur nulle ou négative sur la première frame de
 * certaines plateformes, où `useWindowDimensions` peut rendre 0.
 */
export function searchTileWidth(windowWidth: number): number {
  return Math.max(1, Math.floor((windowWidth - GRID_CHROME) / COLUMNS));
}

/** Hauteur totale d'une tuile, sous-titre compris. */
export function searchTileHeight(windowWidth: number): number {
  return searchTileWidth(windowWidth) * TILE_ASPECT + TILE_SUBTITLE_HEIGHT;
}

/**
 * Placeholder du champ de recherche.
 *
 * L'article s'accorde au genre du libellé. La version précédente
 * concaténait « Cherche un » et le libellé, ce qui donnait « Cherche un
 * chanson… » et « Cherche un série… », visibles sur deux des six écrans.
 */
export function searchPlaceholder(category: CategoryKey): string {
  const meta = CATEGORY_META[category];
  return `Cherche ${meta.gender === 'f' ? 'une' : 'un'} ${meta.label.toLowerCase()}…`;
}
