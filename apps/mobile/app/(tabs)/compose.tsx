import { useState } from 'react';
import { Alert, Image, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import logo from '@bento-pop/brand/assets/logo/bento-pop.png';
import { BentoGrid } from '@/components/bento';
import { StampButton, useToast, YellowBg } from '@/components/primitives';
import { useBento } from '@/state/bento';
import { useSession } from '@/state/session';
import { ensureBento, publishBento } from '@/lib/bento-actions';

/**
 * Composer — écran principal de l'app.
 *
 * Top bar (logo) + en-tête pseudo + titre + progress bar X/6 + grille
 * bento (taps → modal de recherche pour la catégorie cliquée) + CTA bas
 * dont le label dépend de l'état (« Compléter (n) » ou « Publier mon bento »).
 *
 * Le bento se rescale dynamiquement pour que tout tienne sur l'écran sans
 * scroller — quelle que soit la taille du device (SE → 15 Pro Max).
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
  const tabBarHeight = useBottomTabBarHeight();
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const showToast = useToast((s) => s.show);

  const onPublish = async () => {
    if (!userId || !allFilled) return;
    setPublishing(true);
    try {
      const bentoId = await ensureBento(userId);
      await publishBento(bentoId);
      router.push(`/u/${pseudo}` as const);
      // Feedback de succès — montré APRÈS le push pour que le toast
      // s'affiche sur la page publique (où l'utilisateur peut partager).
      showToast('Bento publié ! Partage-le 🍱', {
        variant: 'success',
        durationMs: 3500,
      });
    } catch (e) {
      Alert.alert('Oups', (e as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  // Calcul du scale du bento pour que tout tienne sur l'écran.
  //
  // Hauteurs « natives » (scale=1) à soustraire de la hauteur écran :
  //   - top safe area (insets.top)
  //   - top bar : pt 8 + logo 24 + mb 14 = 46
  //   - header : pseudo + titre + progress + paddings ≈ 88
  //   - tab bar (tabBarHeight, déjà inset-aware)
  //   - CTA + paddings : bouton ~52 + pad 32 + buffer 16 = 100
  // La grille à scale=1 fait ~512pt. On rétrécit jusqu'à 0.65 max (au-delà
  // ça devient illisible — l'utilisateur pourra scroller le contenu si on
  // tombe sur un device exotique).
  const NATIVE_GRID_H = 512;
  const overhead = insets.top + 46 + 88 + tabBarHeight + 100;
  const available = screenHeight - overhead;
  const bentoScale = Math.max(0.65, Math.min(1, available / NATIVE_GRID_H));

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Top bar */}
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

        {/* Grille bento — scale dynamique pour fit l'écran */}
        <View style={{ paddingHorizontal: 16 }}>
          <BentoGrid
            items={slots}
            scale={bentoScale}
            onTap={(cat) =>
              router.push({ pathname: '/search-modal', params: { category: cat } })
            }
          />
        </View>

        {/* Spacer flex pour pousser le CTA en bas */}
        <View style={{ flex: 1 }} />

        {/* CTA en flux normal, juste au-dessus du tab bar */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: tabBarHeight + 12,
          }}
        >
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
      </SafeAreaView>
    </YellowBg>
  );
}
