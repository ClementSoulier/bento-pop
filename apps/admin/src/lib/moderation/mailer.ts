/**
 * L'envoi des mails de modération, chantier 22 (D11, D12, D13).
 *
 * Deux transports, sans dépendance, un `fetch` chacun :
 *
 *   - **Resend** en production, par son API, avec une clé propre au
 *     back-office et un domaine à part, `moderation.bento-pop.com` (D12) :
 *     la réputation de `auth.bento-pop.com` ne dépend ainsi que des codes du
 *     chantier 28 ;
 *   - **Mailpit** en local, par son API d'envoi : la recette lit les mails
 *     sans rien envoyer.
 *
 * Variables **runtime** sur Coolify, jamais `NEXT_PUBLIC_` :
 * `MAIL_TRANSPORT` (`resend` par défaut, ou `mailpit`), `RESEND_API_KEY`,
 * `MAILPIT_URL`, `MODERATION_FROM`. Sans elles, `createMailer` rend `null`,
 * rien ne part, et l'écran de modération le dit.
 */

export type MailMessage = { to: readonly string[]; subject: string; text: string; html: string };
export type Mailer = {
  transport: 'resend' | 'mailpit';
  send: (message: MailMessage) => Promise<void>;
};

type Env = Partial<Record<string, string | undefined>>;
type Fetch = typeof fetch;

/** « Bento Pop <moderation@x.fr> » ou « moderation@x.fr ». */
export function parseSender(raw: string): { name: string; email: string } | null {
  const named = /^\s*(.*?)\s*<\s*([^\s<>@]+@[^\s<>@]+)\s*>\s*$/.exec(raw);
  if (named) return { name: named[1] ?? '', email: named[2]! };
  const bare = raw.trim();
  return /^[^\s@]+@[^\s@]+$/.test(bare) ? { name: '', email: bare } : null;
}

export function createMailer(env: Env = process.env, fetchImpl: Fetch = fetch): Mailer | null {
  const from = env.MODERATION_FROM ? parseSender(env.MODERATION_FROM) : null;
  if (!from) return null;

  if (env.MAIL_TRANSPORT === 'mailpit') {
    const base = env.MAILPIT_URL?.replace(/\/+$/, '');
    if (!base) return null;
    return {
      transport: 'mailpit',
      send: async (m) => {
        const res = await fetchImpl(`${base}/api/v1/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            From: { Email: from.email, Name: from.name },
            To: m.to.map((email) => ({ Email: email })),
            Subject: m.subject,
            Text: m.text,
            HTML: m.html,
          }),
        });
        if (!res.ok) throw new Error(`Mailpit : ${res.status} ${await res.text()}`);
      },
    };
  }

  const key = env.RESEND_API_KEY;
  if (!key) return null;
  return {
    transport: 'resend',
    send: async (m) => {
      const res = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: from.name ? `${from.name} <${from.email}>` : from.email,
          to: m.to,
          subject: m.subject,
          text: m.text,
          html: m.html,
        }),
      });
      if (!res.ok) throw new Error(`Resend : ${res.status} ${await res.text()}`);
    },
  };
}
