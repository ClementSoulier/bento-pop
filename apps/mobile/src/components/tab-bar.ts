/**
 * Hauteur de la barre d'onglets.
 *
 * Fixée à 84 jusqu'au chantier 11, ce qui tenait partout où la marge basse du
 * système vaut au plus ce que la hauteur contient déjà : les iPhone à
 * indicateur d'accueil (34), l'iPhone SE (0), Android en navigation par gestes
 * (24). En navigation à trois boutons, Android réserve 48 dp, et React
 * Navigation les retire de la barre : icônes et libellés passaient sous les
 * boutons système, libellé coupé en deux (chantier 7, relevé sur l'émulateur
 * Pixel 8, revérifié au chantier 11).
 *
 * La barre garde donc ses 84 et grandit de ce que la marge dépasse la marge de
 * référence de la plateforme : la zone utile ne change pas, et rien ne bouge là
 * où la barre tenait déjà.
 *
 * Le composer lit cette hauteur par `useBottomTabBarHeight` pour son budget
 * vertical, cf. `compose-layout.ts`.
 *
 * Aucun import de `react-native` : testé sous `node:test`.
 */
import { bungeeTextWidth } from '@bento-pop/supabase-mobile/bento';

export const TAB_BAR_BASE_HEIGHT = 84;

/**
 * Marge basse que la hauteur de base contient déjà, par plateforme : l'indicateur
 * d'accueil d'un iPhone, la barre de gestes d'Android. Deux valeurs et non une,
 * parce qu'une barre d'Android a besoin de 10 dp de plus qu'un iPhone pour son
 * icône et son libellé, mesurés sur l'émulateur Pixel 8.
 */
export const TAB_BAR_BASE_INSET = { ios: 34, android: 24 } as const;

export function tabBarHeight(insetBottom: number, baseInset: number): number {
  const inset = Number.isFinite(insetBottom) ? insetBottom : 0;
  return TAB_BAR_BASE_HEIGHT + Math.max(0, inset - baseInset);
}

/** Ce que le libellé laisse de chaque côté de son onglet, en points. */
export const TAB_LABEL_INSET = 4;

/**
 * Facteur à appliquer à la police d'un libellé d'onglet pour qu'il tienne sur
 * sa ligne : 1 s'il y tient déjà, ce qui est le cas des cinq libellés à la
 * taille par défaut, sur 72 dp au moins (§1.1 du chantier 24).
 *
 * Mesuré par la table de Bungee plutôt que confié à `adjustsFontSizeToFit`,
 * qui, avec une hauteur de ligne posée, a fait tomber deux textes à la trace
 * sur iOS à la recette du 23 (D21). L'espacement des lettres ne suit pas la
 * police : il est mis à part. Sur Android, `pixelRatio` arrondit comme
 * `lineFitScale` : React Native y dessine la police au pixel supérieur, et la
 * réduction s'arrête donc sur un pixel entier.
 */
export function tabLabelScale(
  label: string,
  tabWidth: number,
  fontSize: number,
  letterSpacing: number,
  pixelRatio?: number,
): number {
  const room = tabWidth - TAB_LABEL_INSET * 2;
  if (room <= 0 || fontSize <= 0) return 1;
  const spacing = letterSpacing * [...label].length;
  const glyphs = (bungeeTextWidth(label, fontSize, letterSpacing) - spacing) / fontSize;
  const rendered = pixelRatio === undefined ? fontSize : Math.ceil(fontSize * pixelRatio) / pixelRatio;
  if (glyphs * rendered + spacing <= room) return 1;
  const fit = (room - spacing) / glyphs;
  const snapped = pixelRatio === undefined ? fit : (Math.floor(fit * pixelRatio) - 0.01) / pixelRatio;
  return Math.max(0, snapped) / fontSize;
}
