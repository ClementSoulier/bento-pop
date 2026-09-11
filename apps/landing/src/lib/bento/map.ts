import {
  CATEGORY_BY_ID,
  paletteKeyForItem,
  type PaletteKey,
} from '@bento-pop/supabase-mobile/bento';
import type { CategoryKey } from '@bento-pop/supabase-mobile/types';

/**
 * Transformation des lignes `bento_items` en cases affichables.
 *
 * Volontairement pur et sans I/O : c'est le cœur testable de la page
 * publique. La coquille impure (requête Supabase) vit dans `queries.ts`
 * et se contente d'appeler ces fonctions.
 */

/** Une case remplie du bento public. */
export type BentoTile = {
  readonly itemId: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly year: number | null;
  readonly imageUrl: string | null;
  /** Attribution CC-BY-SA ou TMDb, à afficher sous le visuel si présente. */
  readonly imageCredit: string | null;
  /** Dégradé de repli, utilisé quand `imageUrl` est absente. */
  readonly paletteKey: PaletteKey;
};

/** Les 6 cases, indexées par catégorie. Une case absente n'est pas remplie. */
export type BentoSlots = Partial<Record<CategoryKey, BentoTile>>;

/**
 * Forme brute d'une ligne `bento_items` jointe à son `items`.
 *
 * `item` est nullable et ce n'est pas une précaution théorique : la policy
 * `bento_items_read_published` laisse passer la ligne de liaison dès que le
 * bento est publié, tandis que `items_read_validated_or_own_pending` masque
 * l'item lui-même s'il a été rejeté ou fusionné après coup. Un visiteur
 * anonyme voit donc une liaison sans item. La case doit simplement se
 * rendre vide.
 */
export type RawBentoItemRow = {
  readonly category_id: number;
  readonly items: {
    readonly id: string;
    readonly title: string;
    readonly subtitle: string | null;
    readonly year: number | null;
    readonly image_url: string | null;
    readonly image_credit: string | null;
  } | null;
};

/**
 * Construit les cases à partir des lignes renvoyées par Supabase.
 *
 * Le résultat ne dépend **pas** de l'ordre des lignes : chaque case est
 * indexée par sa catégorie et sa palette est dérivée de l'identifiant de
 * l'item. C'est la correction du défaut historique où la palette venait de
 * l'index de ligne, alors que PostgreSQL ne garantit aucun ordre sans
 * `ORDER BY` (cf. `paletteKeyForItem`).
 *
 * Les cas dégradés sont absorbés silencieusement plutôt que levés : une
 * page de partage doit s'afficher même avec des données partielles.
 *   - `items` à `null` (item rejeté ou fusionné) : case ignorée
 *   - `category_id` inconnu (7e catégorie déployée en base avant le web) :
 *     ligne ignorée
 *   - doublon de catégorie (impossible via la PK composite, mais on ne
 *     mise pas là-dessus) : la première ligne rencontrée gagne
 */
export function mapBentoItems(rows: readonly RawBentoItemRow[]): BentoSlots {
  const slots: Record<string, BentoTile> = {};

  for (const row of rows) {
    const category = CATEGORY_BY_ID[row.category_id];
    if (!category) continue;

    const item = row.items;
    if (!item) continue;

    if (slots[category]) continue;

    slots[category] = {
      itemId: item.id,
      title: item.title,
      subtitle: item.subtitle,
      year: item.year,
      imageUrl: item.image_url,
      imageCredit: item.image_credit,
      paletteKey: paletteKeyForItem(item.id),
    };
  }

  return slots as BentoSlots;
}

/** Nombre de cases effectivement remplies, de 0 à 6. */
export function filledCount(slots: BentoSlots): number {
  return Object.keys(slots).length;
}
