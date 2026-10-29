import { useWindowDimensions, View } from 'react-native';
import { PopShadow } from '../PopShadow';
import { Text } from '../Text';
import { useTheme } from '../theme';
import { textStyle } from '../type';

export type StickerProps = {
  /** Trois mots au plus, mis en capitales. */
  label: string;
  /** `ink` par défaut, `yolk` ou `rice`. */
  tone?: 'ink' | 'yolk' | 'rice';
  /** En degrés, de -6 à 6 ; -3 par défaut. */
  tilt?: number;
};

const RADIUS = 10;

/**
 * L'étiquette penchée des moments de marque (chantier 30, famille de la
 * marque). Encre : texte jaune, ombre d'encre à 28 % ; jaune ou riz : cernée
 * d'encre, sur l'ombre `pop-sm`.
 *
 * Le design l'écrit en 14 ; le système n'a pas ce style, elle prend `label-s`
 * (13/16) et son approche de 0,08 em, qui suit la taille du texte.
 */
export function Sticker({ label, tone = 'ink', tilt = -3 }: StickerProps) {
  const { palette } = useTheme();
  const { fontScale } = useWindowDimensions();
  const { fontSize } = textStyle('label-s', fontScale);
  const ink = tone === 'ink';
  const face = (
    <View
      style={{
        minHeight: 32,
        paddingHorizontal: 14,
        paddingVertical: 4,
        borderRadius: RADIUS,
        justifyContent: 'center',
        backgroundColor: ink
          ? palette['nori-900']
          : palette[tone === 'yolk' ? 'yolk-300' : 'rice-100'],
        borderWidth: ink ? 0 : 2,
        borderColor: palette['nori-900'],
      }}
    >
      <Text
        variant="label-s"
        numberOfLines={1}
        style={{
          color: ink ? palette['yolk-300'] : palette['nori-900'],
          textTransform: 'uppercase',
          letterSpacing: Math.round(fontSize * 0.08 * 100) / 100,
        }}
      >
        {label}
      </Text>
    </View>
  );
  return (
    <View style={{ alignSelf: 'flex-start', transform: [{ rotate: `${tilt}deg` }] }}>
      {ink ? (
        <View>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 3,
              left: 3,
              right: -3,
              bottom: -3,
              borderRadius: RADIUS,
              backgroundColor: palette['nori-900'],
              opacity: 0.28,
            }}
          />
          {face}
        </View>
      ) : (
        <PopShadow level="pop-sm" radius={RADIUS}>
          {face}
        </PopShadow>
      )}
    </View>
  );
}
