/**
 * Les règles d'une adresse de bento, côté back-office.
 *
 * **La base fait foi**, et c'est délibéré : la contrainte `bentos_slug_format`
 * et la fonction `create_bento()` tiennent les mêmes règles en SQL, où rien ne
 * peut les contourner. Ce module ne sert qu'à refuser une saisie avant de
 * partir en base, pour rendre un message lisible plutôt qu'une violation de
 * contrainte. Toute divergence se corrige ici, pas là-bas.
 *
 * Cf. `apps/mobile/supabase/migrations/20260916140000_bentos_lift_unique.sql`.
 */

/** 3 à 40 caractères, minuscules, chiffres et tirets, ni en tête ni en queue. */
export const SLUG_FORMAT = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/**
 * Adresses qu'un bento ne peut pas porter.
 *
 * Les deux premières ne sont pas théoriques. Next expose l'aperçu d'un bento
 * à `/u/<pseudo>/opengraph-image/…` et `/u/<pseudo>/twitter-image/…` par
 * convention de fichier, et une route de convention l'emporte sur un segment
 * dynamique : un bento portant ces slugs serait **définitivement
 * inatteignable**, sans qu'aucune erreur ne le signale. Les suivantes sont
 * gardées pour les chantiers 13 et 21.
 */
export const SLUGS_RESERVES = [
  'opengraph-image',
  'twitter-image',
  'icon',
  'apple-icon',
  'sitemap',
  'robots',
  'tous',
  'edit',
  'new',
  'api',
  'admin',
  'settings',
] as const;

export type SlugVerdict = { ok: true; slug: string } | { ok: false; error: string };

/** Normalise et vérifie une adresse saisie dans le back-office. */
export function checkSlug(raw: string): SlugVerdict {
  const slug = raw.trim().toLowerCase();
  if (!SLUG_FORMAT.test(slug)) {
    return {
      ok: false,
      error: 'Adresse invalide : 3 à 40 caractères, minuscules, chiffres et tirets.',
    };
  }
  if ((SLUGS_RESERVES as readonly string[]).includes(slug)) {
    return { ok: false, error: `« ${slug} » est une adresse réservée.` };
  }
  return { ok: true, slug };
}
