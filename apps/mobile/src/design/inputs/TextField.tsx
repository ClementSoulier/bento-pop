import { useState, type Ref } from 'react';
import {
  Platform,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { useTheme, type Theme } from '../theme';
import { textStyle } from '../type';
import { useAnnouncement } from '../useAnnouncement';

export type TextFieldProps = Omit<
  TextInputProps,
  'style' | 'multiline' | 'placeholderTextColor' | 'allowFontScaling' | 'accessibilityLabel'
> & {
  /** Le libellé, toujours visible au-dessus du champ : le texte d'exemple n'en tient pas lieu. */
  label?: string;
  /** Sans libellé visible (le pseudo sous le titre de sa section) : ce que lisent VoiceOver et TalkBack. */
  accessibilityLabel?: string;
  /** Avant la saisie, « @ ». */
  prefix?: string;
  /** L'aide sous le champ, à gauche. */
  helper?: string;
  /** À droite de l'aide : un compteur, « 0 / 20 ». */
  helperRight?: string;
  /** Un compteur dans le champ. */
  counter?: string;
  /** Ce qui ne va pas, sous le champ, avec une icône ; le contour passe au rouge. */
  error?: string;
  multiline?: boolean;
  /** L'apparence du champ actif, que le focus lui donne de lui-même : pour le catalogue. */
  focused?: boolean;
  ref?: Ref<TextInput>;
  /** La place du champ dans l'écran. */
  style?: StyleProp<ViewStyle>;
};

/**
 * Le champ de saisie (chantier 30, famille des listes et de la saisie) : son
 * libellé au-dessus, un cadre de 52 aux coins de 14, l'aide ou l'erreur
 * dessous. Actif, un contour d'encre de 2 et un halo jaune pâle de 4 ; en
 * erreur, un contour rouge, et le message, dit dès qu'il paraît.
 *
 * Le texte saisi est en `body-l`, 17 sur 24 quand le CSS du dossier écrit 17
 * sur 22 (D17) : le cadre garde sa hauteur de 53, le CSS posant 14 de marge
 * au-dessus et au-dessous de la ligne de 22, le champ 13 autour de celle de
 * 24. Le libellé, l'aide et le compteur ne se lisent qu'une fois, avec le
 * champ.
 */
export function TextField({
  label,
  accessibilityLabel,
  prefix,
  helper,
  helperRight,
  counter,
  error,
  multiline,
  focused,
  style,
  onFocus,
  onBlur,
  placeholder,
  accessibilityHint,
  ref,
  ...input
}: TextFieldProps) {
  const theme = useTheme();
  const { colors, border, radius, size } = theme;
  const { fontScale } = useWindowDimensions();
  const [hasFocus, setHasFocus] = useState(false);
  const active = focused ?? hasFocus;
  const { font, lineHeight } = fieldFont(fontScale);
  const ring = error
    ? colors['text-danger']
    : active
      ? colors['focus-ring']
      : colors['border-strong'];
  const hint =
    [error, helper, helperRight, counter, accessibilityHint].filter(Boolean).join('. ') ||
    undefined;
  return (
    <View style={[{ gap: 8 }, style]}>
      {label ? (
        <Text variant="label-m" accessibilityElementsHidden importantForAccessibility="no">
          {label}
        </Text>
      ) : null}
      <View>
        {active ? <FocusHalo radius={radius.md} theme={theme} /> : null}
        <View
          style={{
            flexDirection: 'row',
            alignItems: multiline ? 'flex-start' : 'center',
            gap: 8,
            minHeight: multiline ? 112 : size.field,
            paddingLeft: active ? 15.5 : 16,
            paddingRight: 14,
            borderRadius: radius.md,
            borderWidth: active || error ? 2 : border.control,
            borderColor: ring,
            backgroundColor: colors['bg-surface'],
          }}
        >
          {prefix ? (
            <Text
              variant="body-l"
              weight={600}
              color="text-secondary"
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {prefix}
            </Text>
          ) : null}
          <TextInput
            {...input}
            ref={ref}
            multiline={multiline}
            placeholder={placeholder}
            placeholderTextColor={colors['text-tertiary']}
            accessibilityLabel={label ?? accessibilityLabel ?? placeholder ?? ''}
            accessibilityHint={hint}
            allowFontScaling={false}
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
              { flex: 1, color: colors['text-primary'], paddingHorizontal: 0 },
              multiline
                ? {
                    alignSelf: 'stretch',
                    lineHeight,
                    paddingVertical: 13,
                    textAlignVertical: 'top',
                  }
                : { height: lineHeight + 26, paddingVertical: 13 },
            ]}
          />
          {counter ? (
            <Text
              variant="footnote"
              weight={500}
              color="text-tertiary"
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {counter}
            </Text>
          ) : null}
        </View>
      </View>
      {error ? <FieldError message={error} /> : null}
      {helper || helperRight ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}
        >
          <Text variant="footnote" color="text-secondary" style={{ flexShrink: 1 }}>
            {helper}
          </Text>
          {helperRight ? (
            <Text variant="footnote" color="text-secondary">
              {helperRight}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * La police d'un champ : celle de `body-l` à la taille du système, sans
 * espacement ni hauteur de ligne, que Fabric garderait d'un champ recyclé à
 * l'autre (cf. `accessibilite.test.ts`) ; la hauteur de la ligne à part.
 */
export function fieldFont(fontScale: number): { font: TextStyle; lineHeight: number } {
  const { fontSize, fontFamily, fontWeight, lineHeight } = textStyle('body-l', fontScale);
  return { font: { fontSize, fontFamily, fontWeight }, lineHeight };
}

/** Le halo d'un champ actif : 4 de jaune pâle autour du cadre, `accent-soft`. */
export function FocusHalo({ radius, theme }: { radius: number; theme: Theme }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
        borderRadius: radius + 4,
        backgroundColor: theme.colors['accent-soft'],
      }}
    />
  );
}

/**
 * Ce qui ne va pas, sous un champ : une icône et un texte, jamais la couleur
 * seule. Dit dès qu'il paraît ; le champ le lit aussi en indication.
 */
export function FieldError({ message }: { message: string }) {
  useAnnouncement(message);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
    >
      <Icon name="warning-circle" size={16} color="text-danger" />
      <Text variant="footnote" weight={600} color="text-danger" style={{ flexShrink: 1 }}>
        {message}
      </Text>
    </View>
  );
}
