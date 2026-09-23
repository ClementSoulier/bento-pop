import { supabase } from '@/supabase/client';
import { useBento } from '@/state/bento';
import { DRAFT_ITEM_COLUMNS, type DraftItemRow, refreshDraftSlots } from '@/lib/bento-slots';

/**
 * Relit en base les items du brouillon d'un compte sans profil, et remet ses
 * cases à jour si l'équipe les a modérés entre-temps. Chantier 17, D25 ; la
 * règle est dans `refreshDraftSlots`, testée.
 *
 * La RLS laisse l'auteur lire toutes ses propositions, et tout le monde un
 * item validé : deux lectures suffisent, la seconde pour l'item conservé
 * d'une fusion. Ne lève jamais : hors ligne, le brouillon reste tel quel, et
 * la prochaine relecture recommencera.
 */
export async function refreshDraftStatuses(): Promise<void> {
  try {
    const ids = itemIds(useBento.getState().slots);
    if (ids.length === 0) return;

    const { data, error } = await supabase.from('items').select(DRAFT_ITEM_COLUMNS).in('id', ids);
    if (error) throw error;
    const rows = (data ?? []) as DraftItemRow[];

    const kept = rows
      .filter((row) => row.status === 'merged' && row.merged_into_id && !ids.includes(row.merged_into_id))
      .map((row) => row.merged_into_id as string);
    if (kept.length > 0) {
      const second = await supabase.from('items').select(DRAFT_ITEM_COLUMNS).in('id', kept);
      if (second.error) throw second.error;
      rows.push(...((second.data ?? []) as DraftItemRow[]));
    }

    // Sur les cases du moment, et non sur celles d'avant la lecture : une case
    // posée entre-temps ne doit pas disparaître. `hydrate` respecte de plus le
    // verrou d'une écriture en vol.
    const { slots, changed } = refreshDraftSlots(useBento.getState().slots, rows);
    if (changed) useBento.getState().hydrate(slots);
  } catch (e) {
    console.warn('[brouillon] relecture des propositions', e);
  }
}

function itemIds(slots: ReturnType<typeof useBento.getState>['slots']): string[] {
  return [...new Set(Object.values(slots).flatMap((slot) => (slot?.itemId ? [slot.itemId] : [])))];
}
