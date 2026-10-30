import type { IconName } from '../icons';
import { tabBarHeight } from '../structure/tab-items';

/** Ce qu'un toast reste à l'écran, en millisecondes : 4 s, 6 s avec une action (README du design). */
export const TOAST_DURATION = { plain: 4000, action: 6000 } as const;

/** Les trois sortes de toasts de l'app, du succès à l'erreur. */
export type ToastTone = 'success' | 'neutral' | 'danger';

/**
 * Combien de temps un toast reste (chantier 31, D7) : au moins 4 s, 6 s avec
 * une action, comme le veut le guide ; un appel qui demande plus le garde.
 */
export function toastDuration(hasAction: boolean, requested?: number): number {
  const floor = hasAction ? TOAST_DURATION.action : TOAST_DURATION.plain;
  return Number.isFinite(requested) ? Math.max(floor, requested as number) : floor;
}

/**
 * L'icône d'un toast, qui dit ce que la couleur disait avant lui : le toast
 * reste encre, `warning-circle` pour une erreur, `check-circle` sinon.
 */
export function toastIcon(tone: ToastTone): IconName {
  return tone === 'danger' ? 'warning-circle' : 'check-circle';
}

/**
 * La distance d'un toast au bas de l'écran : 12 au-dessus du clavier quand il
 * est ouvert, 8 au-dessus de la barre d'onglets sur une racine, 12 au-dessus
 * de la zone sûre ailleurs.
 */
export function toastBottom({
  tabBar,
  insetBottom,
  keyboard = 0,
}: {
  tabBar: boolean;
  insetBottom: number;
  keyboard?: number;
}): number {
  if (keyboard > 0) return keyboard + 12;
  return tabBar ? tabBarHeight(insetBottom) + 8 : insetBottom + 12;
}
