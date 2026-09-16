import {
  CATEGORY_BY_ID,
  paletteKeyForItem,
  type PaletteKey,
} from '@bento-pop/supabase-mobile/bento';
import type { CategoryKey } from '@bento-pop/supabase-mobile/types';
import { MAIN_CASES, type CaseMeta } from '@bento-pop/supabase-mobile/bento';

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

/**
 * Les cases remplies, indexées par **clé de case**.
 *
 * `string` et non `CategoryKey` depuis le chantier 13 : une case d'édition
 * porte `ed<édition>_<rang>`, et les six clés de catégorie n'en sont qu'un
 * cas particulier.
 */
export type BentoSlots = Partial<Record<string, BentoTile>>;

/**
 * La description d'une case, telle que la base la rend.
 *
 * Elle vient de la requête et non plus de `CATEGORY_META` : la base porte
 * l'intitulé, le tampon et le genre des six cases du bento principal depuis
 * le chantier 13, et c'est la seule source possible pour une édition.
 * `bento-cases-vs-app.test.ts` lie les six valeurs à celles de l'app.
 */
export type RawCaseRow = {
  readonly key: string;
  readonly prompt: string;
  readonly stamp: string;
  readonly gender: string | null;
  readonly display_order: number;
};

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
  /**
   * La case de cette ligne, jointe. Elle donne la clé sous laquelle la case
   * s'indexe, ce que `CATEGORY_BY_ID` ne sait faire que pour les six.
   */
  readonly bento_categories?: { readonly key: string } | null;
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
    // La clé jointe d'abord, la table des six en repli : une version
    // déployée avant cette requête ne joignait pas la case.
    const category = row.bento_categories?.key ?? CATEGORY_BY_ID[row.category_id];
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

/** Nombre de cases effectivement remplies. */
export function filledCount(slots: BentoSlots): number {
  return Object.keys(slots).length;
}

/**
 * Les cases d'un bento, dans l'ordre de la boîte.
 *
 * Celles de l'édition quand le bento en compose une, les six du bento
 * principal sinon. **La liste complète, cases vides comprises** : c'est elle
 * qui décide de la disposition, et la déduire des seules cases remplies
 * ferait rétrécir la boîte d'un bento incomplet au lieu d'y montrer des
 * emplacements vides.
 *
 * Une édition dont les cases ne se lisent pas, parce qu'elle a été dépubliée
 * après la publication du bento, retombe sur une liste vide : la boîte ne se
 * dessine alors pas, ce qui vaut mieux que de la dessiner avec les cases de
 * quelqu'un d'autre.
 */
export function bentoCases(
  editionCases: readonly RawCaseRow[] | null | undefined,
  hasEdition: boolean,
): readonly CaseMeta[] {
  if (!hasEdition) return MAIN_CASES;
  return [...(editionCases ?? [])]
    .sort((a, b) => a.display_order - b.display_order)
    .map((c) => ({
      key: c.key,
      prompt: c.prompt,
      stamp: c.stamp,
      gender: c.gender === 'f' ? ('f' as const) : ('m' as const),
    }));
}
