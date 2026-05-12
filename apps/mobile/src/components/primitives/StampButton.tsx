import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PressableProps } from 'react-native';
import type { ReactNode } from 'react';
import { SHADOWS } from './shadow';

type StampButtonProps = Omit<PressableProps, 'children'> & {
  children: ReactNode;
  /**
   * Variante de couleur :
   *  - `primary` (défaut) : fond rouge, texte crème — CTA principal
   *  - `ink` : fond noir, texte jaune — CTA secondaire
   *  - `cream` : fond crème, texte noir — bouton neutre/blanc
   */
  variant?: 'primary' | 'ink' | 'cream';
  /** Pleine largeur (utile pour les CTAs sticky bottom). */
  wide?: boolean;
  /** Icône à gauche du label. */
  iconLeft?: ReactNode;
  /** Icône à droite du label. */
  iconRight?: ReactNode;
};

const PALETTES: Record<NonNullable<StampButtonProps['variant']>, { bg: string; fg: string }> = {
  primary: { bg: '#e63946', fg: '#fbf3de' },
  ink: { bg: '#0a0a0a', fg: '#fbbf24' },
  cream: { bg: '#fbf3de', fg: '#0a0a0a' },
};

/**
 * CTA signature Bento Pop : fond coloré, bordure ink épaisse, ombre stamp
 * plate noire. Police Bungee tout-caps + tracking large.
 *
 * Structure : `Pressable` extérieur (zone tactile + transform pressed) +
 * `View` intérieur qui porte le `backgroundColor`. Le wrapper View est
 * nécessaire car react-native-css-interop (NativeWind 4) intercepte les
 * `Pressable` et peut écraser certains styles inline ; mettre la couleur
 * sur un `View` standard garantit le rendu sur iOS / Android.
 */
export function StampButton({
  children,
  variant = 'primary',
  wide,
  iconLeft,
  iconRight,
  style,
  disabled,
  ...rest
}: StampButtonProps) {
  const palette = PALETTES[variant];
  // VoiceOver : si pas d'`accessibilityLabel` explicite, on dérive du label
  // textuel — quand `children` est une string, on l'utilise directement.
  const a11yLabel =
    rest.accessibilityLabel ?? (typeof children === 'string' ? children : undefined);
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.outer,
        { alignSelf: wide ? 'stretch' : 'flex-start' },
        pressed ? null : SHADOWS.stamp,
        pressed ? { transform: [{ translateY: 2 }] } : null,
        disabled ? { opacity: 0.5 } : null,
        typeof style === 'function' ? null : style,
      ]}
    >
      <View
        style={[
          styles.inner,
          { backgroundColor: palette.bg },
        ]}
      >
        {iconLeft ? <View>{iconLeft}</View> : null}
        <Text
          style={[styles.label, { color: palette.fg }]}
        >
          {children}
        </Text>
        {iconRight ? <View>{iconRight}</View> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 999,
  },
  inner: {
    borderWidth: 3,
    borderColor: '#0a0a0a',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  label: {
    fontFamily: 'Bungee',
    fontSize: 15,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
