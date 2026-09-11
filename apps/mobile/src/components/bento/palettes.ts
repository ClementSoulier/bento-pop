/**
 * Palettes des compartiments du bento.
 *
 * Le contenu vit désormais dans `@bento-pop/supabase-mobile/bento`,
 * partagé avec la page publique `/u/[pseudo]` de la landing et son image
 * de partage. Un même bento doit avoir exactement les mêmes couleurs dans
 * l'app, sur le web et dans l'aperçu d'un lien : trois jeux de valeurs
 * recopiés auraient divergé au premier ajustement.
 *
 * Ce fichier reste comme point d'entrée pour ne pas réécrire les imports
 * de toute l'app.
 */
export {
  PALETTES,
  DECORATIVE_PALETTE_KEYS,
  paletteKeyForItem,
  type Palette,
  type PaletteKey,
} from '@bento-pop/supabase-mobile/bento';
