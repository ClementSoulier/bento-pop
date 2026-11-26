'use server';

import { headers } from 'next/headers';
import { after } from 'next/server';
import { clientAddress } from '@/lib/bento/visits';
import { createAdminClient } from '@/lib/supabase/admin';
import { postToDiscord, subscriptionMessage, unsubscriptionMessage } from './discord';
import { isHoneypotFilled, parseEmail, parseSource, type NewsletterResult } from './form';
import { createRateLimiter } from './rate-limit';

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
 */

const TABLE = 'landing_newsletter_subscribers';

/** Cinq envois par adresse IP et par quart d'heure, pour chaque formulaire. */
const subscribeLimiter = createRateLimiter({ limit: 5, windowMs: 15 * 60_000 });
const unsubscribeLimiter = createRateLimiter({ limit: 5, windowMs: 15 * 60_000 });

async function visitorKey(): Promise<string> {
  return clientAddress(await headers()) ?? 'inconnu';
}

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * Une fois la réponse partie : compte les inscrits et prévient l'équipe. Si le
 * compte échoue, le message part quand même, sans le nombre.
 */
function notifyTeam(supabase: AdminClient, message: (total: number | null) => string) {
  after(async () => {
    const { count, error } = await supabase
      .from(TABLE)
      .select('id', { count: 'exact', head: true });
    await postToDiscord(
      process.env.NEWSLETTER_DISCORD_WEBHOOK_URL,
      message(error ? null : count),
    );
  });
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
  if (!error) notifyTeam(supabase, subscriptionMessage);

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
  if (data.length > 0) notifyTeam(supabase, unsubscriptionMessage);

  return { status: 'success' };
}
