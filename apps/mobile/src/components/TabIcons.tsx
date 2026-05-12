import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Icônes custom SVG pour la tab bar — dessinées inline plutôt que via une
 * police d'icônes (Ionicons placeholder). Style : bordure épaisse 2.5px,
 * coins arrondis, look "stamp" cohérent avec le reste de la DA Bento Pop.
 *
 * Les icônes utilisent `fill` quand active (filled) et juste stroke quand
 * inactive — l'état actif est plus contrasté.
 */

type IconProps = {
  size?: number;
  color?: string;
  active?: boolean;
};

const STROKE = 2.5;

/** Grille 4-cases — onglet COMPOSE. */
export function ComposeIcon({ size = 22, color = '#0a0a0a', active = false }: IconProps) {
  const fill = active ? color : 'transparent';
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Rect x="3" y="3" width="8" height="8" rx="1.5" stroke={color} strokeWidth={STROKE} fill={fill} />
        <Rect x="13" y="3" width="8" height="8" rx="1.5" stroke={color} strokeWidth={STROKE} fill={fill} />
        <Rect x="3" y="13" width="8" height="8" rx="1.5" stroke={color} strokeWidth={STROKE} fill={fill} />
        <Rect x="13" y="13" width="8" height="8" rx="1.5" stroke={color} strokeWidth={STROKE} fill={fill} />
      </Svg>
    </View>
  );
}

/** Étoile — onglet À LA UNE. */
export function FeaturedIcon({ size = 22, color = '#0a0a0a', active = false }: IconProps) {
  const fill = active ? color : 'transparent';
  // Étoile 5 branches centrée
  const star = 'M12 2 L14.6 8.6 L21.5 9.2 L16.3 13.8 L17.9 20.5 L12 17 L6.1 20.5 L7.7 13.8 L2.5 9.2 L9.4 8.6 Z';
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={star} stroke={color} strokeWidth={STROKE} fill={fill} strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

/** Loupe — onglet TROUVER. */
export function SearchIcon({ size = 22, color = '#0a0a0a' }: IconProps) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="10.5" cy="10.5" r="6.5" stroke={color} strokeWidth={STROKE} fill="transparent" />
        <Path d="M15.5 15.5 L20 20" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

/** Silhouette tête + épaules — onglet PROFIL. */
export function ProfileIcon({ size = 22, color = '#0a0a0a', active = false }: IconProps) {
  const fill = active ? color : 'transparent';
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={STROKE} fill={fill} />
        <Path
          d="M4 21 C 4 16, 8 14, 12 14 C 16 14, 20 16, 20 21"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill={fill}
        />
      </Svg>
    </View>
  );
}
