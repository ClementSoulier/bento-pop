import { StyleSheet, View } from 'react-native';
import { SHADOWS } from '@/components/primitives/shadow';
import { COLUMNS, TILE_ASPECT } from './layout';

/**
 * Squelette du bloc « Au menu » pendant le chargement.
 *
 * Une seule rangée, pas quatre : c'est ce qui est visible au-dessus du
 * clavier, et remplir l'écran d'os pour un chargement d'environ 80 ms donne
 * plus l'impression d'une panne que d'une attente.
 *
 * Os inertes, sans animation de pulsation. À cette durée elle n'aurait pas le
 * temps de faire un cycle, et le chantier 2 a laissé une question ouverte sur
 * la fluidité des écrans à grille.
 */
export function SuggestionSkeleton({ width }: { width: number }) {
  return (
    <View
      // Décoratif : sans ça VoiceOver annoncerait trois éléments vides avant
      // que la grille n'arrive.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', gap: 10 }}
    >
      {Array.from({ length: COLUMNS }, (_, i) => (
        <View
          key={i}
          style={[
            styles.bone,
            { width, height: width * TILE_ASPECT },
            SHADOWS.stamp,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bone: {
    backgroundColor: 'rgba(10,10,10,0.07)',
    borderWidth: 2.5,
    borderColor: 'rgba(10,10,10,0.35)',
    borderRadius: 12,
  },
});
