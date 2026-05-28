'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createMobileClient } from '@/lib/supabase/mobile';

const itemIdSchema = z.object({
  itemId: z.string().uuid(),
});

const rejectSchema = z.object({
  itemId: z.string().uuid(),
  reason: z.string().trim().max(280).optional(),
});

const mergeSchema = z.object({
  canonicalId: z.string().uuid(),
  loserIds: z.array(z.string().uuid()).min(1).max(50),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export type SimilarCandidate = {
  id: string;
  title: string;
  subtitle: string | null;
  year: number | null;
  imageUrl: string | null;
  score: number;
};

/**
 * Valide un item pending : devient visible en recherche pour tous les
 * utilisateurs (RLS items_read passe sur status='validated'). Le trigger
 * SQL `items_touch_lifecycle_on_update` met automatiquement
 * `validated_at`, on remplit juste `validated_by` (uuid admin).
 */
export async function validateItem(input: { itemId: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = itemIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'itemId invalide' };

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const { error } = await mobile
    .from('items')
    .update({
      status: 'validated',
      validated_by: admin.userId,
    })
    .eq('id', parsed.data.itemId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/catalogue');
  return { ok: true };
}

/**
 * Refuse un item pending. Effet utilisateur : les `bento_items` qui
 * pointaient dessus deviennent visuellement vides (RLS items_read
 * exclut les rejected) — l'app mobile affichera un slot vide. La
 * publication du bento reste possible pour l'instant (pas de gate
 * SQL en V1, ça vivra côté UI), mais l'utilisateur verra son slot
 * disparaître au prochain hydrate.
 *
 * `rejected_reason` est optionnel et ne sert pour l'instant qu'à
 * la traçabilité admin (pas de notification user en V1).
 */
export async function rejectItem(input: { itemId: string; reason?: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Inputs invalides' };

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const { error } = await mobile
    .from('items')
    .update({
      status: 'rejected',
      rejected_by: admin.userId,
      rejected_reason: parsed.data.reason ?? null,
    })
    .eq('id', parsed.data.itemId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/catalogue');
  return { ok: true };
}

/**
 * Cherche les items validés proches d'un item pending donné, dans la
 * même catégorie. Utilisé pour proposer un merge plutôt qu'une
 * validation en doublon.
 *
 * Threshold abaissé à 0.25 (vs 0.4 côté user) pour rattraper des fautes
 * de frappe ou orthographes alternatives que l'admin saura juger.
 */
export async function getSimilarsForItem(input: { itemId: string }): Promise<
  { ok: true; candidates: SimilarCandidate[] } | { ok: false; error: string }
> {
  await requireAdmin();
  const parsed = itemIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'itemId invalide' };

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  // 1. Récupère le titre + catégorie de l'item pending
  const { data: item, error: itemErr } = await mobile
    .from('items')
    .select('title, category_id')
    .eq('id', parsed.data.itemId)
    .maybeSingle();
  if (itemErr || !item) return { ok: false, error: itemErr?.message ?? 'Item introuvable' };

  // 2. Trouve la category_key à partir de l'id (la RPC prend une key)
  const { data: category } = await mobile
    .from('bento_categories')
    .select('key')
    .eq('id', item.category_id)
    .maybeSingle();
  if (!category) return { ok: false, error: 'Catégorie introuvable' };

  // 3. RPC find_similar_items avec threshold bas
  const { data, error } = await mobile.rpc('find_similar_items', {
    q: item.title,
    category_key: category.key,
    threshold: 0.25,
    lim: 5,
  });
  if (error) return { ok: false, error: error.message };

  const candidates: SimilarCandidate[] = (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    year: r.year,
    imageUrl: r.image_url,
    score: r.score,
  }));

  return { ok: true, candidates };
}

/**
 * Fusionne un ou plusieurs items pending dans un item canonique validé.
 * Délègue toute la logique transactionnelle à la fonction SQL
 * `admin_merge_items` (réécriture bento_items, aliases, status).
 */
export async function mergeItems(input: {
  canonicalId: string;
  loserIds: string[];
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = mergeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Inputs invalides' };
  }
  if (parsed.data.loserIds.includes(parsed.data.canonicalId)) {
    return { ok: false, error: 'Le canonique ne peut pas être dans les losers.' };
  }

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const { error } = await mobile.rpc('admin_merge_items', {
    canonical_id: parsed.data.canonicalId,
    loser_ids: parsed.data.loserIds,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/catalogue');
  return { ok: true };
}
