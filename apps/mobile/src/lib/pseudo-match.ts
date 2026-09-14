/**
 * Règles et correspondance de pseudo, sans dépendance à Supabase.
 *
 * Séparé de `pseudo.ts`, qui importe le client : ce qui est ici est pur et
 * doit rester importable par le runner de tests.
 *
 * La correspondance existe à cause d'une particularité de PostgREST : il n'a
 * pas d'opérateur « égal en ignorant la casse ». On passe donc par `ilike`, où
 * `_` est le joker « un caractère », et `_` est autorisé par la contrainte SQL
 * sur `pseudo`.
 *
 * `keepPrefixMatches` vivait ici pour la recherche de l'onglet « Trouver ».
 * Elle a disparu au chantier 6 : la fonction `search_bentos` échappe les
 * jokers à la source, ce qui vaut mieux qu'un filtre client, lequel se
 * contourne en oubliant de l'appeler.
 *
 * Reste `pickExactPseudo`, qui re-filtre côté client. `pseudo.ts` s'en
 * contente, sans rien échapper ; `public-bento.ts` échappe à la source et la
 * garde en seconde ligne. Un filtre client ne voit que les lignes revenues :
 * si le joker en remonte plus que la limite de la requête, la bonne peut ne
 * pas en faire partie.
 */

/**
 * Règles de validation du pseudo, alignées avec la contrainte SQL
 * `users.pseudo_format` (cf. migration initiale).
 */
export const PSEUDO_REGEX = /^[A-Za-z0-9_.]{3,20}$/;
export const PSEUDO_MIN = 3;
export const PSEUDO_MAX = 20;

/** Ligne minimale renvoyée par une requête sur `users`. */
type WithPseudo = { pseudo: string };

/**
 * La ligne dont le pseudo correspond exactement, à la casse près.
 *
 * L'index unique sur `lower(pseudo)` garantit qu'il y en a au plus une.
 */
export function pickExactPseudo<T extends WithPseudo>(
  rows: readonly T[],
  wanted: string,
): T | null {
  const target = wanted.trim().toLowerCase();
  return rows.find((row) => row.pseudo.toLowerCase() === target) ?? null;
}

/**
 * Échappe les jokers `ilike` pour une correspondance littérale.
 *
 * L'antislash d'abord : traité après les autres, il doublerait ceux qu'on
 * vient d'ajouter. `*`, que PostgREST lit comme `%`, n'a pas à l'être tant que
 * `PSEUDO_REGEX` passe avant, puisqu'il l'exclut.
 *
 * Vérifié contre la production le 14 septembre 2026, clé anonyme :
 * `ilike.dark_hifu_` rend `dark_hifus`, `ilike.dark\_hifu\_` ne rend rien, et
 * `ilike.DARK\_HIFUS` rend `dark_hifus`.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
