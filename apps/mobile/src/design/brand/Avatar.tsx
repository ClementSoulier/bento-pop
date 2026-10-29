import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import type { PaletteToken } from '../tokens';
import { popyImage, type Mood } from './popy-images';

/** Les teintes du garde-manger où un compte pose sa Popy. */
export type PantryColor =
  | 'yolk'
  | 'ume'
  | 'thon'
  | 'sakura'
  | 'shiso'
  | 'ramune'
  | 'wasabi'
  | 'rice'
  | 'white';

const PANTRY: Record<PantryColor, PaletteToken> = {
  yolk: 'yolk-300',
  ume: 'ume-300',
  thon: 'thon-300',
  sakura: 'sakura-300',
  shiso: 'shiso-300',
  ramune: 'ramune-300',
  wasabi: 'wasabi-300',
  rice: 'rice-100',
  white: 'neutral-0',
};

const SIZES = { xs: 24, sm: 32, md: 44, lg: 56, xl: 96 } as const;

export type AvatarSize = keyof typeof SIZES | number;

export type AvatarProps = {
  mood?: Mood;
  color?: PantryColor;
  /** `xs` 24, `sm` 32, `md` 44 (listes), `lg` 56, `xl` 96 (profil), ou un nombre. */
  size?: AvatarSize;
  /** Seulement quand l'avatar est seul à désigner la personne : « @lea.cine ». */
  label?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * La Popy d'un compte, sur sa teinte, cerclée d'encre (chantier 30, famille
 * de la marque) : 2 de contour, 1,5 aux tailles `xs` et `sm`. L'image fait
 * 86 % de l'avatar, un peu basse, et le cercle la coupe, comme dans le design ;
 * ses mesures sont celles de l'avatar entier, non de l'intérieur du contour.
 */
export function Avatar({
  mood = 'content',
  color = 'yolk',
  size = 'md',
  label,
  style,
}: AvatarProps) {
  const { colors, palette } = useTheme();
  const side = typeof size === 'number' ? size : SIZES[size];
  const ring = size === 'xs' || size === 'sm' ? 1.5 : 2;
  const accessibility = label
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: label }
    : {
        accessible: false,
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants' as const,
      };
  return (
    <View
      {...accessibility}
      style={[
        {
          width: side,
          height: side,
          borderRadius: side / 2,
          borderWidth: ring,
          borderColor: colors.ink,
          backgroundColor: palette[PANTRY[color]],
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Image
        source={popyImage(mood)}
        resizeMode="contain"
        style={{ width: side * 0.86, height: side * 0.86, marginTop: side * 0.06 }}
      />
    </View>
  );
}
