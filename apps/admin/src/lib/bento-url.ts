/**
 * L'adresse publique d'un bento, en un seul endroit.
 *
 * Chantier 16. Quatre écrans du back-office écrivaient
 * `https://bento-pop.com/u/${pseudo}` à la main, et trois d'entre eux le
 * faisaient depuis une ligne qui désignait un **bento** : la liste des bentos,
 * la fiche d'un bento, et un signalement. Tant qu'un compte n'en avait qu'un,
 * l'approximation était juste ; à partir du deuxième, deux lignes distinctes
 * menaient à la même page, et au plus une des deux montrait ce qu'elle
 * annonçait.
 *
 * La règle est la même que côté app et côté landing, et elle doit le rester :
 * **le bento principal vit à l'adresse du compte, les autres sous leur slug.**
 */

const SITE = 'https://bento-pop.com';

/**
 * `isPrimary` et non une comparaison de slug : c'est la base qui décide quel
 * bento est le principal. Les bentos migrés portent tous `mon-bento`, mais
 * rien ne l'impose et rien ne doit en dépendre.
 */
export function publicBentoUrl(pseudo: string, slug?: string | null, isPrimary = true): string {
  const compte = `${SITE}/u/${pseudo}`;
  return isPrimary || !slug ? compte : `${compte}/${slug}`;
}

/** Le même chemin sans le domaine, pour l'afficher en monospace. */
export function publicBentoPath(pseudo: string, slug?: string | null, isPrimary = true): string {
  return publicBentoUrl(pseudo, slug, isPrimary).slice(SITE.length);
}
