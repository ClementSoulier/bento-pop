import { router } from 'expo-router';
import { supabase } from '@/supabase/client';
import { switchBento } from '@/lib/bento-actions';
import { useBento } from '@/state/bento';
import { usePushTarget } from '@/state/push-target';
import { type ItemPlacement, type PushTarget, type ShownSlot, planItemTarget } from './push';

/**
 * Suivre le tap d'une notification, depuis le composer une fois prêt.
 * Chantier 17, lot 4 : D21 et D22. La décision est dans `planItemTarget`,
 * testée ; ici, les lectures et la navigation.
 */
export async function followPushTarget(target: PushTarget): Promise<void> {
  const bento = useBento.getState();

  if (target.kind === 'edition') {
    // Déjà rejointe : son bento s'ouvre. Sinon, le « + titre » est mis en
    // avant, et rejoindre reste un geste de la personne (D21).
    const joined = bento.own.find((b) => b.editionId === target.editionId);
    if (!joined) {
      usePushTarget.getState().spotlightEdition(target.editionId);
      return;
    }
    if (joined.id !== bento.current?.id) await switchBento(joined.id);
    return;
  }

  const shown: ShownSlot[] = Object.entries(bento.slots).flatMap(([caseKey, slot]) =>
    slot?.itemId ? [{ caseKey, itemId: slot.itemId }] : [],
  );
  const ids = target.keptItemId ? [target.keptItemId, target.itemId] : [target.itemId];
  const ownIds = bento.own.map((b) => b.id);

  // La base seulement si le composer ne l'affiche pas : un item refusé n'y
  // est plus visible, la RLS le masque, mais sa case le désigne toujours.
  let placements: ItemPlacement[] = [];
  if (!shown.some((s) => ids.includes(s.itemId)) && ownIds.length > 0) {
    const { data, error } = await supabase
      .from('bento_items')
      .select('bento_id, category_id, item_id')
      .in('item_id', ids)
      .in('bento_id', ownIds);
    if (error) throw error;
    placements = (data ?? []).map((row) => ({
      bentoId: row.bento_id,
      categoryId: row.category_id,
      itemId: row.item_id,
    }));
  }

  const where = {
    shown,
    placements,
    currentBentoId: bento.current?.id ?? null,
    primaryBentoId: bento.own.find((b) => b.isPrimary)?.id ?? null,
  };
  let plan = planItemTarget(target, where);

  // Un refus que la relecture du brouillon a déjà retiré de sa case (D25) :
  // la case d'où venait la proposition, lue en base seulement dans ce cas.
  if (!plan && target.status === 'rejected') {
    const { data } = await supabase
      .from('items')
      .select('category_id')
      .eq('id', target.itemId)
      .maybeSingle();
    const originCaseKey =
      useBento.getState().cases.find((c) => c.id === data?.category_id)?.key ?? null;
    plan = planItemTarget(target, { ...where, originCaseKey });
  }
  if (!plan) return;

  let caseKey: string | undefined;
  if (plan.where === 'shown') {
    caseKey = plan.caseKey;
  } else {
    if (plan.bentoId !== useBento.getState().current?.id) await switchBento(plan.bentoId);
    caseKey = useBento.getState().cases.find((c) => c.id === plan.categoryId)?.key;
  }
  if (!caseKey) return;

  useBento.getState().pulseCase(caseKey);
  // Un refus invite à choisir un autre item : la recherche de la case (D22).
  if (plan.openSearch) router.push({ pathname: '/search-modal', params: { category: caseKey } });
}
