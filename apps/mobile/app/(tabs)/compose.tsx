import { useState } from 'react';
import { Alert, Image, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import logo from '@bento-pop/brand/assets/logo/bento-pop.png';
import { BentoGrid } from '@/components/bento';
import { StampButton, YellowBg } from '@/components/primitives';
import { SHADOWS } from '@/components/primitives/shadow';
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

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1 }}>
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
          <View
            style={{ marginLeft: 'auto', flexDirection: 'row', gap: 8, alignItems: 'center' }}
          >
            <View
              style={[
                {
                  backgroundColor: '#ffffff',
                  borderWidth: 2.5,
                  borderColor: '#0a0a0a',
                  borderRadius: 999,
                  width: 36,
                  height: 36,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                SHADOWS.stamp,
              ]}
            >
              <Text style={{ fontSize: 14, fontWeight: '800' }}>≡</Text>
            </View>
          </View>
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

        {/* Grille bento */}
        <View style={{ paddingHorizontal: 16, flex: 1 }}>
          <BentoGrid
            items={slots}
            onTap={(cat) =>
              router.push({ pathname: '/search-modal', params: { category: cat } })
            }
          />
        </View>

        {/* Sticky CTA bottom */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <LinearGradient
            colors={['rgba(251,191,36,0)', '#fbbf24']}
            style={{ position: 'absolute', inset: 0 }}
          />
          <View style={{ padding: 16, paddingBottom: 32 }}>
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

