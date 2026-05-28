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
import { cleanTitle } from '@/lib/text';
import { CATEGORY_META } from '@/components/bento/categories';
import { PALETTES, type PaletteKey } from '@/components/bento/palettes';
import { StampButton, useToast } from '@/components/primitives';
import { SHADOWS } from '@/components/primitives/shadow';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import type { CategoryKey } from '@/supabase/types';
import { useBento } from '@/state/bento';
import { useSession } from '@/state/session';
import {
  findSimilarItems,
  searchItems,
  submitItem,
  type ItemSearchResult,
} from '@/lib/items';
import {
  clearBentoSlot,
  ensureBento,
  setBentoSlot,
} from '@/lib/bento-actions';

/**
 * Modal de recherche d'un item pour une catégorie donnée.
 *
 * V1.1+ : la recherche tape le catalogue maison (table `items` filtrée
 * `status='validated'`) au lieu des APIs externes. Si l'utilisateur ne
 * trouve pas, il peut soumettre — un popup anti-doublon vérifie d'abord
 * qu'aucun item validé proche n'existe déjà, puis crée un item pending
 * qui attend la modération côté admin.
 */

// Largeur fixe par tile = (largeur écran - paddings horizontaux - 2 gaps) / 3.
const SCREEN_WIDTH = Dimensions.get('window').width;
const TILE_WIDTH = Math.floor((SCREEN_WIDTH - 32 - 20) / 3);

const ITEM_SEARCH_STALE_MS = 60 * 1000;

