import { Image, Text, View } from 'react-native';
import logo from '@bento-pop/brand/assets/logo/bento-pop.png';
import { CONTROL_MAX_FONT_MULTIPLIER } from '@/components/bento/font-scaling';
import { SHADOWS } from './shadow';

type TopChipProps = {
  /** Label affiché dans le chip à droite. Défaut : « MON BENTO ». */
  label?: string;
};

/**
 * Barre du haut des écrans secondaires : logo Bento Pop à gauche + chip
 * label à droite. Pas de status bar (gérée par expo-status-bar dans le
 * root layout).
 *
 * Cf. design Claude Design — `TopChip` dans `screens.jsx`.
 */
export function TopChip({ label = 'Mon Bento' }: TopChipProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        gap: 8,
      }}
    >
      <Image
        source={logo}
        style={{ height: 28, width: 130 }}
        resizeMode="contain"
      />
      <View
        style={[
          {
            marginLeft: 'auto',
            flexShrink: 1,
            backgroundColor: '#ffffff',
            borderWidth: 2.5,
            borderColor: '#0a0a0a',
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 4,
          },
          SHADOWS.stamp,
        ]}
      >
        {/* Plafonnée et sur une ligne : à la plus grande police, « RECHERCHE »
            sortait du bord droit de l'écran. */}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
          style={{
            fontFamily: 'Bungee',
            fontSize: 10,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}
