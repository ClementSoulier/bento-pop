import { View, type ViewProps } from 'react-native';
import { useTheme, type Theme } from './theme';

export type ShadowLevel = keyof Theme['shadow'];

export type PopShadowProps = ViewProps & {
  /** `pop` par défaut ; `pop-sm` pour un petit bouton, `pop-lg` pour le plateau et les boîtes de dialogue. */
  level?: ShadowLevel;
  /** Le rayon de l'objet posé dessus, que le calque reprend. */
  radius: number;
};

/**
 * Une ombre franche du design system v2 (chantier 30, D9) : un calque de la
 * couleur de l'ombre et de la forme de l'objet, décalé derrière lui, sans
 * aucun flou. C'est ce que le dossier demande quand une ombre du système
 * serait floue.
 *
 * `boxShadow` aurait suffi sur iOS et sur Android 9 et plus, mais React Native
 * ne le dessine pas en dessous (API 28), quand l'app accepte Android 7
 * (API 24) ; et `elevation` floute. Le calque, lui, se dessine partout pareil :
 * mesuré au lot 2 du chantier 30, une bande d'encre exacte au bord net, de 6, 9
 * et 15 pixels à l'iPhone 17 Pro, de 5, 8 et 13 au Pixel 8.
 *
 * L'objet est l'enfant unique, opaque, et remplit `PopShadow`, qui porte la
 * mise en page (largeur, marges, position). Le calque déborde de la boîte de
 * son décalage, comme une ombre, sans prendre de place.
 */
export function PopShadow({ level = 'pop', radius, children, ...props }: PopShadowProps) {
  const { shadow } = useTheme();
  const { x, y, color } = shadow[level];
  return (
    <View {...props}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: y,
          left: x,
          right: -x,
          bottom: -y,
          borderRadius: radius,
          backgroundColor: color,
        }}
      />
      {children}
    </View>
  );
}
