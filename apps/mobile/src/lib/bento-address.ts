/**
 * L'adresse d'un bento, en un seul endroit.
 *
 * Chantier 16. Avant lui, chaque écran écrivait `/u/${pseudo}` à la main :
 * six occurrences, toutes justes tant qu'un compte n'avait qu'un bento, toutes
 * fausses à partir du deuxième. Le fil et la recherche portaient déjà un
 * identifiant de bento et le jetaient au moment de naviguer.
 *
 * La règle tient en une phrase : **le bento principal vit à l'adresse du
 * compte, les autres sous leur slug.** Elle est la même dans l'app et sur le
 * web (`apps/landing/src/lib/bento/metadata.ts`), et elle doit le rester : ce
 * sont les deux moitiés d'un même lien partagé.
 */

/**
 * Chemin d'un bento dans l'app, tel que `router.push` l'attend.
 *
 * `isPrimary` plutôt qu'une comparaison de slug : c'est la base qui décide
 * quel bento est le principal, et le slug du principal n'a rien de
 * conventionnel. Les bentos existants portent `mon-bento`, mais rien ne
 * l'impose.
 */
export function bentoRoute(
  pseudo: string,
  slug?: string | null,
  isPrimary = true,
): `/u/${string}` {
  const compte = `/u/${pseudo}` as const;
  return isPrimary || !slug ? compte : (`${compte}/${slug}` as const);
}
