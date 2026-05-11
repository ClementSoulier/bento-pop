import { Text, View } from 'react-native';
import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { SHADOWS } from './shadow';

type StickerProps = {
  children: ReactNode;
  /** Couleur de fond. Défaut : rouge accent. */
  color?: string;
  /** Couleur du texte. Défaut : crème. */
  textColor?: string;
  /** Rotation en degrés. Défaut : -4°. */
  rotation?: number;
  /** Taille du texte. Défaut : 14. */
  size?: number;
  style?: ViewStyle;
};

/**
 * Sticker rouge (ou autre couleur) tourné, façon « collé à la main ».
 * Bordure ink + ombre stamp + police Bungee.
 *
 * Cf. design Claude Design — `Sticker` dans `screens.jsx`.
 */
export function Sticker({
  children,
  color = '#e63946',
  textColor = '#ffffff',
  rotation = -4,
  size = 14,
  style,
}: StickerProps) {
  // `lineHeight` explicite ≈ fontSize × 1.15 : Bungee a un ascender/descender
  // généreux et iOS dessine les glyphes au-delà de la `boundingBox` du Text
  // sans ça (lettres qui "bavent" hors du carré rouge). On compense aussi le
  // padding vertical pour que le sticker garde sa hauteur compacte.
  const lineHeight = Math.round(size * 1.15);
  return (
    <View
      style={[
        {
          backgroundColor: color,
          borderWidth: 2,
          borderColor: '#0a0a0a',
          borderRadius: 4,
          paddingHorizontal: 10,
          paddingVertical: 6,
          alignSelf: 'flex-start',
          transform: [{ rotate: `${rotation}deg` }],
        },
        SHADOWS.stamp,
        style,
      ]}
    >
      <Text
        style={{
          color: textColor,
          fontFamily: 'Bungee',
          fontSize: size,
          lineHeight,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          includeFontPadding: false,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
