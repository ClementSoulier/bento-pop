import { Pressable, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { Text } from '../Text';
import { useTheme } from '../theme';
import { reachesWrapScale } from '../type';

export type ChipProps = {
  label: string;
  onPress?: () => void;
  /** Une puce de filtre choisie : fond d'encre. */
  selected?: boolean;
  /** `filter`, `add` (une édition pas encore commencée), `suggestion` (avec `count`). */
  variant?: 'filter' | 'add' | 'suggestion';
  /** Le nombre de bentos qui contiennent la suggestion. */
  count?: number;
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Une puce (chantier 30, famille des actions) : choisir une édition, filtrer,
 * relancer une recherche suggérée. 36 de haut, 40 pour une suggestion, qui
 * grandissent avec le texte ; la zone tactile dépasse de 4 en haut et en bas.
 * Comme un bouton, dès 130 % son libellé va à la ligne plutôt que d'être coupé.
 *
 * Le design écrit le libellé en 14 ; le système n'a pas ce style, il prend
 * `label-m` (15/20), celui des suggestions.
 */
export function Chip({
  label,
  onPress,
  selected,
  variant = 'filter',
  count,
  icon,
  disabled,
  style,
}: ChipProps) {
  const { colors, border, radius } = useTheme();
  const { fontScale } = useWindowDimensions();
  const suggestion = variant === 'suggestion';
  const chosen = variant === 'filter' && Boolean(selected);
  const leading: IconName | undefined = variant === 'add' ? 'plus' : icon;
  const fg = chosen ? 'text-on-inverse' : 'text-primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count === undefined ? label : `${label}, ${count} bentos`}
      accessibilityState={{
        disabled: Boolean(disabled),
        selected: variant === 'filter' ? chosen : undefined,
      }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      style={[
        {
          minHeight: suggestion ? 40 : 36,
          paddingLeft: 14,
          paddingRight: suggestion ? 12 : 14,
          borderRadius: radius.full,
          borderWidth: border.control,
          borderStyle: variant === 'add' ? 'dashed' : 'solid',
          borderColor:
            variant === 'add'
              ? colors['border-strong']
              : suggestion
                ? colors['border-subtle']
                : 'transparent',
          backgroundColor: chosen
            ? colors['bg-inverse']
            : variant === 'add'
              ? 'transparent'
              : suggestion
                ? colors['bg-surface']
                : colors['bg-sunken'],
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      {leading ? <Icon name={leading} size={16} color={fg} /> : null}
      <Text
        variant={suggestion ? 'subhead' : 'label-m'}
        weight={suggestion ? 500 : undefined}
        color={fg}
        numberOfLines={reachesWrapScale(fontScale) ? undefined : 1}
        style={{ flexShrink: 1 }}
      >
        {label}
      </Text>
      {count !== undefined ? (
        <View
          style={{
            minWidth: 22,
            minHeight: 22,
            paddingHorizontal: 6,
            borderRadius: 11,
            backgroundColor: colors['bg-sunken'],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            variant="caption"
            weight={600}
            color="text-secondary"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {String(count)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
