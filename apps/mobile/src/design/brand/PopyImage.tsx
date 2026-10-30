import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import { POPY_SOURCE_SIDE } from './popy-crops';
import { popyCrop, popyImage, type Mood } from './popy-images';

/**
 * Le dessin de Popy dans un carré de `size`, cadré comme les découpes du
 * dossier (`popy-crops.ts`) : l'original agrandi et décalé, ses marges
 * transparentes débordant du carré. `Popy`, `Avatar` et `AppIcon` le posent ;
 * il ne dit rien au lecteur d'écran, eux en décident.
 */
export function PopyImage({
  mood,
  size,
  style,
}: {
  mood: Mood;
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { x, y, side } = popyCrop(mood);
  const scale = size / side;
  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Image
        source={popyImage(mood)}
        style={{
          position: 'absolute',
          left: -x * scale,
          top: -y * scale,
          width: POPY_SOURCE_SIDE * scale,
          height: POPY_SOURCE_SIDE * scale,
        }}
      />
    </View>
  );
}
