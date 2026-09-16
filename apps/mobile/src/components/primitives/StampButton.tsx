import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { PressableProps } from 'react-native';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { STAMP_LABEL_LINE_H } from '@/components/bento/compose-layout';
import { CONTROL_MAX_FONT_MULTIPLIER, scaledType } from '@/components/bento/font-scaling';
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
 *
 * Le style est un **tableau**, jamais une fonction de `({ pressed })` : sous le
 * runtime JSX de NativeWind, la forme fonction n'est pas appliquée du tout.
 * Mesuré au chantier 11 sur iPhone 17 Pro, sonde bordure bleue de 6 pt et
 * opacité 0.5 sur le CTA désactivé du composer : forme fonction, bordure noire
 * pleine et rouge #e63946 inchangé ; forme tableau, bordure bleue à 50 % et
 * rouge à (240, 124, 53). Ce bouton avait donc perdu, sans que rien ne le
 * signale, les trois choses que ce style porte : l'ombre stamp de la DA, le
 * retour à l'appui et le grisé de l'état désactivé, soit un bouton inerte qui
 * se présentait comme actif. `FeedPost` avait relevé le même symptôme sur les
 * marges. L'appui se suit donc à la main, par `onPressIn` / `onPressOut`.
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
  // L'appui se suit à la main, parce que le style de ce `Pressable` est un
  // tableau et non une fonction de `({ pressed })` : cf. le commentaire du
  // composant, mesuré au chantier 11.
  const [pressed, setPressed] = useState(false);
  // Le libellé applique lui-même la police système, plafonnée, et pose sa
  // hauteur de ligne : sans elle, Android donnait à Bungee une boîte de 39 dp au
  // lieu de 20, et le bouton du composer passait sous la barre d'onglets dès la
  // taille par défaut. Cf. `naturalLineHeight`.
  const { fontScale } = useWindowDimensions();
  const type = scaledType(fontScale, CONTROL_MAX_FONT_MULTIPLIER, LABEL_SIZE, STAMP_LABEL_LINE_H);
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
      onPressIn={(e) => {
        setPressed(true);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        rest.onPressOut?.(e);
      }}
      style={[
        styles.outer,
        { alignSelf: wide ? 'stretch' : 'flex-start' },
        pressed ? { transform: [{ translateY: 2 }] } : SHADOWS.stamp,
        disabled ? { opacity: 0.5 } : null,
        typeof style === 'function' ? null : style,
      ]}
    >
      <View style={[styles.inner, { backgroundColor: palette.bg }]}>
        {iconLeft ? <View>{iconLeft}</View> : null}
        <Text
          allowFontScaling={false}
          // Une ligne, qui rétrécit plutôt que de passer à la ligne : la hauteur du
          // bouton est comptée par le budget du composer.
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[styles.label, type, { color: palette.fg }]}
        >
          {children}
        </Text>
        {iconRight ? <View>{iconRight}</View> : null}
      </View>
    </Pressable>
  );
}

/** Taille du libellé à la police par défaut. */
const LABEL_SIZE = 15;

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
    letterSpacing: 1,
    textTransform: 'uppercase',
    includeFontPadding: false,
  },
});
