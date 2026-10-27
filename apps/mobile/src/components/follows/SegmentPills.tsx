import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { CONTROL_MAX_FONT_MULTIPLIER, fontScaleFor } from '@/components/bento/font-scaling';
import { SHADOWS } from '@/components/primitives';

/** Hauteur d'une pastille à la taille par défaut, comme celles du compositeur. */
const CHIP_H = 34;

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  accessibilityLabel?: string;
};

/**
 * Deux pastilles ou plus, une seule choisie : le filtre de « La table » et les
 * onglets des listes, chantier 23 (D1, D8). Le dessin des pastilles du
 * compositeur : choisie, encre et jaune, sans ombre ; sinon crème, ombre
 * « stamp ». Le lecteur d'écran entend un bouton et son état choisi.
 */
export function SegmentPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { fontScale } = useWindowDimensions();
  const scale = fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (!active) onChange(option.value);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            // La pastille fait 34 pt : la cible tactile en fait 44.
            hitSlop={{ top: 5, bottom: 5 }}
            style={[
              {
                height: CHIP_H * scale,
                justifyContent: 'center',
                paddingHorizontal: 14,
                borderRadius: 999,
                borderWidth: 2.5,
                borderColor: '#0a0a0a',
                backgroundColor: active ? '#0a0a0a' : '#fbf3de',
              },
              active ? null : SHADOWS.stamp,
            ]}
          >
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={{
                fontFamily: 'Bungee',
                fontSize: 11 * scale,
                lineHeight: 15 * scale,
                letterSpacing: 0.5,
                color: active ? '#fbbf24' : '#0a0a0a',
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
