'use server';

import { headers } from 'next/headers';
import { after } from 'next/server';
import { clientAddress } from '@/lib/bento/visits';
import { createAdminClient } from '@/lib/supabase/admin';
import { subscriptionMessage, unsubscriptionMessage } from './discord';
import { isHoneypotFilled, parseEmail, parseSource, type NewsletterResult } from './form';
import { createRateLimiter } from './rate-limit';
import { bestEffort, newsletterContactsFromEnv } from './resend';
import { SUBSCRIBERS_TABLE as TABLE, notifyTeam } from './team';

/**
 * Inscription et désinscription à la newsletter (docs/NEWSLETTER.md).
 *
 * Écriture en service-role : la table n'a aucune policy pour les visiteurs.
 * Les deux réponses ne disent jamais si une adresse était déjà dans la liste,
 * pour que personne ne puisse s'en servir pour tester qui est inscrit.
 *
 * Le message Discord part après la réponse (`after`), sur le webhook
 * `NEWSLETTER_DISCORD_WEBHOOK_URL` : variable **serveur**, lue à chaque
 * envoi, dans Coolify sur l'app landing, au runtime. Absente, rien ne part.
 * Le contact est créé ou effacé chez Resend de même, après la réponse
 * (docs/NEWSLETTER-ENVOI.md).
 */

/** Cinq envois par adresse IP et par quart d'heure, pour chaque formulaire. */
const subscribeLimiter = createRateLimiter({ limit: 5, windowMs: 15 * 60_000 });
const unsubscribeLimiter = createRateLimiter({ limit: 5, windowMs: 15 * 60_000 });

async function visitorKey(): Promise<string> {
  return clientAddress(await headers()) ?? 'inconnu';
}

/** Une fois la réponse partie : le contact chez Resend, si l'envoi est branché. */
function syncContact(action: 'add' | 'remove', email: string) {
  const contacts = newsletterContactsFromEnv();
  if (!contacts) return;
  after(() =>
    bestEffort(action === 'add' ? 'contact Resend non créé' : 'contact Resend non effacé', () =>
      contacts[action](email),
    ),
  );
}

export async function subscribeNewsletter(formData: FormData): Promise<NewsletterResult> {
  if (isHoneypotFilled(formData)) return { status: 'success' };

  const email = parseEmail(formData.get('email'));
  if (!email) return { status: 'error', reason: 'invalid_email' };

  if (!subscribeLimiter.take(await visitorKey())) {
    return { status: 'error', reason: 'rate_limited' };
  }

  const supabase = createAdminClient();
  if (!supabase) return { status: 'error', reason: 'unavailable' };

  const { error } = await supabase
    .from(TABLE)
    .insert({ email, source: parseSource(formData.get('source')) });

  // 23505 : l'adresse est déjà inscrite. Même réponse qu'une inscription
  // nouvelle, mais rien ne part sur Discord.
  if (error && error.code !== '23505') {
    console.error(`[newsletter] inscription refusée par la base : ${error.code} ${error.message}`);
    return { status: 'error', reason: 'unavailable' };
  }
  if (!error) {
    notifyTeam(supabase, subscriptionMessage);
    syncContact('add', email);
  }

  return { status: 'success' };
}

export async function unsubscribeNewsletter(formData: FormData): Promise<NewsletterResult> {
  if (isHoneypotFilled(formData)) return { status: 'success' };

  const email = parseEmail(formData.get('email'));
  if (!email) return { status: 'error', reason: 'invalid_email' };

  if (!unsubscribeLimiter.take(await visitorKey())) {
    return { status: 'error', reason: 'rate_limited' };
  }

  const supabase = createAdminClient();
  if (!supabase) return { status: 'error', reason: 'unavailable' };

  // `email` est en citext : la comparaison ignore la casse.
  const { data, error } = await supabase.from(TABLE).delete().eq('email', email).select('id');

  if (error) {
    console.error(`[newsletter] désinscription refusée par la base : ${error.code} ${error.message}`);
    return { status: 'error', reason: 'unavailable' };
  }
  if (data.length > 0) {
    notifyTeam(supabase, unsubscriptionMessage);
    syncContact('remove', email);
  }

  return { status: 'success' };
}
