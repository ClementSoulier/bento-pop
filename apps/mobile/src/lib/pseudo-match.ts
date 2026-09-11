/**
 * Correspondance de pseudo, sans dépendance à Supabase.
 *
 * Séparé de `pseudo.ts`, qui importe le client : ces fonctions-ci sont
 * pures et doivent rester importables par le runner de tests.
 *
 * Elles existent à cause d'une particularité de PostgREST : il n'a pas
 * d'opérateur « égal en ignorant la casse ». On passe donc par `ilike`,
 * où `_` est le joker « un caractère » — et `_` est autorisé par la
 * contrainte SQL sur `pseudo`. Toute recherche doit donc être re-filtrée
 * côté client.
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

/**
 * Filtre des résultats de recherche sur un vrai préfixe.
 *
 * `ilike('pseudo', 'dark_%')` remonte aussi `darka…` : le joker élargit
 * silencieusement la recherche et affiche des pseudos que l'utilisateur
 * n'a pas demandés.
 */
export function keepPrefixMatches<T extends WithPseudo>(
  rows: readonly T[],
  prefix: string,
): T[] {
  const target = prefix.trim().toLowerCase();
  if (target.length === 0) return [...rows];
  return rows.filter((row) => row.pseudo.toLowerCase().startsWith(target));
}
