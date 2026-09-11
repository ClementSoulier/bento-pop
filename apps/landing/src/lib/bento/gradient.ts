import { PALETTES, type PaletteKey } from '@bento-pop/supabase-mobile/bento';

/**
 * Adaptation des palettes partagées au CSS.
 *
 * Les palettes sont décrites avec les conventions de `expo-linear-gradient` :
 * un point de départ et un point d'arrivée en coordonnées normalisées, `y`
 * croissant vers le bas. CSS raisonne en angle, `0deg` pointant vers le haut
 * et tournant dans le sens horaire. Cette conversion est le seul endroit du
 * web qui connaît cette différence ; les couleurs, elles, restent la source
 * unique partagée avec l'app.
 */

/**
 * Angle CSS équivalent au vecteur `start → end` d'une palette.
 *
 * Repères de contrôle : vers le bas (0,0)→(0,1) donne 180deg, vers la
 * droite (0,0)→(1,0) donne 90deg, diagonale (0,0)→(1,1) donne 135deg.
 */
export function cssAngleOf(
  start: { x: number; y: number },
  end: { x: number; y: number },
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  // Vecteur nul : on retombe sur un dégradé vertical descendant plutôt que
  // de produire un NaN qui casserait toute la règle CSS.
  if (dx === 0 && dy === 0) return 180;
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return Math.round(((deg % 360) + 360) % 360);
}

/** Règle `linear-gradient(...)` prête à poser dans un `style`. */
export function paletteGradient(key: PaletteKey): string {
  const palette = PALETTES[key];
  const angle = cssAngleOf(palette.start, palette.end);
  return `linear-gradient(${angle}deg, ${palette.colors.join(', ')})`;
}
