import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { Text } from '../Text';
import { useTheme } from '../theme';
import { displayFit, textStyle, type TextVariant } from '../type';

export type DisplayProps = {
  /** Quatre mots au plus, mis en capitales. */
  text: string;
  /** `xl` 44, `l` 32, `m` 24. */
  size?: 'xl' | 'l' | 'm';
  /** Une fin en lettrage autocollant : crème, cernée d'encre, sur son ombre. */
  outline?: string;
  align?: 'left' | 'center';
};

/** Le cerne de 2,5 autour de la lettre, puis le même décalé de 3 : l'ombre. */
const RING = [0, 45, 90, 135, 180, 225, 270, 315].map((degrees): [number, number] => {
  const angle = (degrees * Math.PI) / 180;
  return [
    Math.round(Math.cos(angle) * 2.5 * 100) / 100,
    Math.round(Math.sin(angle) * 2.5 * 100) / 100,
  ];
});
const LAYERS: [number, number][] = [
  ...RING.map(([x, y]): [number, number] => [x + 3, y + 3]),
  ...RING,
];

/**
 * Le titre d'affiche en Extenda, réservé aux moments de marque (chantier 30,
 * famille de la marque), fixe à 130 %.
 *
 * Le design cerne sa fin d'un trait de 5 et d'une ombre de 3. React Native ne
 * trace pas le contour d'un texte : le cerne est fait de copies d'encre
 * décalées autour de la lettre, cachées aux lecteurs d'écran, et la fin part
 * à la ligne au lieu de suivre le texte sur la même ligne.
 *
 * Un mot ne se coupe jamais (D24) : à 130 % sur un iPhone SE, « COMPOSE » ne
 * tenait plus dans sa largeur et passait à la ligne en deux morceaux. Une
 * copie invisible mesure chaque mot à la taille du style ; si le plus long
 * dépasse, toute l'affiche rapetisse juste assez.
 */
export function Display({ text, size = 'xl', outline, align = 'left' }: DisplayProps) {
  const { palette } = useTheme();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const [widest, setWidest] = useState(0);
  const variant: TextVariant = `display-${size}`;
  const fit = displayFit(width, widest);
  const base = textStyle(variant, fontScale);
  const fitted =
    fit < 1
      ? {
          fontSize: base.fontSize * fit,
          lineHeight: base.lineHeight * fit,
          letterSpacing: (base.letterSpacing ?? 0) * fit,
        }
      : null;
  const words = [text, outline ?? ''].join(' ').trim().split(/\s+/);
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={outline ? `${text} ${outline}` : text}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', top: 0, left: 0, width: 2000, opacity: 0 }}
      >
        <Text
          variant={variant}
          onTextLayout={(event) =>
            setWidest(Math.max(0, ...event.nativeEvent.lines.map((line) => line.width)))
          }
        >
          {words.join('\n')}
        </Text>
      </View>
      <Text variant={variant} style={[{ textAlign: align }, fitted]}>
        {text}
      </Text>
      {outline ? (
        <View>
          {LAYERS.map(([x, y]) => (
            <Text
              key={`${x}:${y}`}
              variant={variant}
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  transform: [{ translateX: x }, { translateY: y }],
                  color: palette['nori-900'],
                  textAlign: align,
                },
                fitted,
              ]}
            >
              {outline}
            </Text>
          ))}
          <Text
            variant={variant}
            style={[{ color: palette['rice-100'], textAlign: align }, fitted]}
          >
            {outline}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
