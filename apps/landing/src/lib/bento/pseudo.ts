/**
 * Validation du segment d'URL `/u/[pseudo]`.
 *
 * Miroir exact de la contrainte SQL du projet mobile
 * (`20260511000000_initial_schema.sql:45`) :
 *
 *   constraint pseudo_format check (pseudo ~ '^[A-Za-z0-9_.]{3,20}$')
 *
 * Toute valeur non conforme doit produire un 404 **avant** la moindre
 * requête, pour trois raisons :
 *
 * 1. Sécurité. La recherche se fait en `.ilike()`, où `%` et `_` sont des
 *    jokers PostgREST. Une URL du type `/u/%25` ferait matcher des lignes
 *    arbitraires. La validation en amont ferme la porte. (Le `_` est
 *    autorisé par la contrainte SQL, donc reste un joker possible : c'est
 *    pour ça que `findUserPseudo` compare aussi le résultat exact, cf.
 *    `queries.ts`.)
 * 2. Coût. Un scanner qui balaie `/u/<aléatoire>` ne doit pas déclencher
 *    un aller-retour Supabase par requête.
 * 3. Latence. Un 404 décidé sans I/O est immédiat.
 */

export const PSEUDO_MIN = 3;
export const PSEUDO_MAX = 20;

/**
 * Ancré des deux côtés et sans drapeau global : un `RegExp` avec `g`
 * conserve un `lastIndex` entre les appels et renverrait alternativement
 * `true` et `false` sur la même entrée.
 */
const PSEUDO_PATTERN = /^[A-Za-z0-9_.]{3,20}$/;

/**
 * `true` si la valeur peut correspondre à un pseudo stocké en base.
 * Accepte `unknown` : le paramètre de route est du texte non fiable, et
 * `params` peut aussi livrer un tableau si la route change un jour.
 */
export function isValidPseudo(value: unknown): value is string {
  return typeof value === 'string' && PSEUDO_PATTERN.test(value);
}

/**
 * `true` si l'URL demandée n'est pas la forme canonique du pseudo.
 *
 * L'unicité est posée sur `lower(pseudo)` (`users_pseudo_lower_idx`), donc
 * `/u/Keremasan` et `/u/keremasan` désignent la même personne. Sans
 * redirection, c'est du contenu dupliqué pour les moteurs et deux entrées
 * de cache distinctes pour un seul contenu. La forme canonique est celle
 * **stockée en base**, pas la minuscule : c'est la casse que l'utilisateur
 * a choisie et qu'il verra dans ses partages.
 */
export function needsCanonicalRedirect(requested: string, stored: string): boolean {
  return requested !== stored;
}
