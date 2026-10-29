import {
  Text as NativeText,
  useWindowDimensions,
  type TextProps as NativeTextProps,
} from 'react-native';
import { useTheme } from './theme';
import type { ColorToken } from './tokens';
import { textStyle, type TextVariant, type TextWeight } from './type';

export type TextProps = NativeTextProps & {
  /** Un des 22 styles du design, `body` par défaut. */
  variant?: TextVariant;
  /** Un token de couleur, `text-primary` par défaut. */
  color?: ColorToken;
  /** La graisse d'un état (l'onglet courant passe à 600) ; la taille reste celle du style. */
  weight?: TextWeight;
};

/**
 * Le seul texte du design system v2 (chantier 30, D8) : la police, la taille,
 * la hauteur de ligne, l'approche et la casse de son style, la couleur de son
 * token.
 *
 * Il applique lui-même la taille du système, plafonnée selon la catégorie de
 * son style, comme les textes du chantier 7 : React Native 0.86 ne plafonne
 * pas `lineHeight` sur Android. `allowFontScaling` est donc posé après les
 * props, pour que l'appelant ne puisse pas le rendre à la plateforme.
 */
export function Text({
  variant = 'body',
  color = 'text-primary',
  weight,
  style,
  ...props
}: TextProps) {
  const { fontScale } = useWindowDimensions();
  const { colors } = useTheme();
  return (
    <NativeText
      {...props}
      allowFontScaling={false}
      style={[textStyle(variant, fontScale, weight), { color: colors[color] }, style]}
    />
  );
}
