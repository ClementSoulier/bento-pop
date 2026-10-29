import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme, type Scheme } from '../theme';
import { BrandGround } from './BrandGround';

export type ScreenTone = 'app' | 'surface' | 'sunken' | 'brand';

export type ScreenProps = {
  /** `app` par défaut ; `brand`, le jaune à pois, pour les moments de marque seulement. */
  tone?: ScreenTone;
  /** Le thème du sous-arbre ; le sombre ne sert qu'au catalogue tant qu'il n'est pas décliné. */
  theme?: Scheme;
  /** `false` pour peindre sous la barre d'état. */
  safeTop?: boolean;
  /** Le nom de la région, si l'écran en a besoin. */
  label?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Le cadre d'un écran (chantier 30, famille de la structure) : son fond, son
 * thème, et la zone sûre du haut, laissée vide et de la couleur de l'écran.
 */
export function Screen({
  tone = 'app',
  theme,
  safeTop = true,
  label,
  children,
  style,
}: ScreenProps) {
  const body = (
    <ScreenBody tone={tone} safeTop={safeTop} label={label} style={style}>
      {children}
    </ScreenBody>
  );
  return theme ? <ThemeProvider scheme={theme}>{body}</ThemeProvider> : body;
}

function ScreenBody({
  tone,
  safeTop,
  label,
  children,
  style,
}: Required<Pick<ScreenProps, 'tone' | 'safeTop'>> &
  Pick<ScreenProps, 'label' | 'children' | 'style'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const frame: StyleProp<ViewStyle> = [{ flex: 1, paddingTop: safeTop ? insets.top : 0 }, style];
  const region = label ? { accessibilityLabel: label } : {};
  if (tone === 'brand') {
    return (
      <BrandGround {...region} style={frame}>
        {children}
      </BrandGround>
    );
  }
  const backgrounds = {
    app: colors['bg-app'],
    surface: colors['bg-surface'],
    sunken: colors['bg-sunken'],
  };
  return (
    <View {...region} style={[{ backgroundColor: backgrounds[tone] }, frame]}>
      {children}
    </View>
  );
}
