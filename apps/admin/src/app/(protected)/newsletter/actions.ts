'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Retire une adresse de la newsletter, par exemple sur une demande reçue par
 * mail. Effacement définitif, sous la RLS (« admins delete newsletter »).
 * Pas de message Discord : c'est l'équipe elle-même qui agit.
 */
export async function deleteSubscriber(id: string): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: 'Identifiant invalide' };

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('landing_newsletter_subscribers')
    .delete()
    .eq('id', parsed.data)
    .select('id');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: 'Adresse introuvable, ou déjà effacée.' };
  }

  revalidatePath('/newsletter');
  revalidatePath('/');
  return { ok: true };
}
