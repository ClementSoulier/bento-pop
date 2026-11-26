import { Platform, Pressable, View } from 'react-native';
import { busyA11y } from '@/lib/a11y-states';
import { Icon } from '../Icon';
import { Spinner } from '../overlays/Spinner';
import { PopShadow } from '../PopShadow';
import { Text } from '../Text';
import { useTheme } from '../theme';

export type ProposeRowProps = {
  /** Le texte cherché, tel que tapé. */
  query: string;
  /** « Proposer au catalogue (validé par l'équipe) » par défaut. */
  subtitle?: string;
  onPress?: () => void;
  /** La proposition part : la ligne attend, et le dit. */
  busy?: boolean;
  /** « Proposer Doctor au catalogue » par défaut, comme depuis le chantier 3. */
  accessibilityLabel?: string;
};

/** La pastille du « + », celle d'une case vide (`BentoTile`). */
const PLUS = 40;

/**
 * La ligne pour proposer un item absent du catalogue (chantier 32, lot 3) : en
 * pointillés, le « + » jaune cerné d'encre sur son ombre franche, « Ajouter
 * « Doctor » » et ce qui suivra. Toujours sous les résultats, et seule quand il
 * n'y en a aucun, sous « Aucun résultat trouvé ». Le titre va à la ligne plutôt
 * que de couper ce qu'on a tapé.
 */
export function ProposeRow({
  query,
  subtitle = 'Proposer au catalogue (validé par l’équipe)',
  onPress,
  busy,
  accessibilityLabel,
}: ProposeRowProps) {
  const { colors, border, radius } = useTheme();
  const a11y = busyA11y({ disabled: busy, busy }, Platform.OS);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Proposer ${query} au catalogue`}
      accessibilityState={a11y.state}
      accessibilityValue={a11y.value}
      disabled={busy || !onPress}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: radius.lg,
        borderWidth: border.control,
        borderStyle: 'dashed',
        borderColor: colors['border-strong'],
        backgroundColor: colors['bg-surface'],
      }}
    >
      <PopShadow level="pop-sm" radius={PLUS / 2}>
        <View
          style={{
            width: PLUS,
            height: PLUS,
            borderRadius: PLUS / 2,
            borderWidth: border.ink,
            borderColor: colors.ink,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="plus" size={20} color="on-accent" />
        </View>
      </PopShadow>
      <View style={{ flex: 1, minWidth: 0 }}>
        {/* Insécables : un guillemet ne finit jamais seul sur sa ligne. */}
        <Text variant="body-strong">{`Ajouter « ${query} »`}</Text>
        <Text variant="footnote" color="text-secondary">
          {subtitle}
        </Text>
      </View>
      {busy ? <Spinner /> : null}
    </Pressable>
  );
}
