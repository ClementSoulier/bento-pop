/**
 * Étiquettes posées sur le coin d'un post du fil.
 *
 * Module séparé de `FeedPost.tsx`, et sans import de `react-native` : c'est
 * ce qui le rend chargeable sous `node:test`. La règle de priorité ci-dessous
 * est la partie qui se perdra en premier au prochain type de bento, et elle
 * mérite d'être verrouillée.
 */

export type FeedRibbon = {
  label: string;
  color: string;
  textColor?: string;
};

export const FEATURED_RIBBON: FeedRibbon = {
  label: 'Coup de cœur',
  color: '#e63946',
  textColor: '#fbf3de',
};

/**
 * Bento composé par l'équipe pour un créateur invité.
 *
 * Couleur distincte du coup de cœur : les deux disent des choses de nature
 * différente, un avis de l'équipe d'un côté, l'origine du contenu de l'autre.
 * Une même teinte les ferait lire comme la même chose.
 */
export const GUEST_RIBBON: FeedRibbon = {
  label: 'Invité',
  color: '#0a0a0a',
  textColor: '#fbbf24',
};

/**
 * Une seule étiquette à la fois, et « invité » l'emporte.
 *
 * Un bento invité est presque toujours aussi un coup de cœur, c'est même la
 * raison de le composer. Mais « coup de cœur » est un avis que le lecteur
 * peut deviner, alors que « invité » est la seule information qu'il ne peut
 * déduire de rien d'autre : sans elle, le fil attribue à une personne réelle
 * une composition qu'elle n'a pas faite. En cas de conflit, on affiche ce qui
 * ne se devine pas.
 */
export function ribbonFor(bento: { isGuest: boolean; isFeatured: boolean }): FeedRibbon | null {
  if (bento.isGuest) return GUEST_RIBBON;
  if (bento.isFeatured) return FEATURED_RIBBON;
  return null;
}
