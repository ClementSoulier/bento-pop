import { Platform, Pressable, View } from 'react-native';
import { checkboxA11y } from '@/lib/a11y-states';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { useTheme } from '../theme';

export type CheckboxProps = {
  checked: boolean;
  onValueChange: (next: boolean) => void;
  /** Ce que la case accepte : affiché à côté, et lu par VoiceOver et TalkBack. */
  label: string;
  disabled?: boolean;
};

/**
 * La case à cocher d'une acceptation, les règles ou les CGU (chantier 30,
 * famille des listes et de la saisie) : 26 de côté, cochée en encre et
 * coche jaune. Toute la ligne la coche ; sa zone tactile tient 44 de haut
 * quand le libellé tient sur une ligne.
 *
 * Sur iOS, React Native dirait « checkbox, unchecked » en anglais : le rôle
 * et l'état passent par `checkboxA11y` (chantier 29, D18).
 */
export function Checkbox({ checked, onValueChange, label, disabled }: CheckboxProps) {
  const { colors, border } = useTheme();
  const a11y = checkboxA11y(checked, Platform.OS);
  return (
    <Pressable
      accessibilityRole={a11y.role}
      accessibilityLabel={label}
      accessibilityState={{ ...a11y.state, disabled: Boolean(disabled) }}
      accessibilityValue={a11y.value}
      disabled={disabled}
      onPress={() => onValueChange(!checked)}
      hitSlop={{ top: 9, bottom: 9 }}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          marginTop: -1,
          borderRadius: 8,
          borderWidth: border.ink,
          borderColor: checked ? colors['control-on'] : colors['border-strong'],
          backgroundColor: checked ? colors['control-on'] : colors['bg-surface'],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? <Icon name="check" size={16} color="control-on-fg" /> : null}
      </View>
      <Text variant="subhead" style={{ flex: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}
