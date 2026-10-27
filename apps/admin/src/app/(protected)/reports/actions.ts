'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { composeBanNotice } from '@/lib/moderation/digest';
import { createMailer } from '@/lib/moderation/mailer';
import { deleteMobileAccount } from '@/lib/mobile-users';
import { createMobileClient } from '@/lib/supabase/mobile';

const reportIdSchema = z.object({
  reportId: z.string().uuid(),
});

const hideSchema = z.object({
  commentId: z.string().uuid(),
  reason: z.string().trim().min(1).max(120),
});

const commentIdSchema = z.object({
  commentId: z.string().uuid(),
});

const hideWhySchema = z.object({
  whyId: z.string().uuid(),
  reason: z.string().trim().min(1).max(120),
});

const whyIdSchema = z.object({
  whyId: z.string().uuid(),
});

const banSchema = z.object({
  targetUserId: z.string().uuid(),
  reason: z.string().trim().min(1).max(200),
});

const clearLinksSchema = z.object({
  targetUserId: z.string().uuid(),
  reportId: z.string().uuid(),
});

export type ActionResult = { ok: true } | { ok: false; error: string };
export type BanResult = { ok: true; noticeSent: boolean } | { ok: false; error: string };

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
 * Masque un commentaire, en un geste depuis son signalement (chantier 22,
 * D8). Son auteur le voit encore, grisé, avec le motif : c'est ce que demande
 * l'article 17 du DSA. Tous les signalements en attente sur ce commentaire
 * passent traités ensemble.
 */
