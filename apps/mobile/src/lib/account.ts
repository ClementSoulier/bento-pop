/**
 * Garder son compte, chantier 28 : tout ce qui se décide sans réseau.
 *
 * Un compte se garde par une adresse email, vérifiée par un code à 6 chiffres
 * (D1, D7). Ce module dit si une adresse est recevable, comment la montrer
 * sans l'afficher en entier (D13), si un compte est gardé, et ce qu'un refus
 * de l'authentification veut dire pour celui qui l'a provoqué.
 *
 * Aucun import de `react-native` : testé sous `node:test`.
 */

/** Longueur du code, celle de `otp_length` dans la configuration (D7). */
export const CODE_LENGTH = 6;

/** Délai avant de redemander un code, `max_frequency` (D7). */
export const RESEND_DELAY_S = 60;

/** La longueur maximale d'une adresse, RFC 5321. */
const EMAIL_MAX = 254;

/**
 * Une adresse plausible : quelque chose, une arobase, un domaine à point. La
 * vérification qui compte est le code reçu ; celle-ci évite seulement
 * d'envoyer un code à une faute de frappe évidente.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/;

/** L'adresse telle qu'on la range : sans espaces autour, en minuscules. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length <= EMAIL_MAX && EMAIL_SHAPE.test(email);
}

/**
 * L'adresse masquée, première lettre et domaine : « c•••@gmail.com ». Assez
 * pour qu'on reconnaisse la sienne, pas assez pour la lire par-dessus une
 * épaule (D13).
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return email;
  return `${email[0]}•••${email.slice(at)}`;
}

/** Ce qu'on tape, réduit aux chiffres et à la longueur du code. */
export function cleanCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
}

export function isCompleteCode(code: string): boolean {
  return code.length === CODE_LENGTH && /^\d+$/.test(code);
}

type UserLike = { is_anonymous?: boolean | null; email?: string | null } | null | undefined;

/**
 * L'adresse qui garde ce compte, ou `null` pour un compte anonyme.
 *
 * Une adresse en attente de son code n'est pas dans `email` mais dans
 * `new_email` : elle ne garde encore rien, contrôle 2 de
 * `scripts/check-account.mjs`.
 */
export function keptEmail(user: UserLike): string | null {
  if (!user || user.is_anonymous) return null;
  return user.email && user.email.length > 0 ? user.email : null;
}

export type AccountError =
  | 'invalid-email'
  | 'email-taken'
  | 'wrong-code'
  | 'too-soon'
  | 'too-many'
  | 'no-account'
  | 'send-failed'
  | 'network'
  | 'unknown';

type ErrorLike = { name?: string; code?: string; status?: number; message?: string };

/** « For security purposes, you can only request this after 42 seconds. » */
const WAIT_SECONDS = /after (\d+) seconds?/i;

/**
 * Ce qu'un refus de l'authentification veut dire. Les codes sont ceux de
 * GoTrue, relevés contre la pile locale par `scripts/check-account.mjs` :
 * `email_exists` pour une adresse déjà gardée, `otp_expired` pour un code
 * faux ou expiré, `over_email_send_rate_limit` pour un renvoi trop proche ou
 * le plafond d'envoi, `otp_disabled` pour une adresse sans compte.
 */
export function accountError(error: unknown): AccountError {
  const e = (error ?? {}) as ErrorLike;
  const code = e.code ?? '';
  if (code === 'email_exists' || code === 'user_already_exists') return 'email-taken';
  if (code === 'otp_expired') return 'wrong-code';
  if (code === 'otp_disabled' || code === 'user_not_found') return 'no-account';
  if (code === 'email_address_invalid' || code === 'validation_failed') return 'invalid-email';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || e.status === 429) {
    return WAIT_SECONDS.test(e.message ?? '') ? 'too-soon' : 'too-many';
  }
  // GoTrue répond 500 quand son serveur de mails refuse l'envoi : le plafond
  // quotidien de Resend (D1), ou une configuration cassée. Ce n'est pas le
  // réseau de l'utilisateur.
  if (/error sending .*email/i.test(e.message ?? '')) return 'send-failed';
  if (e.name === 'AuthRetryableFetchError') return 'network';
  if (/network request failed|network connection was lost|fetch failed|failed to fetch/i.test(e.message ?? '')) {
    return 'network';
  }
  return 'unknown';
}

/** Les secondes à attendre avant un nouveau code, si le refus les donne. */
export function waitSeconds(error: unknown): number | null {
  const match = WAIT_SECONDS.exec((error as ErrorLike | null)?.message ?? '');
  return match ? Number(match[1]) : null;
}

const MESSAGES: Record<AccountError, string> = {
  'invalid-email': 'Cette adresse ne semble pas valide. Vérifie-la.',
  'email-taken': "Cette adresse garde déjà un compte. Pour le retrouver, touche « J'ai déjà un compte ».",
  'wrong-code': 'Ce code ne marche pas. Vérifie-le, ou demandes-en un nouveau.',
  'too-soon': 'Attends un peu avant de demander un nouveau code.',
  'too-many': 'Trop de demandes pour le moment. Réessaie dans une heure.',
  'no-account': "Aucun compte n'est gardé avec cette adresse.",
  'send-failed': "Le code n'a pas pu partir. Réessaie un peu plus tard.",
  network: 'Pas de connexion. Réessaie quand tu es en ligne.',
  unknown: "Ça n'a pas marché. Réessaie dans un instant.",
};

/** La phrase à montrer pour un refus. */
export function accountErrorMessage(error: unknown): string {
  const kind = accountError(error);
  if (kind === 'too-soon') {
    const seconds = waitSeconds(error);
    if (seconds !== null) {
      return `Attends encore ${seconds} seconde${seconds > 1 ? 's' : ''} avant de demander un nouveau code.`;
    }
  }
  return MESSAGES[kind];
}
