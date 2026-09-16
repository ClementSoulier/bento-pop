import { paletteKeyForItem } from '@bento-pop/supabase-mobile/bento';
import { MAIN_CASE_SET } from './case-set';
import type { TileData } from '@/components/bento/Tile';

/**
 * Les cases d'un bento, de la forme rendue par PostgREST à celle du store.
 *
 * Extrait au chantier 16 : l'hydratation au démarrage et le changement de
 * bento depuis le composer font exactement la même chose, et deux copies de
 * ces règles auraient divergé au premier ajustement.
 *
 * La palette est choisie cycliquement selon l'identifiant de l'item : elle
 * n'est pas persistée, c'est purement décoratif.
 */

type RemoteSlotRow = {
  category_id: number;
  items: unknown;
};

type RemoteItem = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  image_credit: string | null;
  status?: string;
};

/**
 * Les cases remplies, indexées par **clé de case**.
 *
 * `string` et non `CategoryKey` depuis le chantier 13 : les six cases du
 * bento principal portent une clé de catégorie, une case d'édition porte
 * `ed<édition>_<rang>`. Le premier reste un cas particulier du second, donc
 * tout le code qui indexe par catégorie continue de valoir.
 */
export type Slots = Partial<Record<string, TileData & { itemId?: string }>>;

/**
 * Deux règles, les mêmes que sur la page publique :
 *
 * - une case dont l'identifiant n'est pas dans le jeu attendu est ignorée,
 *   pour qu'une case déployée en base avant les clients n'en écrase aucune ;
 * - une case dont l'item est masqué par la RLS devient vide.
 *
 * `cases` dit quelles cases on attend et sous quelle clé : les six du bento
 * principal, ou celles d'une édition. Sans lui, la fonction devinait, et
 * `CATEGORY_BY_ID` ne connaît que les six.
 */
export function mapRemoteSlots(
  rows: readonly RemoteSlotRow[] | null | undefined,
  cases: readonly { readonly id: number; readonly key: string }[] = MAIN_CASE_SET,
): Slots {
  const parId = new Map(cases.map((c) => [c.id, c.key]));
  const slots: Slots = {};
  for (const row of rows ?? []) {
    const cat = parId.get(row.category_id);
    const item = row.items as RemoteItem | null;
    if (!cat || !item) continue;
    slots[cat] = {
      title: item.title,
      subtitle: item.subtitle ?? undefined,
      imageUrl: item.image_url ?? undefined,
      imageCredit: item.image_credit ?? undefined,
      paletteKey: paletteKeyForItem(item.id),
      itemId: item.id,
      pending: item.status === 'pending',
    };
  }
  return slots;
}
