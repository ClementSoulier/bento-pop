/**
 * Slugifie une chaîne pour usage dans une URL : minuscules, tirets,
 * accents normalisés, caractères non autorisés supprimés.
 *
 * Pas de dep externe (slugify n'est pas dans les deps actuelles) —
 * implémentation simple et déterministe.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
