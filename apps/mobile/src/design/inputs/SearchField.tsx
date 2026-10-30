import { useState, type Ref } from 'react';
import {
  Platform,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { IconButton } from '../actions/IconButton';
import { Icon } from '../Icon';
import { useTheme } from '../theme';
import { fieldFont } from './TextField';

export type SearchFieldProps = Omit<
  TextInputProps,
  | 'style'
  | 'value'
  | 'onChangeText'
  | 'multiline'
  | 'placeholderTextColor'
  | 'allowFontScaling'
  | 'accessibilityLabel'
> & {
  value: string;
  onChangeText: (text: string) => void;
  /** « Cherche… » par défaut ; il dit ce qu'on peut chercher. */
  placeholder?: string;
  /** Ce que lisent VoiceOver et TalkBack, le texte d'exemple par défaut. */
  accessibilityLabel?: string;
  /** L'apparence du champ actif, que le focus lui donne de lui-même : pour le catalogue. */
  focused?: boolean;
  ref?: Ref<TextInput>;
  style?: StyleProp<ViewStyle>;
};

/**
 * Le champ de recherche (chantier 30, famille des listes et de la saisie) :
 * 46 de haut, en creux, la loupe à gauche ; actif, blanc et cerné d'encre.
 * Dès qu'il a un texte, une croix l'efface, dans un cadre de 36 dont la zone
 * tactile tient 44. Il grandit avec le texte du système.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder = 'Cherche…',
  accessibilityLabel,
  focused,
  style,
  onFocus,
  onBlur,
  ref,
  ...input
}: SearchFieldProps) {
  const { colors, radius } = useTheme();
  const { fontScale } = useWindowDimensions();
  const [hasFocus, setHasFocus] = useState(false);
  const active = focused ?? hasFocus;
  const { font, lineHeight } = fieldFont(fontScale);
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          minHeight: 46,
          paddingLeft: 12,
          paddingRight: 6,
          borderRadius: radius.md,
          borderWidth: 2,
          borderColor: active ? colors['focus-ring'] : 'transparent',
          backgroundColor: active ? colors['bg-surface'] : colors['bg-sunken'],
        },
        style,
      ]}
    >
      <Icon name="magnifying-glass" size={22} color="text-secondary" />
      <TextInput
        {...input}
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors['text-tertiary']}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        accessibilityRole={Platform.OS === 'ios' ? 'search' : undefined}
        allowFontScaling={false}
        returnKeyType="search"
        selectionColor={Platform.OS === 'ios' ? colors['text-primary'] : colors.accent}
        cursorColor={colors['text-primary']}
        selectionHandleColor={colors['text-primary']}
        onFocus={(event) => {
          setHasFocus(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setHasFocus(false);
          onBlur?.(event);
        }}
        style={[
          font,
          {
            flex: 1,
            minHeight: lineHeight,
            alignSelf: 'stretch',
            paddingVertical: 0,
            paddingHorizontal: 0,
            color: colors['text-primary'],
          },
        ]}
      />
      {value ? (
        <IconButton
          icon="x-circle"
          label="Effacer la recherche"
          weight="fill"
          size="sm"
          iconSize={24}
          color="text-tertiary"
          onPress={() => onChangeText('')}
        />
      ) : null}
    </View>
  );
}
