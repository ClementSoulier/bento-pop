import { Platform, Pressable, View } from 'react-native';
import { radioA11y } from '@/lib/a11y-states';
import { usePress } from '../actions/usePress';
import { Text } from '../Text';
import { useTheme } from '../theme';
import { PressedFill, ROW, RowRule, useInList } from './List';

export type RadioRowProps = {
  label: string;
  checked: boolean;
  onPress: () => void;
};

/**
 * Une ligne de choix unique, les motifs d'un signalement (chantier 30,
 * famille des listes et de la saisie), à poser dans une `List` : le libellé,
 * et à droite un rond de 24, plein d'encre au centre quand il est choisi.
 *
 * Sur iOS, React Native dirait « radio button » en anglais : le rôle et
 * l'état passent par `radioA11y`, un bouton au trait « sélectionné ».
 */
export function RadioRow({ label, checked, onPress }: RadioRowProps) {
  const { colors, border, radius } = useTheme();
  const inList = useInList();
  const { pressed, onPressIn, onPressOut } = usePress();
  const a11y = radioA11y(checked, Platform.OS);
  return (
    <Pressable
      accessibilityRole={a11y.role}
      accessibilityLabel={label}
      accessibilityState={a11y.state}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={ROW}
    >
      <PressedFill pressed={pressed} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="body">{label}</Text>
      </View>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: radius.full,
          borderWidth: border.ink,
          borderColor: checked ? colors['control-on'] : colors['border-strong'],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? (
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: radius.full,
              backgroundColor: colors['control-on'],
            }}
          />
        ) : null}
      </View>
      {inList ? <RowRule inset={16} /> : null}
    </Pressable>
  );
}
