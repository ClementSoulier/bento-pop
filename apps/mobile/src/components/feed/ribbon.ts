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
 * Bento composé d'après une édition hebdomadaire.
 *
 * Jaune de la marque sur encre : la troisième teinte disponible, et la plus
 * proche de ce que l'édition est, un rendez-vous de l'équipe. Le libellé
 * porte le titre de l'édition et non le mot « hebdomadaire » : « LA SEMAINE
 * DU FILM QUI PIQUE » dit ce qu'on va y trouver, « BENTO DE LA SEMAINE » ne
 * dit que la fréquence.
 */
export function editionRibbon(title: string): FeedRibbon {
  return { label: title, color: '#fbbf24', textColor: '#0a0a0a' };
}

/**
 * Une seule étiquette à la fois, et l'ordre compte.
 *
 * « Invité » d'abord : un bento invité est presque toujours aussi un coup de
 * cœur, c'est même la raison de le composer. Mais « coup de cœur » est un
 * avis que le lecteur peut deviner, alors que « invité » est la seule
 * information qu'il ne peut déduire de rien d'autre : sans elle, le fil
 * attribue à une personne réelle une composition qu'elle n'a pas faite.
 *
 * L'édition ensuite, avant le coup de cœur, et pour la même raison : la boîte
 * d'une édition n'a pas les cases du bento principal, et sans son titre le
 * lecteur ne comprend pas pourquoi. C'est une information sur ce qu'il voit,
 * pas un avis dessus.
 */
export function ribbonFor(bento: {
  isGuest: boolean;
  isFeatured: boolean;
  editionTitle?: string | null;
}): FeedRibbon | null {
  if (bento.isGuest) return GUEST_RIBBON;
  if (bento.editionTitle) return editionRibbon(bento.editionTitle);
  if (bento.isFeatured) return FEATURED_RIBBON;
  return null;
}
