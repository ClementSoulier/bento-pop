import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { searchByCategory } from '@/api/search';
import type { SearchResult } from '@/api/types';
import { fetchWikipediaThumbnail } from '@/api/wikipedia';
import { cleanTitle } from '@/lib/text';
import { CATEGORY_META } from '@/components/bento/categories';
import { PALETTES, type PaletteKey } from '@/components/bento/palettes';
import { StampButton } from '@/components/primitives';
import { SHADOWS } from '@/components/primitives/shadow';
import { EXTERNAL_SEARCH_STALE_TIME } from '@/lib/query-client';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import type { CategoryKey } from '@/supabase/types';
import { useBento } from '@/state/bento';
import { useSession } from '@/state/session';
import { clearBentoSlot, ensureBento, setBentoSlot, upsertItem } from '@/lib/bento-actions';

/**
 * Modal de recherche d'un item pour une catégorie donnée.
 *
 * - Header : bouton fermer + label « Case · FILM/SÉRIE/…»
 * - Search input avec debounce 400ms (respecte les rate-limits MB / Nominatim)
 * - Grid 3 colonnes de résultats (style TMDb : poster ratio 2/3)
 * - CTA bottom contextuel « Choisir XXX »
 *
 * Cf. design Claude Design — `SearchModalScreen` dans `screens.jsx`.
 */

// Largeur fixe par tile = (largeur écran - paddings horizontaux - 2 gaps) / 3.
// Sans ça, `flex: 1` sur les items provoque l'étirement à 100% quand il n'y a
// qu'un seul résultat. La hauteur est implicite (ratio 2/3 du poster).
const SCREEN_WIDTH = Dimensions.get('window').width;
const TILE_WIDTH = Math.floor((SCREEN_WIDTH - 32 - 20) / 3);

