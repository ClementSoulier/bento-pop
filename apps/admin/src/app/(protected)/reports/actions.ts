'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createMobileClient } from '@/lib/supabase/mobile';

const reportIdSchema = z.object({
  reportId: z.string().uuid(),
});

const banSchema = z.object({
  reportId: z.string().uuid(),
  targetUserId: z.string().uuid(),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Marque un signalement comme rejeté (faux positif, déjà traité, etc.).
 * Aucune action sur l'utilisateur signalé.
 */
export async function dismissReport(input: { reportId: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = reportIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'reportId invalide' };

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const { error } = await mobile
    .from('reports')
    .update({
      status: 'dismissed',
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.email,
    })
    .eq('id', parsed.data.reportId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/reports');
  return { ok: true };
}

/**
 * Bannit l'utilisateur signalé : DELETE public.users → cascade automatique
 * vers `bentos` puis `bento_items`. Le `auth.users` reste mais sans aucune
 * donnée liée publiquement. Le signalement passe `reviewed`.
 *
 * Apple guideline 1.2 : preuve de modération réactive < 24h.
 */
export async function banUser(input: { reportId: string; targetUserId: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = banSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Inputs invalides' };

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  // 1. Delete user (cascade vers bento + bento_items via ON DELETE CASCADE)
  const { error: deleteErr } = await mobile.from('users').delete().eq('id', parsed.data.targetUserId);
  if (deleteErr) return { ok: false, error: `DELETE user : ${deleteErr.message}` };

  // 2. Marque le report comme traité
  const { error: updateErr } = await mobile
    .from('reports')
    .update({
      status: 'reviewed',
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.email,
    })
    .eq('id', parsed.data.reportId);
  if (updateErr) return { ok: false, error: `UPDATE report : ${updateErr.message}` };

  revalidatePath('/reports');
  revalidatePath('/bentos');
  return { ok: true };
}
