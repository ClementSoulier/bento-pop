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

export type ActionResult = { ok: true } | { ok: false; error: string };

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
