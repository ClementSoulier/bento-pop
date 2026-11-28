/**
 * Les contacts de la newsletter chez Resend (docs/NEWSLETTER-ENVOI.md, D8) :
 * créés à l'inscription, effacés à la désinscription, juste après la réponse.
 * L'alignement que le back-office fait avant chaque envoi rattrape un appel
 * perdu ici.
 *
 * Variables **runtime** de l'app landing sur Coolify, jamais `NEXT_PUBLIC_` :
 * `RESEND_NEWSLETTER_API_KEY` (clé « full access » propre à la landing) et
 * `RESEND_NEWSLETTER_SEGMENT_ID`. Absentes, rien ne part et les formulaires
 * marchent comme avant. `RESEND_API_URL` ne sert qu'à la recette locale.
 *
 * Les journaux ne citent jamais l'adresse.
 */

/** Le domaine d'envoi de la newsletter : le webhook ignore les mails des autres. */
export const NEWSLETTER_DOMAIN = 'news.bento-pop.com';

type Env = Partial<Record<string, string | undefined>>;

export type NewsletterContacts = {
  add: (email: string) => Promise<void>;
  remove: (email: string) => Promise<void>;
};

export function newsletterContactsFromEnv(
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): NewsletterContacts | null {
  const apiKey = env.RESEND_NEWSLETTER_API_KEY?.trim();
  const segmentId = env.RESEND_NEWSLETTER_SEGMENT_ID?.trim();
  if (!apiKey || !segmentId) return null;
  const base = (env.RESEND_API_URL?.trim() || 'https://api.resend.com').replace(/\/+$/, '');

  const call = (method: 'POST' | 'DELETE', path: string, body?: unknown) =>
    fetchImpl(`${base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  const contact = (email: string) => `/contacts/${encodeURIComponent(email)}`;

  return {
    async add(email) {
      const res = await call('POST', '/contacts', {
        email,
        unsubscribed: false,
        segments: [{ id: segmentId }],
      });
      if (res.ok) return;
      // L'adresse existe déjà chez Resend, hors du segment : on l'y ajoute.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        const added = await call('POST', `${contact(email)}/segments/${encodeURIComponent(segmentId)}`);
        if (added.ok) return;
        throw new Error(`Resend, ajout au segment : ${added.status}`);
      }
      throw new Error(`Resend, création du contact : ${res.status}`);
    },
    async remove(email) {
      const res = await call('DELETE', contact(email));
      if (!res.ok && res.status !== 404) throw new Error(`Resend, effacement du contact : ${res.status}`);
    },
  };
}

/** Un appel à Resend qui ne doit jamais faire échouer ce qui l'a précédé. */
export async function bestEffort(label: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (e) {
    console.error(`[newsletter] ${label} :`, e instanceof Error ? e.message : e);
  }
}
