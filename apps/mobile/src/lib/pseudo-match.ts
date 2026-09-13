/**
 * Correspondance de pseudo, sans dépendance à Supabase.
 *
 * Séparé de `pseudo.ts`, qui importe le client : ces fonctions-ci sont
 * pures et doivent rester importables par le runner de tests.
 *
 * Elles existent à cause d'une particularité de PostgREST : il n'a pas
 * d'opérateur « égal en ignorant la casse ». On passe donc par `ilike`, où
 * `_` est le joker « un caractère », et `_` est autorisé par la contrainte
 * SQL sur `pseudo`. Un `ilike` doit donc toujours être re-filtré.
 *
 * `keepPrefixMatches` vivait ici pour la recherche de l'onglet « Trouver ».
 * Elle a disparu au chantier 6 : la fonction `search_bentos` échappe les
 * jokers à la source, ce qui vaut mieux qu'un filtre client, lequel se
 * contourne en oubliant de l'appeler. Reste `pickExactPseudo`, utilisée par
 * la résolution des liens profonds, qui n'échappe rien.
 */

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
