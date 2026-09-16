import {
  CONTROL_MAX_FONT_MULTIPLIER,
  fontScaleFor,
  naturalLineHeight,
} from '@/components/bento/font-scaling';

/**
 * Hauteur du bandeau « Pas de connexion », sous la barre d'état.
 *
 * Le bandeau est posé en absolu au-dessus de tous les écrans. Mesuré au
 * chantier 11 sur l'émulateur Pixel 8, en mode avion : il recouvrait le bouton
 * retour de la page publique, dont il ne laissait que 5 dp, « Options », et le
 * logo du composer. Les écrans descendent donc leur contenu de cette hauteur
 * quand l'appareil est hors ligne, cf. `useOfflineInset`, et les modèles de mise
 * en page la comptent : la boîte du bento ne passe pas sous les boutons parce
 * qu'un bandeau est apparu.
 *
 * Aucun import de `react-native` : testé sous `node:test`.
 */

/** Marge verticale du bandeau, de chaque côté de sa ligne. */
export const OFFLINE_BANNER_PADDING = 6;

/** Sa ligne : Bungee 10, hauteur posée. */
export const OFFLINE_BANNER_LINE_H = naturalLineHeight('Bungee', 10);

export function offlineBannerHeight(fontScale: number): number {
  return (
    OFFLINE_BANNER_PADDING * 2 +
    OFFLINE_BANNER_LINE_H * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER)
  );
}
