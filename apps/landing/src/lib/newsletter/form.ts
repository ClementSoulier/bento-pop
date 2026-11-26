import { z } from 'zod';

/**
 * Ce que partagent les formulaires de la newsletter et leurs actions serveur
 * (docs/NEWSLETTER.md). Rien ici ne touche au réseau : testable seul.
 */

/** D'où vient l'inscription : la section de l'accueil ou le pied de page. */
export const NEWSLETTER_SOURCES = ['home', 'footer'] as const;
export type NewsletterSource = (typeof NEWSLETTER_SOURCES)[number];

/**
 * Le champ piège : invisible pour un humain, rempli par les robots qui
 * remplissent tout. Rempli, l'envoi fait semblant de réussir et ne fait rien.
 */
export const HONEYPOT_FIELD = 'website';

export type NewsletterResult =
  | { status: 'success' }
  | { status: 'error'; reason: 'invalid_email' | 'rate_limited' | 'unavailable' };

const emailSchema = z.string().trim().toLowerCase().email().max(254);

/** L'adresse en minuscules, sans espaces autour ; `null` si elle n'en est pas une. */
export function parseEmail(value: unknown): string | null {
  const parsed = emailSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Une provenance inconnue compte pour l'accueil : la donnée reste propre. */
export function parseSource(value: unknown): NewsletterSource {
  return NEWSLETTER_SOURCES.find((s) => s === value) ?? 'home';
}

export function isHoneypotFilled(formData: FormData): boolean {
  const value = formData.get(HONEYPOT_FIELD);
  return typeof value === 'string' && value.trim() !== '';
}
