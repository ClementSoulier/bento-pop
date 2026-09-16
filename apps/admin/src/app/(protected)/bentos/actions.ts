'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createMobileClient, type Database } from '@/lib/supabase/mobile';
import { deleteMobileAccount } from '@/lib/mobile-users';
import { checkSlug } from '@/lib/bento-slug';

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

const addBentoSchema = z.object({
  userId: z.string().uuid(),
  slug: z.string().min(1).max(60),
});

/**
 * Ajoute un bento secondaire à un compte existant.
 *
 * C'est la porte d'entrée retenue au chantier 16 (D1) : l'app ne sait pas
 * encore créer de bento secondaire, et le back-office savait déjà créer un
 * bento éditorial. Cela suffit à rendre le chantier vérifiable de bout en
 * bout sans attendre le système d'éditions du chantier 13.
 *
 * Toujours **non principal** et **en brouillon** : déplacer la mise en avant
 * et publier sont deux gestes distincts, qui ont déjà leur écran.
 *
 * Écriture directe plutôt qu'appel à `create_bento()` : cette fonction agit
 * pour `auth.uid()`, or le back-office écrit avec la clé service-role, pour
 * le compte de quelqu'un d'autre. Les règles d'adresse, elles, sont les
 * mêmes : `checkSlug` les reprend, et la base les tient de toute façon.
 */
export async function addBentoToAccount(input: {
  userId: string;
  slug: string;
}): Promise<{ ok: true; bentoId: string } | { ok: false; error: string }> {
  await requireAdmin();
  const parsed = addBentoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Champs invalides' };
  }
  const verdict = checkSlug(parsed.data.slug);
  if (!verdict.ok) return verdict;

  const mobile = createMobileClient();
  if (!mobile) {
    return {
      ok: false,
      error: 'Supabase mobile non configuré (MOBILE_SUPABASE_URL / MOBILE_SUPABASE_SERVICE_ROLE_KEY).',
    };
  }

  // `slug` et `is_primary` sont absents du type `Insert` de `bentos`, et
  // c'est voulu : ce type décrit ce qu'un CLIENT a le droit d'écrire, et les
  // droits colonne ne lui accordent que `user_id`. Le back-office écrit avec
  // la clé service-role, qui n'est pas soumise à ces grants. La conversion
  // est donc l'endroit exact où l'on quitte les droits du client, et elle
  // n'existe qu'ici. Cf. `packages/supabase-mobile/src/types.ts`.
  const payload = {
    user_id: parsed.data.userId,
    slug: verdict.slug,
    is_primary: false,
  } as unknown as Database['public']['Tables']['bentos']['Insert'];

  const { data, error } = await mobile.from('bentos').insert(payload).select('id').single();

  if (error) {
    // 23505 : le couple (user_id, slug) est déjà pris. Le message de Postgres
    // parle de contrainte, celui-ci parle de ce que la personne a fait.
    if (error.code === '23505') {
      return { ok: false, error: `Ce compte a déjà un bento à l'adresse « ${verdict.slug} ».` };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath('/bentos');
  revalidatePath('/utilisateurs');
  return { ok: true, bentoId: data.id };
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
