import { Text, View } from 'react-native';
import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';

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
 * Ombre rendue via une View dupliquée derrière la box plutôt que via le
 * `shadow*` natif iOS — sinon, combiné à `transform: rotate(...)`, iOS dessine
 * l'ombre légèrement décalée horizontalement (la « bave » noire qui dépasse à
 * droite). En la rendant comme un clone placé absolument sous la box, elle
 * suit la rotation de manière parfaitement parallèle.
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
  // généreux, sans ça les glyphes dépassent le bounding box.
  const lineHeight = Math.round(size * 1.15);
  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          transform: [{ rotate: `${rotation}deg` }],
        },
        style,
      ]}
    >
      {/* Wrapper auto-sized par l'enfant in-flow (la box) ; l'ombre absolute
          ne contribue pas à la taille mais en hérite via top/bottom. */}
      <View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 4,
            bottom: -4,
            left: 0,
            right: 0,
            backgroundColor: '#0a0a0a',
            borderRadius: 4,
          }}
        />
        <View
          style={{
            backgroundColor: color,
            borderWidth: 2,
            borderColor: '#0a0a0a',
            borderRadius: 4,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
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
      </View>
    </View>
  );
}
