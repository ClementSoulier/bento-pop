'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

const settingsSchema = z.object({
  seasonNumber: z.coerce.number().int().min(1, 'Min 1').max(99, 'Max 99'),
});

export type SettingsFormPayload = z.input<typeof settingsSchema>;

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Met à jour les réglages globaux de la landing.
 * Comme les réglages affectent toute la landing on revalide la racine — la
 * prochaine requête `/` rendra le SSR avec les nouvelles valeurs.
 */
export async function updateSettings(input: SettingsFormPayload): Promise<ActionResult> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Champs invalides' };
  }
  const supabase = await createServerClient();
  const { error } = await supabase
    .from('landing_settings')
    .update({ season_number: parsed.data.seasonNumber } as never)
    .eq('id', 'singleton');
  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  revalidatePath('/config');
  return { ok: true };
}
