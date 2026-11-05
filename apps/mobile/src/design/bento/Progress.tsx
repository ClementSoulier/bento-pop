import { View } from 'react-native';
import { Text } from '../Text';
import { useTheme } from '../theme';

export type ProgressProps = {
  /** Les cases remplies. */
  value: number;
  /** Les cases du bento, 6 par défaut, de 2 à 6 sur une édition. */
  total?: number;
};

/**
 * Les segments qui se remplissent avec les cases (chantier 32), sous le titre de
 * Compose tant que le bento n'est pas en ligne : un segment par case, et « 2 / 6 »
 * en chiffres tabulaires.
 */
export function Progress({ value, total = 6 }: ProgressProps) {
  const { colors, border } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Cases remplies : ${value} sur ${total}`}
      accessibilityValue={{ min: 0, max: total, now: value }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
    >
      <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
        {Array.from({ length: total }, (_, index) => (
          <View
            key={index}
            style={{
              flex: 1,
              height: 8,
              borderRadius: 4,
              borderWidth: border.control,
              borderColor: index < value ? colors.ink : colors['border-strong'],
              backgroundColor: index < value ? colors.accent : 'transparent',
            }}
          />
        ))}
      </View>
      <Text variant="label-s" color="text-secondary" style={{ fontVariant: ['tabular-nums'] }}>
        {value} / {total}
      </Text>
    </View>
  );
}
