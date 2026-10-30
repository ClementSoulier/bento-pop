import { View } from 'react-native';
import { useTheme } from '../theme';
import type { ColorToken } from '../tokens';

export type StepsProps = {
  count?: number;
  /** L'étape courante, à partir de 0. */
  index?: number;
  /** « Étape 1 sur 3 » par défaut. */
  label?: string;
  /** La couleur du texte autour : encre sur jaune comme sur blanc. */
  color?: ColorToken;
};

/**
 * Les segments d'étapes de l'accueil (chantier 30, famille de la structure) :
 * des traits de 4, les passés et le courant pleins, les suivants à 22 %.
 */
export function Steps({ count = 3, index = 0, label, color = 'text-primary' }: StepsProps) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? `Étape ${index + 1} sur ${count}`}
      accessibilityValue={{ min: 1, max: count, now: index + 1 }}
      style={{ flexDirection: 'row', gap: 6 }}
    >
      {Array.from({ length: count }, (_, step) => (
        <View
          key={step}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors[color],
            opacity: step <= index ? 1 : 0.22,
          }}
        />
      ))}
    </View>
  );
}
