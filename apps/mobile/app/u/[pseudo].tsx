import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import {
  BentoGrid,
  type BentoItems,
  PALETTES,
  type PaletteKey,
  ShareImage,
} from '@/components/bento';
import { CATEGORY_META } from '@/components/bento/categories';
import { SHADOWS, YellowBg } from '@/components/primitives';
import { popyForPseudo } from '@/lib/popy-avatar';
import { shareBentoImage } from '@/lib/share-image';
import { submitReport } from '@/lib/report';
import { useBlocked } from '@/state/blocked';
import { useSession } from '@/state/session';
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
  const ownPseudo = useSession((s) => s.profile?.pseudo);
  // Signaler / bloquer ne doit pas apparaître sur son propre bento (n'a
  // pas de sens et passerait pour un bug). Comparaison case-insensitive
  // car les URLs peuvent varier.
  const isOwnBento = Boolean(
    ownPseudo && pseudo && ownPseudo.toLowerCase() === pseudo.toLowerCase(),
  );
  const shareImageRef = useRef<View>(null);
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
        {/* Top bar : retour + signaler */}
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: 16,
            paddingTop: 8,
            alignItems: 'center',
          }}
        >
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
          {state.kind === 'found' && !isOwnBento ? (
            <BlockReportMenu pseudo={pseudo} />
          ) : null}
        </View>

        {state.kind === 'loading' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#0a0a0a" />
          </View>
        ) : state.kind === 'not-found' ? (
          <NotFound pseudo={pseudo} />
        ) : (
          <View style={{ flex: 1 }}>
            {/*
              ShareImage rendue dans le viewport mais en `opacity: 0` pour
              que `react-native-view-shot` la capture proprement. iOS optimise
              le rendu des vues vraiment offscreen (top: -10000) et le
              <Text> à police custom (Extenda) peut alors ne pas être mesuré
              à temps avant la capture → pseudo manquant dans l'image
              partagée. Avec opacity 0 + pointerEvents=none, c'est invisible
              pour l'utilisateur mais pleinement rendu pour view-shot.
            */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 600,
                height: 800,
                opacity: 0,
              }}
            >
              <ShareImage ref={shareImageRef} items={state.slots} pseudo={pseudo} />
            </View>
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
                      bottom: -4,
                      right: -4,
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: '#e63946',
                      borderWidth: 2.5,
                      borderColor: '#0a0a0a',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: '#ffffff',
                        fontSize: 14,
                        lineHeight: 16,
                        fontWeight: '800',
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
            <View
              pointerEvents="box-none"
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
            >
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(251,191,36,0)', '#fbbf24']}
                style={StyleSheet.absoluteFillObject}
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
                    const outcome = await shareBentoImage(pseudo, shareImageRef);
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

/**
 * Menu d'actions modération sur le bento d'autrui : Signaler + Bloquer
 * (ou Débloquer si déjà mute). Le block est purement local au device
 * (AsyncStorage via `useBlocked`), pas notifié au backend.
 */
function BlockReportMenu({ pseudo }: { pseudo: string }) {
  const isBlocked = useBlocked((s) => s.isBlocked(pseudo));
  const block = useBlocked((s) => s.block);
  const unblock = useBlocked((s) => s.unblock);

  const onPress = () => {
    const options: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = [
      {
        text: 'Signaler ce bento',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Signaler ce bento',
            `Tu vas signaler @${pseudo} à l'équipe Bento Pop. Confirme-tu ?`,
            [
              { text: 'Annuler', style: 'cancel' },
              {
                text: 'Signaler',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await submitReport({ targetKind: 'bento', targetPseudo: pseudo });
                    Alert.alert('Merci', 'Notre équipe va examiner ce bento sous 24h.');
                  } catch (e) {
                    Alert.alert('Oups', (e as Error).message);
                  }
                },
              },
            ],
          );
        },
      },
    ];
    if (isBlocked) {
      options.push({
        text: `Débloquer @${pseudo}`,
        onPress: () => unblock(pseudo),
      });
    } else {
      options.push({
        text: `Bloquer @${pseudo}`,
        onPress: () =>
          Alert.alert(
            'Bloquer cet utilisateur ?',
            "Tu ne verras plus son bento dans À la une ni dans la recherche. Tu peux annuler à tout moment depuis ce menu.",
            [
              { text: 'Annuler', style: 'cancel' },
              {
                text: 'Bloquer',
                style: 'destructive',
                onPress: () => block(pseudo),
              },
            ],
          ),
      });
    }
    options.push({ text: 'Annuler', style: 'cancel' });
    Alert.alert(`Options pour @${pseudo}`, undefined, options);
  };

  return (
    <Pressable
      onPress={onPress}
      style={{ marginLeft: 'auto', paddingHorizontal: 12, paddingVertical: 6 }}
    >
      <Text
        style={{
          fontFamily: 'Bungee',
          fontSize: 10,
          letterSpacing: 1.5,
          color: 'rgba(10,10,10,0.55)',
          textTransform: 'uppercase',
        }}
      >
        Options
      </Text>
    </Pressable>
  );
}

// Suppress unused import (CATEGORY_META gardé pour cohérence future)
void CATEGORY_META;
