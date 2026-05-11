import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { BentoGrid, type BentoItems, PALETTES, type PaletteKey } from '@/components/bento';
import { CATEGORY_META } from '@/components/bento/categories';
import { SHADOWS, YellowBg } from '@/components/primitives';
import { popyForPseudo } from '@/lib/popy-avatar';
import { shareBento } from '@/lib/share';
import type { CategoryKey } from '@/supabase/types';
import { loadPublicBentoByPseudo } from '@/lib/bento-actions';

const CATEGORY_BY_ID: Record<number, CategoryKey> = {
  1: 'film',
  2: 'series',
  3: 'artist',
  4: 'track',
  5: 'creator',
  6: 'place',
};
const PALETTE_KEYS = Object.keys(PALETTES) as PaletteKey[];

/**
 * Bento public à l'adresse `/u/<pseudo>` — cible des liens de partage et
 * de la découverte par recherche. Lecture seule : pas d'édition possible.
 *
 * Cf. design Claude Design — `PublicBentoScreen` dans `screens.jsx`.
 */
export default function PublicBento() {
  const { pseudo: rawPseudo } = useLocalSearchParams<{ pseudo: string }>();
  const pseudo = rawPseudo ?? '';
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'found'; slots: BentoItems; displayName: string | null; publishedAt: string; isFeatured: boolean }
    | { kind: 'not-found' }
  >({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await loadPublicBentoByPseudo(pseudo);
      if (cancelled) return;
      if (!result) {
        setState({ kind: 'not-found' });
        return;
      }
      const slots: BentoItems = {};
      result.bento.bento_items.forEach((bi, idx) => {
        const cat = CATEGORY_BY_ID[bi.category_id];
        const item = bi.items as
          | { id: string; title: string; subtitle: string | null; image_url: string | null }
          | null;
        if (!cat || !item) return;
        slots[cat] = {
          title: item.title,
          subtitle: item.subtitle ?? undefined,
          imageUrl: item.image_url ?? undefined,
          paletteKey: PALETTE_KEYS[idx % (PALETTE_KEYS.length - 1)] ?? 'neutral',
        };
      });
      setState({
        kind: 'found',
        slots,
        displayName: result.user.display_name,
        publishedAt: result.bento.published_at!,
        isFeatured: result.bento.is_featured,
      });
    })().catch(() => {
      if (!cancelled) setState({ kind: 'not-found' });
    });
    return () => {
      cancelled = true;
    };
  }, [pseudo]);

  const popy = popyForPseudo(pseudo);

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Top bar : retour seulement */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8 }}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/compose'))}
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
            <Text style={{ fontSize: 16, fontWeight: '800' }}>‹</Text>
          </Pressable>
        </View>

        {state.kind === 'loading' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#0a0a0a" />
          </View>
        ) : state.kind === 'not-found' ? (
          <NotFound pseudo={pseudo} />
        ) : (
          <View style={{ flex: 1 }}>
            {/* Header profil */}
            <View style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 14 }}>
              <View style={{ position: 'relative' }}>
                <View
                  style={[
                    {
                      width: 70,
                      height: 70,
                      borderRadius: 35,
                      backgroundColor: '#ffffff',
                      borderWidth: 3,
                      borderColor: '#0a0a0a',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    },
                    SHADOWS.stamp,
                  ]}
                >
                  <Image source={popy.source} style={{ width: 64, height: 64 }} resizeMode="contain" />
                </View>
                {state.isFeatured ? (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: -2,
                      right: -8,
                      backgroundColor: '#e63946',
                      borderWidth: 2,
                      borderColor: '#0a0a0a',
                      borderRadius: 999,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Bungee',
                        fontSize: 9,
                        letterSpacing: 1,
                        color: '#ffffff',
                      }}
                    >
                      ★
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={{
                  fontFamily: 'Extenda',
                  fontSize: 24,
                  letterSpacing: 1,
                  marginTop: 8,
                  textTransform: 'uppercase',
                }}
              >
                @{pseudo}
              </Text>
              <Text style={{ fontSize: 13, color: 'rgba(10,10,10,0.65)', marginTop: 4 }}>
                {state.displayName ? `${state.displayName} · ` : ''}
                bento publié le {formatDate(state.publishedAt)}
              </Text>
            </View>

            {/* Grille bento read-only (pas de onTap) */}
            <View style={{ paddingHorizontal: 16, flex: 1 }}>
              <BentoGrid items={state.slots} scale={0.94} />
            </View>

            {/* Sticky CTAs bottom */}
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
              <LinearGradient
                colors={['rgba(251,191,36,0)', '#fbbf24']}
                style={{ position: 'absolute', inset: 0 }}
              />
              <View style={{ flexDirection: 'row', padding: 16, paddingBottom: 32, gap: 8 }}>
                <Pressable
                  onPress={() => router.replace('/(tabs)/compose')}
                  style={[
                    {
                      flex: 1,
                      backgroundColor: '#ffffff',
                      borderWidth: 3,
                      borderColor: '#0a0a0a',
                      borderRadius: 999,
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      alignItems: 'center',
                    },
                    SHADOWS.stamp,
                  ]}
                >
                  <Text
                    style={{
                      fontFamily: 'Bungee',
                      fontSize: 13,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                    }}
                  >
                    Compose le tien
                  </Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    const outcome = await shareBento(pseudo);
                    if (outcome === 'copied') {
                      Alert.alert('Lien copié', 'Tu peux le coller où tu veux.');
                    } else if (outcome === 'unsupported') {
                      Alert.alert('Oups', 'Partage non supporté sur ce navigateur.');
                    }
                  }}
                  style={[
                    {
                      backgroundColor: '#0a0a0a',
                      borderWidth: 3,
                      borderColor: '#0a0a0a',
                      borderRadius: 999,
                      paddingVertical: 14,
                      paddingHorizontal: 22,
                      alignItems: 'center',
                    },
                    SHADOWS.stamp,
                  ]}
                >
                  <Text
                    style={{
                      fontFamily: 'Bungee',
                      fontSize: 13,
                      letterSpacing: 1,
                      color: '#fbbf24',
                      textTransform: 'uppercase',
                    }}
                  >
                    Partager
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </YellowBg>
  );
}

function NotFound({ pseudo }: { pseudo: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
      <Text style={{ fontFamily: 'Extenda', fontSize: 36, textAlign: 'center', letterSpacing: 1 }}>
        Bento introuvable
      </Text>
      <Text
        style={{
          marginTop: 12,
          fontSize: 15,
          color: 'rgba(10,10,10,0.7)',
          textAlign: 'center',
          lineHeight: 21,
        }}
      >
        Aucun bento publié à l'adresse @{pseudo}. Il a peut-être été supprimé, ou le pseudo n'existe pas (encore).
      </Text>
    </View>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Suppress unused import (CATEGORY_META gardé pour cohérence future)
void CATEGORY_META;
