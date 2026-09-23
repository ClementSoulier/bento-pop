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

/**
 * Ce que `mapRemoteSlots` lit d'une case, dans la syntaxe de `select()` : la
 * **seule** liste de colonnes des lectures qui hydratent le composer.
 *
 * Il y en avait deux, et elles avaient divergé. Celle du changement de bento,
 * `loadBentoById`, ne lisait ni `image_credit` ni `status` : à la recette du
 * 16 septembre, revenir au bento principal par le sélecteur effaçait les
 * crédits d'image, qu'une photo sous licence CC BY exige, et l'état « en
 * attente », qui bloque la publication d'une case non modérée.
 */
export const REMOTE_SLOT_COLUMNS =
  'category_id, items ( id, title, subtitle, image_url, image_credit, status )';

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
 * Trois règles, les deux premières les mêmes que sur la page publique :
 *
 * - une case dont l'identifiant n'est pas dans le jeu attendu est ignorée,
 *   pour qu'une case déployée en base avant les clients n'en écrase aucune ;
 * - une case dont l'item est masqué par la RLS devient vide ;
 * - une case dont l'item est refusé devient vide aussi (chantier 17, D28).
 *   La RLS laisse l'auteur lire sa proposition quel que soit son statut, et
 *   rien ne retire la case au refus : sans cette règle, l'auteur voyait son
 *   item refusé comme accepté, sans pastille, et publiait avec, quand tout
 *   autre lecteur voyait une case vide. Mesuré le 23 septembre 2026.
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
    if (!cat || !item || item.status === 'rejected') continue;
    slots[cat] = tileFromItem(item);
  }
  return slots;
}

/** Une case, d'après l'item lu en base. La même pour un bento et un brouillon. */
function tileFromItem(item: RemoteItem): TileData & { itemId: string } {
  return {
    title: item.title,
    subtitle: item.subtitle ?? undefined,
    imageUrl: item.image_url ?? undefined,
    imageCredit: item.image_credit ?? undefined,
    paletteKey: paletteKeyForItem(item.id),
    itemId: item.id,
    pending: item.status === 'pending',
  };
}

/**
 * Ce que la relecture du brouillon lit d'un item, dans la syntaxe de
 * `select()`. Chantier 17, D25.
 */
export const DRAFT_ITEM_COLUMNS =
  'id, title, subtitle, image_url, image_credit, status, merged_into_id';

export type DraftItemRow = RemoteItem & { status: string; merged_into_id: string | null };

function sameTile(a: TileData & { itemId?: string }, b: TileData & { itemId?: string }): boolean {
  return (
    a.itemId === b.itemId &&
    a.title === b.title &&
    a.subtitle === b.subtitle &&
    a.imageUrl === b.imageUrl &&
    a.imageCredit === b.imageCredit &&
    Boolean(a.pending) === Boolean(b.pending)
  );
}

/**
 * Le brouillon d'un compte sans profil, remis à jour d'après la base.
 * Chantier 17, D25, qui corrige un défaut du chantier 9.
 *
 * Sans profil, le composer affiche un brouillon gardé sur le téléphone, et
 * rien ne relisait ses cases en base : une proposition validée y restait
 * « en attente », et le bouton « En attente de validation » interdisait de
 * publier. Mesuré au simulateur le 23 septembre 2026, le tap de la
 * notification « Proposition validée » ouvrait une case qui disait le
 * contraire.
 *
 * - validée : la case prend l'item tel que l'équipe l'a validé, titre et
 *   image compris, sans pastille ;
 * - refusée : la case se vide, comme pour un compte avec profil, où
 *   `mapRemoteSlots` l'écarte (D28) ;
 * - fusionnée : la case prend l'item conservé, s'il est lu et validé ;
 * - en attente, ou introuvable : rien ne change.
 */
export function refreshDraftSlots(
  slots: Slots,
  rows: readonly DraftItemRow[],
): { slots: Slots; changed: boolean } {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const next: Slots = {};
  let changed = false;

  for (const [key, slot] of Object.entries(slots)) {
    if (!slot) continue;
    const row = slot.itemId ? byId.get(slot.itemId) : undefined;
    let tile: (TileData & { itemId?: string }) | null = slot;

    if (row?.status === 'rejected') {
      tile = null;
    } else if (row?.status === 'validated') {
      tile = tileFromItem(row);
    } else if (row?.status === 'merged' && row.merged_into_id) {
      const kept = byId.get(row.merged_into_id);
      if (kept?.status === 'validated') tile = tileFromItem(kept);
    }

    if (tile === null) {
      changed = true;
    } else if (sameTile(tile, slot)) {
      next[key] = slot;
    } else {
      next[key] = tile;
      changed = true;
    }
  }

  return { slots: next, changed };
}