export async function hideComment(input: {
  commentId: string;
  reason: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = hideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Commentaire ou motif invalide' };

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const now = new Date().toISOString();
  const { error } = await mobile
    .from('bento_comments')
    .update({
      status: 'hidden',
      hidden_reason: parsed.data.reason,
      hidden_at: now,
      hidden_by: admin.email,
    })
    .eq('id', parsed.data.commentId);
  if (error) return { ok: false, error: error.message };

  const { error: reportsError } = await mobile
    .from('reports')
    .update({ status: 'reviewed', reviewed_at: now, reviewed_by: admin.email })
    .eq('target_comment_id', parsed.data.commentId)
    .eq('status', 'pending');
  if (reportsError)
    return {
      ok: false,
      error: `Masqué, mais les signalements restent ouverts : ${reportsError.message}`,
    };

  revalidatePath('/reports');
  return { ok: true };
}

/**
 * Efface les réseaux d'un compte signalé, chantier 25 (D6) : un pseudo
 * Instagram ou TikTok qui n'est pas le sien, ou injurieux, puisque rien ne
 * les vérifie. Le compte reste ; ce signalement passe traité.
 */
export async function clearSocialLinks(input: {
  targetUserId: string;
  reportId: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = clearLinksSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Compte ou signalement invalide' };

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const { error } = await mobile.from('account_links').delete().eq('user_id', parsed.data.targetUserId);
  if (error) return { ok: false, error: error.message };

  const now = new Date().toISOString();
  const { error: reportError } = await mobile
    .from('reports')
    .update({ status: 'reviewed', reviewed_at: now, reviewed_by: admin.email })
    .eq('id', parsed.data.reportId)
    .eq('status', 'pending');
  if (reportError) {
    return { ok: false, error: `Effacés, mais le signalement reste ouvert : ${reportError.message}` };
  }

  revalidatePath('/reports');
  return { ok: true };
}

/** Rétablit un commentaire masqué : le motif part avec le masquage. */
export async function restoreComment(input: { commentId: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = commentIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Commentaire invalide' };

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const { error } = await mobile
    .from('bento_comments')
    .update({ status: 'visible', hidden_reason: null, hidden_at: null, hidden_by: null })
    .eq('id', parsed.data.commentId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/reports');
  return { ok: true };
}

/**
 * Masque un pourquoi (chantier 12, D8), comme un commentaire : son auteur le
 * voit encore, grisé, avec le motif, et les autres ne le lisent plus, ni dans
 * l'app ni sur le web, que la base purge aussitôt. Les signalements en
 * attente sur ce pourquoi passent traités ensemble.
 */
export async function hideWhy(input: { whyId: string; reason: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = hideWhySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Pourquoi ou motif invalide' };

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const now = new Date().toISOString();
  const { error } = await mobile
    .from('bento_whys')
    .update({
      status: 'hidden',
      hidden_reason: parsed.data.reason,
      hidden_at: now,
      hidden_by: admin.email,
    })
    .eq('id', parsed.data.whyId);
  if (error) return { ok: false, error: error.message };

  const { error: reportsError } = await mobile
    .from('reports')
    .update({ status: 'reviewed', reviewed_at: now, reviewed_by: admin.email })
    .eq('target_why_id', parsed.data.whyId)
    .eq('status', 'pending');
  if (reportsError)
    return {
      ok: false,
      error: `Masqué, mais les signalements restent ouverts : ${reportsError.message}`,
    };

  revalidatePath('/reports');
  return { ok: true };
}

/** Rétablit un pourquoi masqué : le motif part avec le masquage. */
export async function restoreWhy(input: { whyId: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = whyIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Pourquoi invalide' };

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const { error } = await mobile
    .from('bento_whys')
    .update({ status: 'visible', hidden_reason: null, hidden_at: null, hidden_by: null })
    .eq('id', parsed.data.whyId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/reports');
  return { ok: true };
}

/**
 * Bannit un compte (chantier 22, D13) : la suppression avec motif du
 * chantier 14, profil, compte d'authentification et entrée au registre. Le
 * bannissement d'avant ne supprimait que la ligne `users` : le banni gardait
 * son compte, et depuis le chantier 28 son adresse.
 *
 * S'il est gardé, le motif part d'abord à son adresse (article 17 du DSA) :
 * après la suppression, elle n'existerait plus. Un mail perdu n'empêche pas
 * le bannissement, et l'écran dit qu'il n'est pas parti.
 *
 * Tous les signalements en attente sur ce compte passent traités ensemble.
 */
export async function banUser(input: { targetUserId: string; reason: string }): Promise<BanResult> {
  const admin = await requireAdmin();
  const parsed = banSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Compte ou motif invalide' };
  const { targetUserId, reason } = parsed.data;

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const { data: profile } = await mobile
    .from('users')
    .select('pseudo')
    .eq('id', targetUserId)
    .maybeSingle();
  if (!profile) return { ok: false, error: 'Profil introuvable : déjà supprimé ?' };

  const { data: auth } = await mobile.auth.admin.getUserById(targetUserId);
  const keptEmail = auth?.user && !auth.user.is_anonymous ? (auth.user.email ?? null) : null;

  let noticeSent = false;
  const mailer = createMailer();
  if (keptEmail && mailer) {
    try {
      await mailer.send({
        to: [keptEmail],
        ...composeBanNotice({ pseudo: profile.pseudo, reason }),
      });
      noticeSent = true;
    } catch (e) {
      console.error('[modération] motif du bannissement', e);
    }
  }

  const deletion = await deleteMobileAccount(mobile, targetUserId, {
    hasAuthAccount: Boolean(auth?.user),
    reason: `Banni : ${reason}`,
    adminEmail: admin.email,
  });
  if (!deletion.ok) return { ok: false, error: deletion.error };

  const now = new Date().toISOString();
  await mobile
    .from('reports')
    .update({ status: 'reviewed', reviewed_at: now, reviewed_by: admin.email })
    .eq('status', 'pending')
    .or(`target_user_id.eq.${targetUserId},target_pseudo.eq."${profile.pseudo}"`);

  revalidatePath('/reports');
  revalidatePath('/bentos');
  revalidatePath('/utilisateurs');
  return { ok: true, noticeSent };
}
