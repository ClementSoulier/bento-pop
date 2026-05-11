import { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import logo from '@bento-pop/brand/assets/logo/bento-pop.png';
import { BentoGrid } from '@/components/bento';
import { StampButton, YellowBg } from '@/components/primitives';
import { useBento } from '@/state/bento';
import { useSession } from '@/state/session';
import { ensureBento, publishBento } from '@/lib/bento-actions';

/**
 * Composer — écran principal de l'app.
 *
 * Top bar (logo + bouton menu) + en-tête pseudo + titre + progress bar X/6
 * + grille bento (taps → modal de recherche pour la catégorie cliquée) +
 * CTA sticky bottom dont le label dépend de l'état (« Compléter (n) » ou
 * « Publier mon bento »).
 *
 * Cf. design Claude Design — `ComposerScreen` dans `screens.jsx`.
 */
export default function ComposeTab() {
  const slots = useBento((s) => s.slots);
  const pseudo = useSession((s) => s.profile?.pseudo);
  const userId = useSession((s) => s.user?.id);
  const filled = Object.keys(slots).length;
  const allFilled = filled === 6;
  const [publishing, setPublishing] = useState(false);
  // La tab bar Expo Router est en overlay au-dessus de notre SafeArea.
  // On compense sa hauteur dans le padding sticky-bottom pour que le CTA
  // soit toujours visible au-dessus du tab bar.
  const tabBarHeight = useBottomTabBarHeight();

  const onPublish = async () => {
    if (!userId || !allFilled) return;
    setPublishing(true);
    try {
      const bentoId = await ensureBento(userId);
      await publishBento(bentoId);
      router.push(`/u/${pseudo}` as const);
    } catch (e) {
      Alert.alert('Oups', (e as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  // Hauteur réservée sous le bento pour éviter que le CTA sticky ne mange
  // la dernière ligne de la grille sur les écrans 6.1" (iPhone 14/15).
  // CTA height ≈ 84pt (button 50 + padding 32) + tabBar + buffer 24.
  const ctaReservedHeight = 84 + tabBarHeight + 24;

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Top bar fixe */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 8,
            marginBottom: 14,
          }}
        >
          <Image source={logo} style={{ height: 24, width: 110 }} resizeMode="contain" />
        </View>

        {/* Contenu scrollable : header + grille bento. Permet à la grille de
            déborder verticalement sur les écrans 6.1" sans être mangée par
            le CTA sticky. `paddingBottom: ctaReservedHeight` réserve la
            place du CTA + tab bar sous la dernière ligne du bento. */}
        <ScrollView
          contentContainerStyle={{ paddingBottom: ctaReservedHeight }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header pseudo + titre + progress */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
            <Text
              style={{
                fontFamily: 'Bungee',
                fontSize: 10,
                letterSpacing: 2,
                color: 'rgba(10,10,10,0.55)',
                textTransform: 'uppercase',
              }}
            >
              @{pseudo ?? '—'}
            </Text>
            <Text
              style={{
                fontFamily: 'Extenda',
                fontSize: 28,
                lineHeight: 26,
                letterSpacing: -0.3,
                color: '#0a0a0a',
                textTransform: 'uppercase',
              }}
            >
              Mon bento
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <View
                style={{
                  flex: 1,
                  height: 6,
                  backgroundColor: 'rgba(10,10,10,0.15)',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${(filled / 6) * 100}%`,
                    height: '100%',
                    backgroundColor: '#0a0a0a',
                  }}
                />
              </View>
              <Text style={{ fontFamily: 'Bungee', fontSize: 11, letterSpacing: 1 }}>
                {filled} / 6
              </Text>
            </View>
          </View>

          {/* Grille bento */}
          <View style={{ paddingHorizontal: 16 }}>
            <BentoGrid
              items={slots}
              onTap={(cat) =>
                router.push({ pathname: '/search-modal', params: { category: cat } })
              }
            />
          </View>
        </ScrollView>

        {/* Sticky CTA bottom — décalé au-dessus du tab bar Expo Router.
            Gradient en `pointerEvents=none` + bouton en `zIndex: 1` pour
            garantir que le LinearGradient ne mange jamais les events ni
            ne se peint au-dessus du CTA. */}
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', bottom: tabBarHeight, left: 0, right: 0 }}
        >
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(251,191,36,0)', '#fbbf24']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={{ padding: 16, paddingBottom: 16, zIndex: 1 }}>
            <StampButton
              wide
              disabled={filled === 0 || publishing}
              onPress={onPublish}
            >
              {publishing
                ? 'Publication…'
                : allFilled
                ? 'Publier mon bento'
                : `Compléter (${6 - filled} restant${6 - filled > 1 ? 's' : ''})`}
            </StampButton>
          </View>
        </View>
      </SafeAreaView>
    </YellowBg>
  );
}

