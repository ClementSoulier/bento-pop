/**
 * Une case dont l'item attend la modération : sa pastille, et ce qu'en dit le
 * lecteur d'écran.
 *
 * La pastille « EN ATTENTE » était posée en haut à droite, dans la rangée de
 * l'étiquette, sans que rien ne lui réserve de place. Mesuré sur captures le 17
 * septembre 2026, dans le composer : elle masquait 34 à 74 % de « SON »,
 * « CRÉA » et « LIEU » sur iPhone SE, 17 Pro et Pixel 8, une partie de
 * « ARTISTE » à la police 2,0 sur Pixel 8, et jusqu'à 72 % de la première ligne
 * d'une question d'édition. Trois dessins ont été essayés sur simulateur :
 * « EN ATTENTE » sous le titre réduisait à 72 % le texte des petites cases
 * d'édition d'un iPhone SE, et l'étiquette remplacée effaçait la question.
 *
 * Retenu : un rond rouge cerclé d'encre, qui porte un sablier, à cheval sur le
 * coin haut droit de la case. Il ne prend aucune place au texte, et rien ne
 * rétrécit. Sur la première case, il recouvre le rivet haut droit du cadre.
 *
 * Aucun import de `react-native` : testé sous `node:test`.
 */

import { TILE_LINE, TILE_STAMP_PADDING_V, tileConf, type TileSize } from './tile-text';

/** Épaisseur du cercle d'encre de la pastille. */
export const TILE_PENDING_RING = 1.5;

/**
 * Ce que la pastille dépasse de la case, vers le haut et vers la droite.
 *
 * 3,5 : assez pour que la pastille s'écarte du texte d'une étiquette qui occupe
 * toute la largeur, 2,3 pt au plus serré, dans une petite case du composer d'un
 * iPhone SE ; trop peu pour toucher la case voisine, à 3 pt dans le même
 * composer, où les cases sont à 6,5 pt l'une de l'autre. Cf. `tile-pending.test.ts`.
 */
export const TILE_PENDING_OVERHANG = 3.5;

/**
 * Diamètre et débord de la pastille d'une case de taille `size`, à l'échelle
 * `scale`.
 *
 * Le diamètre vaut la hauteur d'une ligne d'étiquette à la taille par défaut,
 * cercle compris, et **ne suit pas la police système** : la pastille est une
 * icône, pas un texte. Au prototype, elle grossissait avec, et ne passait plus
 * qu'à 0,8 pt du texte sur l'émulateur Pixel 8 à la police 2,0.
 */
export function tilePendingBadge(
  size: TileSize,
  scale: number,
): { diameter: number; overhang: number } {
  const conf = tileConf(size, scale);
  return {
    diameter: conf.stamp * TILE_LINE.stamp + TILE_STAMP_PADDING_V * 2 + TILE_PENDING_RING * 2,
    overhang: TILE_PENDING_OVERHANG,
  };
}

/**
 * Ce que le lecteur d'écran lit d'une case remplie : l'intitulé, le titre, le
 * sous-titre s'il y en a un, et l'attente de validation.
 *
 * L'intitulé d'une case remplace les textes qu'elle contient : même quand la
 * pastille portait « En attente », VoiceOver lisait « Lieu : Le Petit Bistrot »
 * et rien de plus, relevé dans l'arbre d'accessibilité le 17 septembre 2026.
 * Rien ne disait donc quelle case empêche la publication.
 */
export function tileAccessibilityLabel({
  prompt,
  title,
  subtitle,
  pending = false,
}: {
  prompt: string;
  title: string;
  subtitle?: string;
  pending?: boolean;
}): string {
  return `${prompt} : ${title}${subtitle ? `, ${subtitle}` : ''}${pending ? ', en attente de validation' : ''}`;
}
