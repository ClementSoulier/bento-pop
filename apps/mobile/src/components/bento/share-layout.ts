import { bungeeTextWidth } from '@bento-pop/supabase-mobile/bento';

/**
 * Le ruban rouge de l'image de partage 1080 × 1920, sous le logo.
 *
 * Il disait « Mon bento pop culture » pour tous les bentos. Une édition y met
 * désormais son titre : sans lui, l'image d'un bento d'édition ne disait pas
 * à quoi ses cases répondent. Arbitrage du 16 septembre 2026.
 *
 * Aucun import de `react-native` : testé sous `node:test`.
 */
export const SHARE_RIBBON = {
  fontSize: 32,
  letterSpacing: 2,
  paddingH: 24,
  border: 3,
  /** Largeur de la carte moins ses marges, 1080 − 2 × 80. */
  maxWidth: 920,
} as const;

/** Ce que dit le ruban : le titre de l'édition, ou la phrase du bento principal. */
export function shareRibbonText(editionTitle: string | null | undefined): string {
  return editionTitle?.trim() || 'Mon bento pop culture';
}

/**
 * Taille du texte du ruban : 32, ou juste assez moins pour tenir sur une
 * ligne. Un titre d'édition va jusqu'à 30 caractères, et Bungee est large :
 * sur deux lignes, le ruban poussait la grille et rognait le pied de page,
 * dont le budget vertical est compté au point.
 */
export function shareRibbonFontSize(text: string): number {
  const { fontSize, letterSpacing, paddingH, border, maxWidth } = SHARE_RIBBON;
  const room = maxWidth - 2 * (paddingH + border);
  const upper = text.toUpperCase();
  const spacing = letterSpacing * [...upper].length;
  const width = bungeeTextWidth(upper, fontSize, letterSpacing);
  if (width <= room) return fontSize;
  const glyphs = (width - spacing) / fontSize;
  // Arrondi au dixième inférieur : jamais un cheveu trop large.
  return Math.floor(((room - spacing) / glyphs) * 10) / 10;
}
