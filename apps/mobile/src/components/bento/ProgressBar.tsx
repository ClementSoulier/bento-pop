import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/**
 * Barre de progression du composer, animée.
 *
 * Elle sautait d'un sixième à l'autre sans transition. C'est le seul endroit
 * de l'app qui dit « tu as avancé », et il arrive juste après un aller-retour
 * dans la modale : sans mouvement, le changement passe inaperçu.
 *
 * Animer la largeur et non `scaleX` : la barre a des angles arrondis, qu'une
 * mise à l'échelle horizontale déformerait en ovales.
 *
 * `react-native-reanimated` était installé et inutilisé. Sa partie native est
 * déjà liée, et `babel-preset-expo` câble `react-native-worklets/plugin`
 * automatiquement (`configs/expo.js:98`) : rien à configurer.
 */

const DURATION_MS = 320;

export function ProgressBar({ filled, total }: { filled: number; total: number }) {
  const ratio = useSharedValue(total > 0 ? filled / total : 0);

  useEffect(() => {
    ratio.value = withTiming(total > 0 ? filled / total : 0, {
      duration: DURATION_MS,
      // Départ franc puis freinage : le mouvement se remarque sans traîner.
      easing: Easing.out(Easing.cubic),
    });
  }, [filled, total, ratio]);

  const fill = useAnimatedStyle(() => ({ width: `${ratio.value * 100}%` }));

  return (
    <View
      // Un seul élément accessible, sinon VoiceOver annonce une vue vide.
      // Le compteur « n / 6 » voisin reste lisible, mais il n'énonce pas la
      // progression.
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: filled }}
      accessibilityLabel={`${filled} case${filled > 1 ? 's' : ''} sur ${total} remplie${filled > 1 ? 's' : ''}`}
      style={{
        flex: 1,
        height: 6,
        backgroundColor: 'rgba(10,10,10,0.15)',
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      <Animated.View style={[{ height: '100%', backgroundColor: '#0a0a0a' }, fill]} />
    </View>
  );
}
