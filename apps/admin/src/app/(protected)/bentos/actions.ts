'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createMobileClient } from '@/lib/supabase/mobile';

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
