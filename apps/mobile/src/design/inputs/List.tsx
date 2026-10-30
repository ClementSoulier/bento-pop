import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Text } from '../Text';
import { useTheme } from '../theme';

/** Une ligne posée dans une `List` y trace son filet, et seulement là. */
const InList = createContext(false);

export type ListProps = {
  /** Deux ou trois mots, en sur-titre. */
  header?: string;
  /** Une note sous le groupe. */
  footer?: string;
  /** Sans carte : les lignes posées à même le fond. */
  plain?: boolean;
  /** Des `ListRow` ou des `RadioRow`. */
  children: ReactNode;
  /** La place du groupe dans l'écran ; les réglages séparent leurs groupes de 24. */
  style?: StyleProp<ViewStyle>;
};

/**
 * Un groupe de lignes (chantier 30, famille des listes et de la saisie) : un
 * sur-titre, une carte aux coins de 20 cernée d'un filet, une note dessous.
 *
 * Chaque ligne trace le filet de son bas ; celui de la dernière passe d'un
 * point sous le bord de la carte, qui le rogne, comme dans le CSS du dossier :
 * aucune ligne n'a besoin de savoir qu'elle est la dernière.
 */
export function List({ header, footer, plain, children, style }: ListProps) {
  const { colors, border, radius } = useTheme();
  return (
    <View style={[{ gap: 8 }, style]}>
      {header ? (
        <Text
          variant="eyebrow"
          color="text-secondary"
          accessibilityRole="header"
          style={{ paddingHorizontal: 4 }}
        >
          {header}
        </Text>
      ) : null}
      <View
        style={[
          { overflow: 'hidden' },
          plain
            ? null
            : {
                backgroundColor: colors['bg-surface'],
                borderWidth: border.hairline,
                borderColor: colors['border-subtle'],
                borderRadius: radius.lg,
              },
        ]}
      >
        <View style={{ marginBottom: -border.hairline }}>
          <InList.Provider value={true}>{children}</InList.Provider>
        </View>
      </View>
      {footer ? (
        <Text variant="footnote" color="text-secondary" style={{ paddingHorizontal: 4 }}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

/** La ligne est-elle posée dans une `List` ? */
export function useInList(): boolean {
  return useContext(InList);
}

/** Le dessin commun des lignes : 52 de haut au moins, 12 sur 16 de marge, 12 entre les éléments. */
export const ROW: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
  minHeight: 52,
  paddingVertical: 12,
  paddingHorizontal: 16,
};

/** Le filet du bas d'une ligne de liste, retiré de 16, ou de 52 sous une icône. */
export function RowRule({ inset }: { inset: number }) {
  const { colors, border } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: inset,
        right: 0,
        bottom: 0,
        height: border.hairline,
        backgroundColor: colors['border-subtle'],
      }}
    />
  );
}

/** Le fond d'une ligne appuyée, `bg-pressed`, qui suit `usePress`. */
export function PressedFill({ pressed }: { pressed: SharedValue<number> }) {
  const { colors } = useTheme();
  const shown = useAnimatedStyle(() => ({ opacity: pressed.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: colors['bg-pressed'] }, shown]}
    />
  );
}
