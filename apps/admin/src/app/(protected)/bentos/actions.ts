'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createMobileClient } from '@/lib/supabase/mobile';
import { deleteMobileAccount } from '@/lib/mobile-users';

const featuredSchema = z.object({
  bentoId: z.string().uuid(),
  isFeatured: z.boolean(),
  featuredOrder: z.number().int().nullable().optional(),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Toggle `is_featured` (et optionnellement `featured_order`) sur un bento
 * du projet Supabase mobile. Server-side via service-role : bypass RLS.
 */
export async function setBentoFeatured(input: {
  bentoId: string;
  isFeatured: boolean;
  featuredOrder?: number | null;
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = featuredSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Champs invalides' };
  }
  const mobile = createMobileClient();
  if (!mobile) {
    return {
      ok: false,
      error: 'Supabase mobile non configuré (MOBILE_SUPABASE_URL / MOBILE_SUPABASE_SERVICE_ROLE_KEY).',
    };
  }

  const updates: { is_featured: boolean; featured_order: number | null } = {
    is_featured: parsed.data.isFeatured,
    // Si on dé-feature, on clear l'ordre (sinon une trace reste).
    featured_order: parsed.data.isFeatured
      ? parsed.data.featuredOrder ?? null
      : null,
  };

  const { error } = await mobile
    .from('bentos')
    .update(updates)
    .eq('id', parsed.data.bentoId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/bentos');
  return { ok: true };
}

const deleteUserSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

/**
 * Supprime un compte utilisateur du projet mobile.
 *
 * **La cascade depuis `auth.users` n'existe plus** depuis la migration
 * `20260913000000_admin_users.sql`, qui a retiré la clé étrangère pour
 * permettre les profils éditoriaux. Supprimer le seul compte
 * d'authentification laisserait le profil, son bento et ses cases en place.
 * La logique est donc partagée dans `lib/mobile-users.ts`.
 *
 * Les signalements émis par la personne sont conservés
 * (`on delete set null` sur `reporter_id`), ce qui est voulu : ils
 * concernent quelqu'un d'autre.
 *
 * Cet écran ne liste que des bentos publiés, donc tous ses comptes ont une
 * authentification. Le choix du motif, lui, vit sur `/utilisateurs` : ici on
 * se contente de le transmettre.
 */
export async function deleteUserAccount(input: {
  userId: string;
  reason: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = deleteUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'userId invalide' };
  }
  const mobile = createMobileClient();
  if (!mobile) {
    return {
      ok: false,
      error: 'Supabase mobile non configuré (MOBILE_SUPABASE_URL / MOBILE_SUPABASE_SERVICE_ROLE_KEY).',
    };
  }

  const result = await deleteMobileAccount(mobile, parsed.data.userId, {
    hasAuthAccount: true,
    reason: parsed.data.reason,
    adminEmail: admin.email,
  });
  if (!result.ok) return result;

  revalidatePath('/bentos');
  revalidatePath('/utilisateurs');
  return { ok: true };
}
