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