export default function SearchModal() {
  const params = useLocalSearchParams<{ category?: string }>();
  const category = (params.category ?? 'film') as CategoryKey;
  const meta = CATEGORY_META[category];

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ItemSearchResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const userId = useSession((s) => s.user?.id);
  const setSlot = useBento((s) => s.setSlot);
  const clearSlot = useBento((s) => s.clearSlot);
  const currentSlot = useBento((s) => s.slots[category]);
  const slotIsFilled = Boolean(currentSlot);
  const showToast = useToast((s) => s.show);

  const debouncedQuery = useDebouncedValue(query.trim(), 300);

  const {
    data: results = [],
    isFetching: loading,
    error,
  } = useQuery({
    queryKey: ['items-search', category, debouncedQuery],
    queryFn: () => searchItems(category, debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: ITEM_SEARCH_STALE_MS,
  });

  const paletteForResult = useMemo(() => {
    const keys = Object.keys(PALETTES) as PaletteKey[];
    return (idx: number): PaletteKey => keys[idx % (keys.length - 1)] ?? 'neutral';
  }, []);

  /**
   * Confirme un item existant du catalogue → l'attache au bento.
   */
  const onConfirmExisting = async (item: ItemSearchResult) => {
    if (!userId) return;
    setSubmitting(true);
    try {
      const bentoId = await ensureBento(userId);
      await setBentoSlot(bentoId, category, item.id);
      const idx = results.findIndex((r) => r.id === item.id);
      setSlot(category, {
        title: item.title,
        subtitle: item.subtitle ?? undefined,
        imageUrl: item.imageUrl ?? undefined,
        imageCredit: item.imageCredit ?? undefined,
        paletteKey: paletteForResult(idx >= 0 ? idx : 0),
        itemId: item.id,
        pending: false,
      });
      router.back();
    } catch (e) {
      Alert.alert('Oups', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Soumet un nouvel item (pending). Vérifie d'abord la liste des
   * similaires validés et propose à l'utilisateur de prendre un existant
   * plutôt que d'ajouter un doublon. Si l'utilisateur valide quand même,
   * on crée le pending et on l'attache au bento.
   */
  const onSubmitNew = async () => {
    if (!userId) return;
    const title = query.trim();
    if (title.length < 2) return;

    setSubmitting(true);
    try {
      const similars = await findSimilarItems(category, title);
      const top = similars[0];
      if (top) {
        // Popup anti-doublon : on propose le candidat top puis on laisse
        // décider. Cancel = on ne fait rien, l'utilisateur peut affiner.
        const cleaned = cleanTitle(top.title);
        const subtitle = top.subtitle ? ` (${top.subtitle})` : '';
        const decision = await new Promise<'existing' | 'new' | 'cancel'>((resolve) => {
          Alert.alert(
            'Tu veux dire celui-là ?',
            `On a déjà ${cleaned}${subtitle} dans le catalogue.`,
            [
              { text: 'Annuler', style: 'cancel', onPress: () => resolve('cancel') },
              {
                text: 'Ajouter quand même',
                style: 'destructive',
                onPress: () => resolve('new'),
              },
              {
                text: 'Oui, c\'est celui-là',
                onPress: () => resolve('existing'),
              },
            ],
            { cancelable: true, onDismiss: () => resolve('cancel') },
          );
        });

        if (decision === 'cancel') return;
        if (decision === 'existing') {
          await onConfirmExisting({
            id: top.id,
            title: top.title,
            subtitle: top.subtitle,
            year: top.year,
            imageUrl: top.imageUrl,
            imageCredit: null,
            score: top.score,
          });
          return;
        }
        // decision === 'new' → on continue avec submitItem.
      }

      const itemId = await submitItem(category, title);
      const bentoId = await ensureBento(userId);
      await setBentoSlot(bentoId, category, itemId);
      setSlot(category, {
        title,
        subtitle: undefined,
        imageUrl: undefined,
        paletteKey: paletteForResult(0),
        itemId,
        pending: true,
      });
      router.back();
      showToast('Proposition envoyée à la modération', {
        variant: 'neutral',
        durationMs: 4000,
      });
    } catch (e) {
      Alert.alert('Oups', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const onClear = async () => {
    if (!userId || !slotIsFilled || !currentSlot) return;
    const snapshot = currentSlot;
    const snapshotItemId = currentSlot.itemId;
    setSubmitting(true);
    try {
      const bentoId = await ensureBento(userId);
      await clearBentoSlot(bentoId, category);
      clearSlot(category);
      router.back();
      showToast('Case vidée', {
        variant: 'neutral',
        durationMs: 5000,
        action: snapshotItemId
          ? {
              label: 'Annuler',
              onPress: async () => {
                try {
                  await setBentoSlot(bentoId, category, snapshotItemId);
                  setSlot(category, snapshot);
                } catch {
                  // Si la restauration échoue, l'user peut re-sélectionner.
                }
              },
            }
          : undefined,
      });
    } catch (e) {
      Alert.alert('Oups', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmitNew = query.trim().length >= 2;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fbf3de' }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Fermer la recherche"
          style={[styles.closeBtn, SHADOWS.stamp]}
        >
          <Text style={{ fontSize: 18, fontWeight: '800', lineHeight: 18 }}>×</Text>
        </Pressable>
        <Text style={styles.headerLabel}>Case · {meta.stamp}</Text>
      </View>

      {/* Search input */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
        <View style={[styles.searchInput, SHADOWS.stamp]}>
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

      {/* Résultats + CTA Ajouter */}
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        <Text style={styles.resultsCount}>
          {results.length > 0
            ? `${results.length} résultat${results.length > 1 ? 's' : ''}`
            : query.trim()
              ? error
                ? 'Erreur réseau'
                : loading
                  ? 'Recherche…'
                  : 'Aucun résultat trouvé'
              : 'Tape pour chercher'}
        </Text>
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={{ fontSize: 12, color: '#e63946', lineHeight: 17 }}>
              {(error as Error).message}
            </Text>
          </View>
        ) : null}

        <FlatList
          data={results}
          keyExtractor={(r) => r.id}
          numColumns={3}
          columnWrapperStyle={{ gap: 10, justifyContent: 'flex-start' }}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          ListFooterComponent={
            canSubmitNew ? (
              <View style={{ marginTop: 16, paddingHorizontal: 4 }}>
                <Pressable
                  onPress={onSubmitNew}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel={`Proposer ${query.trim()} au catalogue`}
                  style={[styles.addRow, SHADOWS.stamp]}
                >
                  <View style={styles.addIconBubble}>
                    <Text style={{ fontSize: 20, lineHeight: 20, fontWeight: '800' }}>+</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addRowTitle} numberOfLines={1}>
                      Ajouter « {query.trim()} »
                    </Text>
                    <Text style={styles.addRowSubtitle}>
                      Proposer au catalogue (validé par l&apos;équipe)
                    </Text>
                  </View>
                  {submitting ? <ActivityIndicator size="small" /> : null}
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => {
            const isSelected = selected?.id === item.id;
            const palette = PALETTES[paletteForResult(index)];
            return (
              <Pressable
                onPress={() => setSelected(item)}
                accessibilityRole="button"
                accessibilityLabel={`Sélectionner ${cleanTitle(item.title)}${item.subtitle ? `, ${item.subtitle}` : ''}`}
                accessibilityState={{ selected: isSelected }}
                style={[
                  styles.tile,
                  {
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
                      <View
                        pointerEvents="none"
                        style={[
                          StyleSheet.absoluteFillObject,
                          {
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingBottom: 12,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.tileInitial,
                            { color: palette.ink },
                          ]}
                        >
                          {getInitial(cleanTitle(item.title))}
                        </Text>
                      </View>
                    </>
                  )}
                  <LinearGradient
                    colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
                    start={{ x: 0.5, y: 0.4 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <Text numberOfLines={2} style={styles.tileTitle}>
                    {cleanTitle(item.title)}
                  </Text>
                  {isSelected ? (
                    <View style={styles.tileCheck}>
                      <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '800' }}>
                        ✓
                      </Text>
                    </View>
                  ) : null}
                </View>
                {item.subtitle ? (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
                    <Text numberOfLines={1} style={styles.tileSubtitle}>
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
            <StampButton
              wide
              disabled={submitting}
              onPress={() => onConfirmExisting(selected)}
            >
              {submitting ? 'Sauvegarde…' : `Choisir ${cleanTitle(selected.title, 24)}`}
            </StampButton>
          ) : null}
          {slotIsFilled ? (
            <Pressable
              onPress={onClear}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Vider cette case"
              style={{ alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 14 }}
            >
              <Text style={styles.clearLabel}>Vider cette case</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function getInitial(s: string): string {
  const match = s.trim().match(/[A-Za-zÀ-ÿ0-9]/);
  return (match?.[0] ?? '?').toUpperCase();
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closeBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 2.5,
    borderColor: '#0a0a0a',
    borderRadius: 999,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: {
    fontFamily: 'Bungee',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  searchInput: {
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
  resultsCount: {
    fontFamily: 'Bungee',
    fontSize: 10,
    letterSpacing: 2,
    paddingHorizontal: 4,
    paddingBottom: 8,
    color: 'rgba(10,10,10,0.55)',
    textTransform: 'uppercase',
  },
  errorBanner: {
    marginHorizontal: 4,
    marginBottom: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(230,57,70,0.1)',
    borderWidth: 1.5,
    borderColor: '#e63946',
  },
  tile: {
    width: TILE_WIDTH,
    backgroundColor: '#ffffff',
    borderWidth: 2.5,
    borderColor: '#0a0a0a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tileInitial: {
    fontFamily: 'Extenda',
    fontSize: 64,
    lineHeight: 60,
    opacity: 0.22,
    letterSpacing: -2,
    textTransform: 'uppercase',
  },
  tileTitle: {
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
  },
  tileSubtitle: {
    fontSize: 9,
    color: 'rgba(10,10,10,0.6)',
    fontFamily: 'Bungee',
    letterSpacing: 0.6,
  },
  tileCheck: {
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
  },
  addRow: {
    backgroundColor: '#ffffff',
    borderWidth: 2.5,
    borderColor: '#0a0a0a',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addIconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2.5,
    borderColor: '#0a0a0a',
    backgroundColor: '#fbbf24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRowTitle: {
    fontFamily: 'Bungee',
    fontSize: 13,
    letterSpacing: 0.4,
    color: '#0a0a0a',
  },
  addRowSubtitle: {
    fontFamily: 'Fredoka',
    fontSize: 12,
    color: 'rgba(10,10,10,0.6)',
    marginTop: 2,
  },
  clearLabel: {
    fontFamily: 'Bungee',
    fontSize: 12,
    letterSpacing: 1,
    color: '#e63946',
    textTransform: 'uppercase',
    textDecorationLine: 'underline',
  },
});
