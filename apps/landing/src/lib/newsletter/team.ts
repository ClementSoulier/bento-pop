import { after } from 'next/server';
import type { createAdminClient } from '@/lib/supabase/admin';
import { postToDiscord } from './discord';

export const SUBSCRIBERS_TABLE = 'landing_newsletter_subscribers';

export type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * Une fois la réponse partie : compte les inscrits et prévient l'équipe sur
 * Discord (`NEWSLETTER_DISCORD_WEBHOOK_URL`, variable runtime de la landing).
 * Si le compte échoue, le message part quand même, sans le nombre.
 */
export function notifyTeam(supabase: AdminClient, message: (total: number | null) => string) {
  after(async () => {
    const { count, error } = await supabase
      .from(SUBSCRIBERS_TABLE)
      .select('id', { count: 'exact', head: true });
    await postToDiscord(process.env.NEWSLETTER_DISCORD_WEBHOOK_URL, message(error ? null : count));
  });
}
