import { CATEGORY_BY_ID, paletteKeyForItem } from '@bento-pop/supabase-mobile/bento';
import type { TileData } from '@/components/bento/Tile';
import type { CategoryKey } from '@/supabase/types';

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

export type Slots = Partial<Record<CategoryKey, TileData & { itemId?: string }>>;

/**
 * Deux règles, les mêmes que sur la page publique :
 *
 * - une case de catégorie inconnue est ignorée, pour qu'une septième
 *   catégorie déployée en base avant les clients n'écrase aucune case ;
 * - une case dont l'item est masqué par la RLS devient vide.
 */
export function mapRemoteSlots(rows: readonly RemoteSlotRow[] | null | undefined): Slots {
  const slots: Slots = {};
  for (const row of rows ?? []) {
    const cat = CATEGORY_BY_ID[row.category_id];
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
