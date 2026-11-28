'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { newsletterResendFromEnv } from '@/lib/newsletter/resend';
import { createServerClient } from '@/lib/supabase/server';

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Retire une adresse de la newsletter, par exemple sur une demande reçue par
 * mail. Effacement définitif, sous la RLS (« admins delete newsletter »),
 * puis chez Resend si l'envoi est branché (docs/NEWSLETTER-ENVOI.md). Pas de
 * message Discord : c'est l'équipe elle-même qui agit.
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
    .select('id, email');
  if (error) return { ok: false, error: error.message };
  const removed = (data ?? []) as Array<{ id: string; email: string }>;
  if (removed.length === 0) {
    return { ok: false, error: 'Adresse introuvable, ou déjà effacée.' };
  }

  // Effacée chez nous, l'adresse l'est aussi chez Resend. Un échec ici ne
  // revient pas en arrière : l'alignement d'avant chaque envoi la rattrape.
  const nr = newsletterResendFromEnv();
  if (nr) {
    try {
      await nr.resend.deleteContact(removed[0]!.email);
    } catch (e) {
      console.warn('[newsletter] contact Resend non effacé :', e instanceof Error ? e.message : e);
    }
  }

  revalidatePath('/newsletter');
  revalidatePath('/');
  return { ok: true };
}
