import logo from '@bento-pop/brand/assets/logo/bento-pop.png';
import { Image } from 'react-native';

/** Largeur sur hauteur du fichier, 3 303 sur 761. */
const RATIO = 3303 / 761;

export type LogoProps = {
  /** En points : 30 dans la barre de La table, 40 sur l'accueil, 76 sur l'image partagée. */
  height?: number;
};

/**
 * Le logotype BENTO POP, celui de `packages/brand` (chantier 30, famille de la
 * marque) : jamais recoloré, déformé ni redessiné.
 */
export function Logo({ height = 28 }: LogoProps) {
  return (
    <Image
      source={logo}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Bento Pop"
      resizeMode="contain"
      style={{ height, width: height * RATIO }}
    />
  );
}
