import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Le webhook de Resend pour la newsletter (docs/NEWSLETTER-ENVOI.md, D8, D9,
 * D11, D15) : la signature au format Svix, vérifiée sans dépendance, puis ce
 * qu'il faut faire de chaque événement. Fonctions pures.
 */

/** Écart toléré entre l'horodatage signé et l'horloge du serveur, contre le rejeu. */
const TOLERANCE_S = 5 * 60;

export type SvixHeaders = { id: string | null; timestamp: string | null; signature: string | null };

/**
 * `whsec_<base64>` est la clé ; la signature couvre `id.horodatage.corps` ;
 * l'en-tête peut porter plusieurs signatures (`v1,<base64> v1,<base64>`),
 * pendant la rotation d'un secret.
 */
export function verifySvix(
  secret: string,
  headers: SvixHeaders,
  body: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  const sentAt = Number(timestamp);
  if (!Number.isInteger(sentAt) || Math.abs(nowSeconds - sentAt) > TOLERANCE_S) return false;

  const key = Buffer.from(secret.trim().replace(/^whsec_/, ''), 'base64');
  if (key.length === 0) return false;
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest();

  return signature.split(' ').some((part) => {
    const [version, value] = part.split(',', 2);
    if (version !== 'v1' || !value) return false;
    const given = Buffer.from(value, 'base64');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** Signe comme Resend : pour les tests et le faux Resend de la recette. */
export function signSvix(secret: string, id: string, timestamp: number, body: string): string {
  const key = Buffer.from(secret.trim().replace(/^whsec_/, ''), 'base64');
  return `v1,${createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')}`;
}

export type RemovalReason = 'unsubscribe' | 'bounce' | 'complaint';

export type WebhookPlan =
  | { kind: 'ignore' }
  /** Un mail parti : compté sur son numéro. */
  | { kind: 'count'; broadcastId: string | null }
  /** Une adresse à effacer partout, et l'événement à compter. */
  | { kind: 'erase'; email: string; reason: RemovalReason; broadcastId: string | null };

type ResendEvent = {
  type?: unknown;
  data?: {
    email?: unknown;
    unsubscribed?: unknown;
    from?: unknown;
    to?: unknown;
    broadcast_id?: unknown;
    bounce?: { type?: unknown };
  };
};

/** Le domaine de `Nom <adresse@domaine>` ou de `adresse@domaine`. */
function senderDomain(from: unknown): string | null {
  if (typeof from !== 'string') return null;
  const address = /<([^<>]+)>\s*$/.exec(from)?.[1] ?? from;
  const at = address.lastIndexOf('@');
  return at < 0 ? null : address.slice(at + 1).trim().toLowerCase();
}

/**
 * Le compte Resend sert aussi aux codes de connexion de l'app et à la
 * modération : un événement de mail ne compte que s'il vient du domaine de la
 * newsletter. Seul un rebond définitif efface l'adresse.
 */
export function planWebhookEvent(event: unknown, newsletterDomain: string): WebhookPlan {
  const { type, data } = (event ?? {}) as ResendEvent;
  if (!data || typeof type !== 'string') return { kind: 'ignore' };

  if (type === 'contact.updated') {
    if (data.unsubscribed !== true || typeof data.email !== 'string') return { kind: 'ignore' };
    return { kind: 'erase', email: data.email.trim().toLowerCase(), reason: 'unsubscribe', broadcastId: null };
  }

  if (!type.startsWith('email.')) return { kind: 'ignore' };
  if (senderDomain(data.from) !== newsletterDomain.toLowerCase()) return { kind: 'ignore' };
  const broadcastId = typeof data.broadcast_id === 'string' ? data.broadcast_id : null;
  const to = Array.isArray(data.to) ? data.to[0] : data.to;
  const email = typeof to === 'string' ? to.trim().toLowerCase() : null;

  if (type === 'email.sent') return { kind: 'count', broadcastId };
  if (!email) return { kind: 'ignore' };
  if (type === 'email.bounced') {
    return data.bounce?.type === 'Permanent'
      ? { kind: 'erase', email, reason: 'bounce', broadcastId }
      : { kind: 'ignore' };
  }
  if (type === 'email.complained') return { kind: 'erase', email, reason: 'complaint', broadcastId };
  return { kind: 'ignore' };
}
