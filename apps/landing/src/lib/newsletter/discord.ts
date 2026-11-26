/**
 * Le message posté dans le salon Discord de l'équipe à chaque inscription et
 * désinscription (docs/NEWSLETTER.md).
 *
 * Jamais d'adresse email : seulement l'événement et le nombre d'inscrits. Ainsi
 * Discord ne reçoit aucune donnée personnelle, et la politique de
 * confidentialité n'a pas à le déclarer. La liste vit au back-office.
 */

const COUNT = new Intl.NumberFormat('fr-FR');

function subscribers(total: number | null): string {
  if (total === null) return '';
  return ` (${COUNT.format(total)} inscrit${total > 1 ? 's' : ''})`;
}

export function subscriptionMessage(total: number | null): string {
  return `📬 Nouvelle inscription à la newsletter${subscribers(total)}`;
}

export function unsubscriptionMessage(total: number | null): string {
  return `👋 Une désinscription de la newsletter${subscribers(total)}`;
}

export type DiscordOutcome = 'sent' | 'skipped' | 'failed';

/**
 * Poste `content` sur le webhook. Sans webhook configuré, ne fait rien : la
 * variable est facultative et son absence ne doit rien casser. Une erreur de
 * Discord ne remonte jamais au visiteur, déjà inscrit à ce moment-là.
 */
export async function postToDiscord(
  webhookUrl: string | undefined,
  content: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DiscordOutcome> {
  const url = webhookUrl?.trim();
  if (!url) return 'skipped';
  try {
    const { protocol } = new URL(url);
    if (protocol !== 'https:' && protocol !== 'http:') return 'skipped';
  } catch {
    return 'skipped';
  }

  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `allowed_mentions` vide : aucun @everyone ni @here possible, quoi que
      // contienne le texte un jour.
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[newsletter] Discord a répondu ${res.status}.`);
      return 'failed';
    }
    return 'sent';
  } catch (error) {
    console.error('[newsletter] Discord injoignable :', error instanceof Error ? error.message : error);
    return 'failed';
  }
}
