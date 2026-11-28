/**
 * Client minimal de l'API de Resend pour la newsletter (docs/NEWSLETTER-ENVOI.md,
 * D14 et D15) : un `fetch` par appel, aucune dépendance.
 *
 * Variables **runtime** de l'app back-office sur Coolify, jamais `NEXT_PUBLIC_` :
 * `RESEND_NEWSLETTER_API_KEY` (clé « full access » propre au BO) et
 * `RESEND_NEWSLETTER_SEGMENT_ID` (le segment « Newsletter bento-pop.com »).
 * `RESEND_API_URL` ne sert qu'à la recette locale, contre un faux Resend.
 *
 * Les messages d'erreur ne citent jamais d'adresse : ils finissent dans les
 * journaux du conteneur.
 */

type Env = Partial<Record<string, string | undefined>>;
type Fetch = typeof fetch;

export class ResendError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = 'ResendError';
  }
}

export type ResendContact = { id: string; email: string; unsubscribed: boolean };

/** `draft`, `scheduled`, `queued`, `sent` ou `canceled`. */
export type ResendBroadcast = {
  id: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
};

export type ResendEmail = {
  from: string;
  to: string[];
  reply_to?: string;
  subject: string;
  html: string;
  text?: string;
};

export type ResendClient = ReturnType<typeof createResend>;

export function createResend(config: { apiKey: string; baseUrl?: string; fetchImpl?: Fetch }) {
  const base = (config.baseUrl || 'https://api.resend.com').replace(/\/+$/, '');
  const f = config.fetchImpl ?? fetch;

  async function call<T>(
    label: string,
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    const res = await f(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    if (!res.ok) throw new ResendError(`Resend, ${label} : ${res.status}`, res.status, text);
    return (text ? JSON.parse(text) : {}) as T;
  }

  const contactPath = (idOrEmail: string) => `/contacts/${encodeURIComponent(idOrEmail)}`;

  return {
    sendEmail(email: ResendEmail, idempotencyKey?: string) {
      return call<{ id: string }>(
        'envoi d’un mail',
        'POST',
        '/emails',
        email,
        idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      );
    },

    /** Tous les contacts d'un segment, par pages de 100. */
    async listSegmentContacts(segmentId: string): Promise<ResendContact[]> {
      const contacts: ResendContact[] = [];
      let after: string | null = null;
      for (let page = 0; page < 1000; page++) {
        const query = new URLSearchParams({ segment_id: segmentId, limit: '100' });
        if (after) query.set('after', after);
        const res = await call<{ has_more?: boolean; data?: ResendContact[] }>(
          'liste des contacts',
          'GET',
          `/contacts?${query}`,
        );
        const data = res.data ?? [];
        contacts.push(
          ...data.map((c) => ({ id: c.id, email: c.email, unsubscribed: Boolean(c.unsubscribed) })),
        );
        const last = data[data.length - 1];
        if (!res.has_more || !last) break;
        after = last.id;
      }
      return contacts;
    },

    createContact(email: string, segmentId: string) {
      return call<{ id: string }>('création d’un contact', 'POST', '/contacts', {
        email,
        unsubscribed: false,
        segments: [{ id: segmentId }],
      });
    },

    addContactToSegment(idOrEmail: string, segmentId: string) {
      return call<{ id: string }>(
        'ajout d’un contact au segment',
        'POST',
        `${contactPath(idOrEmail)}/segments/${encodeURIComponent(segmentId)}`,
      );
    },

    /** Efface un contact ; `false` s'il n'existait pas. */
    async deleteContact(idOrEmail: string): Promise<boolean> {
      try {
        await call('effacement d’un contact', 'DELETE', contactPath(idOrEmail));
        return true;
      } catch (e) {
        if (e instanceof ResendError && e.status === 404) return false;
        throw e;
      }
    },

    createBroadcast(input: {
      segmentId: string;
      from: string;
      replyTo: string;
      subject: string;
      html: string;
      text: string;
      name: string;
    }) {
      return call<{ id: string }>('création du Broadcast', 'POST', '/broadcasts', {
        segment_id: input.segmentId,
        from: input.from,
        reply_to: input.replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text || undefined,
        name: input.name,
      });
    },

    sendBroadcast(id: string, scheduledAt: string | null) {
      return call<{ id: string }>(
        'envoi du Broadcast',
        'POST',
        `/broadcasts/${encodeURIComponent(id)}/send`,
        scheduledAt ? { scheduled_at: scheduledAt } : {},
      );
    },

    getBroadcast(id: string) {
      return call<ResendBroadcast>('lecture du Broadcast', 'GET', `/broadcasts/${encodeURIComponent(id)}`);
    },

    /** Efface un Broadcast pas encore parti, ce qui annule sa programmation. */
    deleteBroadcast(id: string) {
      return call<{ deleted: boolean }>(
        'annulation du Broadcast',
        'DELETE',
        `/broadcasts/${encodeURIComponent(id)}`,
      );
    },
  };
}

export type NewsletterResend = { resend: ResendClient; segmentId: string };

/** Le client de la newsletter, ou `null` tant que ses variables manquent. */
export function newsletterResendFromEnv(
  env: Env = process.env,
  fetchImpl?: Fetch,
): NewsletterResend | null {
  const apiKey = env.RESEND_NEWSLETTER_API_KEY?.trim();
  const segmentId = env.RESEND_NEWSLETTER_SEGMENT_ID?.trim();
  if (!apiKey || !segmentId) return null;
  return {
    resend: createResend({ apiKey, baseUrl: env.RESEND_API_URL?.trim(), fetchImpl }),
    segmentId,
  };
}

/** Le message d'une erreur de Resend, pour l'écran : le corps de sa réponse dit souvent pourquoi. */
export function resendErrorMessage(e: unknown): string {
  if (e instanceof ResendError) {
    try {
      const parsed = JSON.parse(e.body) as { message?: string };
      if (parsed.message) return `${e.message} (${parsed.message})`;
    } catch {
      // Corps illisible : le code suffit.
    }
    return e.message;
  }
  if (e instanceof Error && e.name === 'TimeoutError') return 'Resend ne répond pas (délai dépassé).';
  return e instanceof Error ? e.message : String(e);
}
