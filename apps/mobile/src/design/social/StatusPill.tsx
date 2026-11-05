import { View } from 'react-native';
import { Text } from '../Text';
import { useTheme } from '../theme';

export type StatusPillProps = {
  /** « En ligne » par défaut. */
  label?: string;
  /** `live` en ligne, `pending` en attente. */
  tone?: 'live' | 'pending';
};

/**
 * L'état d'un bento (chantier 32) : un point et un mot, sur un fond doux. Le mot
 * dit l'état, la couleur ne parle jamais seule.
 */
export function StatusPill({ label = 'En ligne', tone = 'live' }: StatusPillProps) {
  const { colors, palette, radius } = useTheme();
  const live = tone === 'live';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 26,
        paddingLeft: 8,
        paddingRight: 10,
        borderRadius: radius.full,
        backgroundColor: live ? colors['status-live-bg'] : colors['accent-soft'],
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: live ? colors.success : palette['yolk-600'],
        }}
      />
      <Text variant="label-s">{label}</Text>
    </View>
  );
}
