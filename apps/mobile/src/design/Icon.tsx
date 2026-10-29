import Svg, { Path } from 'react-native-svg';
import { icons, type IconName } from './icons';
import { useTheme } from './theme';
import type { ColorToken } from './tokens';

export type IconWeight = 'bold' | 'fill';

export type IconProps = {
  /** Le nom Phosphor, l'une des 72 icônes du dossier. */
  name: IconName;
  /** `bold` par défaut, `fill` pour l'état actif ou choisi : l'onglet courant, le cœur aimé. */
  weight?: IconWeight;
  /** `size-icon` (24) par défaut ; `size-icon-sm` (20) dans une ligne dense ou une puce, 26 dans la barre d'onglets. */
  size?: number;
  /** Un token de couleur, `text-primary` par défaut. */
  color?: ColorToken;
  /** Une couleur déjà résolue, celle du libellé d'un bouton, à la place de `color`. */
  tint?: string;
  /** Seulement quand l'icône porte seule un sens : elle devient une image ainsi nommée. */
  label?: string;
};

/**
 * Une icône du design system v2 (chantier 30, D3) : le tracé Phosphor du
 * dossier, dessiné dans un carré de 256.
 *
 * Décorative par défaut, comme dans le design, et cachée aux lecteurs
 * d'écran : c'est le bouton qui la porte qui se nomme. La taille ne suit pas
 * celle du texte.
 */
export function Icon({
  name,
  weight = 'bold',
  size,
  color = 'text-primary',
  tint,
  label,
}: IconProps) {
  const { colors, size: sizes } = useTheme();
  const side = size ?? sizes.icon;
  const accessibility = label
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: label }
    : {
        accessible: false,
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants' as const,
      };
  return (
    <Svg width={side} height={side} viewBox="0 0 256 256" {...accessibility}>
      <Path d={icons[name][weight]} fill={tint ?? colors[color]} />
    </Svg>
  );
}
