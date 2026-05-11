import { Pressable, Text, View } from 'react-native';
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
 * Cf. design Claude Design — `StampButton` dans `screens.jsx`.
 */
export function StampButton({
  children,
  variant = 'primary',
  wide,
  iconLeft,
  iconRight,
  style,
  ...rest
}: StampButtonProps) {
  const palette = PALETTES[variant];
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [
        {
          backgroundColor: palette.bg,
          borderWidth: 3,
          borderColor: '#0a0a0a',
          borderRadius: 999,
          paddingVertical: 14,
          paddingHorizontal: 22,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          alignSelf: wide ? 'stretch' : 'flex-start',
          transform: pressed ? [{ translateY: 2 }] : undefined,
        },
        pressed ? null : SHADOWS.stamp,
        typeof style === 'function' ? null : style,
      ]}
    >
      {iconLeft ? <View>{iconLeft}</View> : null}
      <Text
        style={{
          color: palette.fg,
          fontFamily: 'Bungee',
          fontSize: 15,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        {children}
      </Text>
      {iconRight ? <View>{iconRight}</View> : null}
    </Pressable>
  );
}
