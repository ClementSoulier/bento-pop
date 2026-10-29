import type { ReactNode } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { Text } from '../Text';
import { useTheme } from '../theme';
import { WRAP_FONT_SCALE } from '../type';

export type TabsItem = { label: string; count?: number };

export type TabsProps = {
  /** Trois au plus ; au-delà, c'est une `Chip` de filtre. */
  items: (string | TabsItem)[];
  /** L'index de l'onglet courant. */
  value?: number;
  onChange?: (index: number) => void;
  /** Répartis sur toute la largeur. */
  fill?: boolean;
  /** Un filet en bas, par défaut. */
  border?: boolean;
};

/**
 * Des onglets texte soulignés, pour deux ou trois vues d'une même liste
 * (chantier 30, famille de la structure) : le courant en encre, souligné d'un
 * trait de 28 sur 3, les autres en gris.
 *
 * Dès 130 %, ils prennent la largeur de leur libellé et défilent s'ils
 * débordent : à 200 %, « Abonnements » ne tient plus dans la moitié d'un
 * écran, et un mot seul se couperait en son milieu.
 *
 * Le design écrit le libellé en 16/20 et le compte en 13/16 ; le système n'a
 * pas ces styles, ils prennent `label-m` (15/20) et `label-s` (13/16).
 */
export function Tabs({ items, value = 0, onChange, fill, border = true }: TabsProps) {
  const { colors, border: borders } = useTheme();
  const { fontScale } = useWindowDimensions();
  const scrolls = fontScale >= WRAP_FONT_SCALE;
  const list = items.map((item) => (typeof item === 'string' ? { label: item } : item));
  const frame: ViewStyle = {
    backgroundColor: colors['bg-app'],
    borderBottomWidth: border ? borders.hairline : 0,
    borderBottomColor: colors['border-subtle'],
  };
  const row: ViewStyle = { flexDirection: 'row', justifyContent: 'center', gap: 4 };
  const tabs: ReactNode = list.map((item, index) => {
    const on = index === value;
    const tint = on ? 'text-primary' : 'text-secondary';
    return (
      <Pressable
        key={item.label}
        accessibilityRole="button"
        accessibilityLabel={
          item.count === undefined
            ? `${item.label}, onglet ${index + 1} sur ${list.length}`
            : `${item.label}, ${item.count}, onglet ${index + 1} sur ${list.length}`
        }
        accessibilityState={{ selected: on }}
        onPress={() => onChange?.(index)}
        style={[
          {
            minWidth: 44,
            minHeight: 44,
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          },
          fill && (scrolls ? { flexGrow: 1 } : { flex: 1 }),
        ]}
      >
        <Text variant="label-m" color={tint} numberOfLines={scrolls ? 1 : undefined}>
          {item.label}
        </Text>
        {item.count !== undefined ? (
          <Text
            variant="label-s"
            color={tint}
            style={{ opacity: 0.8, fontVariant: ['tabular-nums'] }}
          >
            {String(item.count)}
          </Text>
        ) : null}
        {on ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: 0,
              left: '50%',
              width: 28,
              height: 3,
              marginLeft: -14,
              borderRadius: 3,
              backgroundColor: colors['text-primary'],
            }}
          />
        ) : null}
      </Pressable>
    );
  });
  if (!scrolls) return <View style={[frame, row]}>{tabs}</View>;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={frame}
      contentContainerStyle={[row, { flexGrow: 1 }]}
    >
      {tabs}
    </ScrollView>
  );
}
