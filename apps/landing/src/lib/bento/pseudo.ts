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
 * Forme canonique d'un pseudo **dans une URL** : en minuscules.
 *
 * L'unicité est posée sur `lower(pseudo)` (`users_pseudo_lower_idx`), donc
 * `/u/Keremasan` et `/u/keremasan` désignent la même personne.
 *
 * On aurait pu retenir la casse stockée en base comme forme canonique,
 * plus fidèle à ce que l'utilisateur a choisi. C'est écarté pour deux
 * raisons, la seconde étant décisive :
 *
 * 1. Décider la redirection demanderait de connaître la casse stockée,
 *    donc d'interroger la base **avant** de pouvoir rediriger.
 * 2. Surtout, chaque variante de casse deviendrait une entrée de cache et
 *    une requête distinctes. Sur une URL publique, n'importe qui peut
 *    demander `/u/KeremasaN`, `/u/kEremasan`… et générer autant d'entrées
 *    ISR et d'allers-retours Supabase qu'il y a de combinaisons. En
 *    minuscules, tout cela redirige lexicalement, sans toucher la base.
 *
 * La casse choisie par l'utilisateur reste affichée dans la page ; seule
 * l'adresse est normalisée.
 */
export function canonicalPseudo(pseudo: string): string {
  return pseudo.toLowerCase();
}

/** `true` si l'URL demandée n'est pas déjà sous sa forme canonique. */
export function needsCanonicalRedirect(requested: string): boolean {
  return requested !== canonicalPseudo(requested);
}