export default function SearchModal() {
  const params = useLocalSearchParams<{ category?: string }>();
  const category = (params.category ?? 'film') as CategoryKey;
  const meta = CATEGORY_META[category];

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const userId = useSession((s) => s.user?.id);
  const setSlot = useBento((s) => s.setSlot);
  const clearSlot = useBento((s) => s.clearSlot);
  const currentSlot = useBento((s) => s.slots[category]);
  const slotIsFilled = Boolean(currentSlot);

  // Debounce 400ms : respecte les rate-limits MB / Nominatim (1 req/s) et
  // évite de spammer TMDb. La query key change uniquement après pause.
  const debouncedQuery = useDebouncedValue(query.trim(), 400);

  const {
    data: results = [],
    isFetching: loading,
    error,
  } = useQuery({
    queryKey: ['search', category, debouncedQuery],
    queryFn: () => searchByCategory(category, debouncedQuery),
    enabled: debouncedQuery.length > 0,
    staleTime: EXTERNAL_SEARCH_STALE_TIME,
  });

  // Choix par défaut d'une palette à la sélection (cycle simple).
  const paletteForResult = useMemo(() => {
    const keys = Object.keys(PALETTES) as PaletteKey[];
    return (idx: number): PaletteKey => keys[idx % (keys.length - 1)] ?? 'neutral';
  }, []);

  const onConfirm = async () => {
    if (!selected || !userId) return;
    setSubmitting(true);
    try {
      // Enrichissement Wikipedia LAZY (uniquement à la sélection) :
      // - Si la source a déjà une image (TMDb), on garde
      // - Sinon on tente Wikipedia une seule fois pour l'item choisi
      // C'est BEAUCOUP plus rapide que d'enrichir les 12 résultats à chaque
      // frappe, et la couverture Wikipedia (~80% pour artiste/créateur/lieu
      // notables) compense le fallback gradient + initiale signature.
      let enriched = selected;
      if (!selected.imageUrl) {
        const wikiThumb = await fetchWikipediaThumbnail(selected.title);
        if (wikiThumb) enriched = { ...selected, imageUrl: wikiThumb };
      }

      // Persistance Supabase
      const itemId = await upsertItem(enriched, category);
      const bentoId = await ensureBento(userId);
      await setBentoSlot(bentoId, category, itemId);
      // Sync state local pour affichage immédiat dans le composer
      const idx = results.findIndex((r) => r.externalId === enriched.externalId);
      setSlot(category, {
        title: enriched.title,
        subtitle: enriched.subtitle,
        imageUrl: enriched.imageUrl,
        paletteKey: paletteForResult(idx >= 0 ? idx : 0),
        itemId,
      });
      router.back();
    } catch (e) {
      Alert.alert('Oups', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const onClear = () => {
    if (!userId || !slotIsFilled) return;
    Alert.alert(
      'Vider cette case ?',
      `Tu peux la remplir à nouveau à tout moment.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Vider',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              const bentoId = await ensureBento(userId);
              await clearBentoSlot(bentoId, category);
              clearSlot(category);
              router.back();
            } catch (e) {
              Alert.alert('Oups', (e as Error).message);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fbf3de' }}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
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
          <Text style={{ fontSize: 18, fontWeight: '800', lineHeight: 18 }}>×</Text>
        </Pressable>
        <Text
          style={{
            fontFamily: 'Bungee',
            fontSize: 11,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          Case · {meta.stamp}
        </Text>
      </View>

      {/* Search input */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
        <View
          style={[
            {
              backgroundColor: '#ffffff',
              borderWidth: 3,
              borderColor: '#0a0a0a',
              borderRadius: 14,
              paddingVertical: 11,
              paddingHorizontal: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            },
            SHADOWS.stamp,
          ]}
        >
          <Text style={{ fontSize: 16, color: 'rgba(10,10,10,0.4)' }}>🔍</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Cherche un ${meta.label.toLowerCase()}…`}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ fontSize: 16, fontWeight: '600', flex: 1, paddingVertical: 0 }}
          />
          {loading ? <ActivityIndicator size="small" /> : null}
        </View>
      </View>

      {/* Résultats */}
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        <Text
          style={{
            fontFamily: 'Bungee',
            fontSize: 10,
            letterSpacing: 2,
            paddingHorizontal: 4,
            paddingBottom: 8,
            color: 'rgba(10,10,10,0.55)',
            textTransform: 'uppercase',
          }}
        >
          {results.length > 0
            ? `${results.length} résultat${results.length > 1 ? 's' : ''}`
            : query.trim()
            ? error
              ? 'Erreur API'
              : loading
              ? 'Recherche…'
              : 'Aucun résultat'
            : 'Tape pour chercher'}
        </Text>
        {error ? (
          <View
            style={{
              marginHorizontal: 4,
              marginBottom: 10,
              padding: 12,
              borderRadius: 10,
              backgroundColor: 'rgba(230,57,70,0.1)',
              borderWidth: 1.5,
              borderColor: '#e63946',
            }}
          >
            <Text style={{ fontSize: 12, color: '#e63946', lineHeight: 17 }}>
              {(error as Error).message}
            </Text>
          </View>
        ) : null}
        <FlatList
          data={results}
          keyExtractor={(r) => `${r.source}:${r.externalId}`}
          numColumns={3}
          columnWrapperStyle={{ gap: 10, justifyContent: 'flex-start' }}
          contentContainerStyle={{ gap: 10, paddingBottom: 100 }}
          renderItem={({ item, index }) => {
            const isSelected = selected?.externalId === item.externalId;
            const palette = PALETTES[paletteForResult(index)];
            return (
              <Pressable
                onPress={() => setSelected(item)}
                style={[
                  {
                    width: TILE_WIDTH,
                    backgroundColor: '#ffffff',
                    borderWidth: 2.5,
                    borderColor: '#0a0a0a',
                    borderRadius: 12,
                    overflow: 'hidden',
                    transform: [
                      { rotate: `${[-0.6, 0.3, -0.4, 0.5, -0.3, 0.4][index % 6] ?? 0}deg` },
                    ],
                  },
                  SHADOWS.stamp,
                ]}
              >
                <View style={{ aspectRatio: 2 / 3, backgroundColor: palette.colors[0] }}>
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={StyleSheet.absoluteFillObject}
                      resizeMode="cover"
                    />
                  ) : (
                    <>
                      <LinearGradient
                        colors={palette.colors}
                        start={palette.start}
                        end={palette.end}
                        style={StyleSheet.absoluteFillObject}
                      />
                      {/* Fallback signature : grosse initiale en filigrane,
                          déplacé du centre pour rester visible quand le titre
                          en bas le recouvrirait. */}
                      <View
                        pointerEvents="none"
                        style={[
                          StyleSheet.absoluteFillObject,
                          { alignItems: 'center', justifyContent: 'center', paddingBottom: 12 },
                        ]}
                      >
                        <Text
                          style={{
                            fontFamily: 'Extenda',
                            fontSize: 64,
                            lineHeight: 60,
                            color: palette.ink,
                            opacity: 0.22,
                            letterSpacing: -2,
                            textTransform: 'uppercase',
                          }}
                        >
                          {getInitial(cleanTitle(item.title))}
                        </Text>
                      </View>
                    </>
                  )}
                  {/* Overlay sombre du bas pour lisibilité titre */}
                  <LinearGradient
                    colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
                    start={{ x: 0.5, y: 0.4 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <Text
                    numberOfLines={2}
                    style={{
                      position: 'absolute',
                      bottom: 6,
                      left: 6,
                      right: 6,
                      fontFamily: 'Extenda',
                      fontSize: 11,
                      lineHeight: 11,
                      color: '#ffffff',
                      textTransform: 'uppercase',
                      textShadowColor: 'rgba(0,0,0,0.5)',
                      textShadowRadius: 2,
                    }}
                  >
                    {cleanTitle(item.title)}
                  </Text>
                  {isSelected ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        backgroundColor: '#e63946',
                        borderWidth: 2,
                        borderColor: '#0a0a0a',
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '800' }}>✓</Text>
                    </View>
                  ) : null}
                </View>
                {item.subtitle ? (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 9,
                        color: 'rgba(10,10,10,0.6)',
                        fontFamily: 'Bungee',
                        letterSpacing: 0.6,
                      }}
                    >
                      {item.subtitle}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          }}
        />
      </View>

      {/* Boutons d'action bas — confirmer (si sélection) + vider (si slot rempli) */}
      {selected || slotIsFilled ? (
        <View style={{ padding: 16, paddingBottom: 24, gap: 8 }}>
          {selected ? (
            <StampButton wide disabled={submitting} onPress={onConfirm}>
              {submitting ? 'Sauvegarde…' : `Choisir ${cleanTitle(selected.title, 24)}`}
            </StampButton>
          ) : null}
          {slotIsFilled ? (
            <Pressable
              onPress={onClear}
              disabled={submitting}
              style={{
                alignSelf: 'center',
                paddingVertical: 8,
                paddingHorizontal: 14,
              }}
            >
              <Text
                style={{
                  fontFamily: 'Bungee',
                  fontSize: 12,
                  letterSpacing: 1,
                  color: '#e63946',
                  textTransform: 'uppercase',
                  textDecorationLine: 'underline',
                }}
              >
                Vider cette case
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/** Première lettre du titre — pour le fallback visuel signature. */
function getInitial(s: string): string {
  const match = s.trim().match(/[A-Za-zÀ-ÿ0-9]/);
  return (match?.[0] ?? '?').toUpperCase();
}
