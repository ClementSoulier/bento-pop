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
 * - **Bungee** : accents tout-caps (badges, stamps)
 * - **Extenda** (custom) : police display Bento Pop, chargée depuis
 *   `@bento-pop/brand/assets/fonts/extenda-100-yotta.otf` — déclarée
 *   manuellement car ce n'est pas un Google Font.
 */
export const FONTS = {
  Fredoka: Fredoka_400Regular,
  'Fredoka-Medium': Fredoka_500Medium,
  'Fredoka-SemiBold': Fredoka_600SemiBold,
  'Fredoka-Bold': Fredoka_700Bold,
  Bungee: Bungee_400Regular,
  Extenda: require('@bento-pop/brand/assets/fonts/extenda-100-yotta.otf'),
};
