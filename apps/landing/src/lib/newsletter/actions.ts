'use server';

import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_email' | 'no_supabase' | 'server_error' };

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

/**
 * Enregistre une adresse email dans `landing_newsletter_subscribers`.
 * Idempotent : un upsert sur la contrainte unique d'email.
 *
 * Quand on basculera vers un ESP (Brevo / Mailchimp), on remplacera ce corps
 * par un appel API à l'ESP — la signature reste stable, le formulaire ne
 * bouge pas.
 */
export async function subscribeNewsletter(formData: FormData): Promise<SubscribeResult> {
  const parsed = schema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { ok: false, reason: 'invalid_email' };

  const supabase = createAdminClient();
  if (!supabase) return { ok: false, reason: 'no_supabase' };

  const { error } = await supabase
    .from('landing_newsletter_subscribers')
    .upsert(
      { email: parsed.data.email, source: 'landing' },
      { onConflict: 'email', ignoreDuplicates: true },
    );

  if (error) return { ok: false, reason: 'server_error' };
  return { ok: true };
}
