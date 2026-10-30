import {
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from '@expo-google-fonts/fredoka';
import { Bungee_400Regular } from '@expo-google-fonts/bungee';

/**
 * Cartographie nom → asset font, chargée via `useFonts` côté `_layout.tsx`.
 *
 * - **Fredoka** : corps de texte, 4 graisses
 * - **Bungee** : accents tout-caps (badges, stamps), jusqu'à ce que les
 *   chantiers 31 à 34 refassent leurs écrans (D13 du 30)
 * - **Extenda** (custom) : police display Bento Pop, chargée depuis
 *   `@bento-pop/brand/assets/fonts/extenda-100-yotta.otf` — déclarée
 *   manuellement car ce n'est pas un Google Font.
 * - **Fredoka SemiCondensed Bold** : les titres de cases du design system v2
 *   (chantier 30, D7), copiée du dossier de la refonte avec sa licence OFL.
 *   Chargée au lancement comme les autres : aucune build native.
 */
export const FONTS = {
  Fredoka: Fredoka_400Regular,
  'Fredoka-Medium': Fredoka_500Medium,
  'Fredoka-SemiBold': Fredoka_600SemiBold,
  'Fredoka-Bold': Fredoka_700Bold,
  Bungee: Bungee_400Regular,
  Extenda: require('@bento-pop/brand/assets/fonts/extenda-100-yotta.otf'),
  'FredokaSemiCondensed-Bold': require('../../assets/fonts/FredokaSemiCondensed-Bold.ttf'),
};
