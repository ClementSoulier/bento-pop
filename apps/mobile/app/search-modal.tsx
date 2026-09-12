import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { cleanTitle } from '@/lib/text';
import { CATEGORY_META } from '@/components/bento/categories';
import { paletteKeyForItem } from '@/components/bento/palettes';
import { StampButton, useToast } from '@/components/primitives';
import { SHADOWS } from '@/components/primitives/shadow';
import {
  ItemTile,
  SuggestionSkeleton,
  searchPlaceholder,
  searchTileWidth,
} from '@/components/search';
import {
  SUGGESTIONS_COUNT,
  loadSuggestions,
  suggestionAccessibilityLabel,
} from '@/lib/suggestions';
import { supabase } from '@/supabase/client';
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
 * La recherche tape le catalogue maison (table `items` filtrée
 * `status='validated'`). Si l'utilisateur ne trouve pas, il peut soumettre
 * un item, qui part en `pending` et attend la modération côté admin.
 *
 * **L'écran ne s'ouvre plus sur du vide.** Il montre d'abord un échantillon
 * du catalogue, le bloc « Au menu », parce qu'au moment de remplir une case
 * l'utilisateur ne sait justement pas quoi y mettre : lui renvoyer « Tape
 * pour chercher » lui repasse la question, et six fois de suite. Mesuré
 * avant correction : 78,3 % de l'écran en crème vide.
 *
 * Ce n'est pas un palmarès, et le libellé ne prétend pas l'être : le signal
 * de popularité est encore trop mince pour ça. Cf.
 * `docs/UX-03-RECHERCHE-ITEM.md` §4.1 et la décision D2.
 */

const ITEM_SEARCH_STALE_MS = 60 * 1000;

/**
 * Le catalogue bouge à la vitesse de la modération, pas à celle de
 * l'utilisateur. Une demi-heure de fraîcheur et une heure en mémoire :
 * rouvrir la même case dans une session ne redéclenche ni requête ni
 * chargement d'image, ce qui est aussi ce qui rend le bloc tenable côté
 * egress.
 */
const SUGGESTIONS_STALE_MS = 30 * 60 * 1000;
const SUGGESTIONS_GC_MS = 60 * 60 * 1000;

/** Ce dont l'écran a besoin pour afficher une tuile et remplir une case. */
type ChosenItem = Pick<
  ItemSearchResult,
  'id' | 'title' | 'subtitle' | 'imageUrl' | 'imageCredit'
>;

/** Une tuile prête à rendre : les données plus son libellé VoiceOver. */
type DisplayedItem = ChosenItem & { a11y: string };

export default function SearchModal() {
  const params = useLocalSearchParams<{ category?: string }>();
  const category = (params.category ?? 'film') as CategoryKey;
  const meta = CATEGORY_META[category];

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ChosenItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { width: windowWidth } = useWindowDimensions();
  const tileWidth = searchTileWidth(windowWidth);
  // Constant sur la durée de vie de l'écran : la densité d'un écran ne change
  // pas. Mémorisé pour ne pas rappeler le pont natif à chaque tuile rendue.
  const pixelRatio = useMemo(() => PixelRatio.get(), []);
  const inputRef = useRef<TextInput>(null);

  const userId = useSession((s) => s.user?.id);
  const setSlot = useBento((s) => s.setSlot);
  const clearSlot = useBento((s) => s.clearSlot);
  const currentSlot = useBento((s) => s.slots[category]);
  const slotIsFilled = Boolean(currentSlot);
  const showToast = useToast((s) => s.show);

  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  /** En dessous de 2 caractères la recherche ne part pas : on propose. */
  const showSuggestions = debouncedQuery.length < 2;

  const {
    data: results = [],
    isFetching: loading,
    error,
  } = useQuery({
    queryKey: ['items-search', category, debouncedQuery],
    queryFn: () => searchItems(category, debouncedQuery),
    enabled: !showSuggestions,
    staleTime: ITEM_SEARCH_STALE_MS,
    // Garde la grille précédente pendant qu'on charge la suivante. Sans ça,
    // chaque caractère tapé vidait l'écran le temps d'un aller-retour, ce
    // qui donnait la sensation d'instabilité.
    placeholderData: keepPreviousData,
  });

  const currentItemId = currentSlot?.itemId ?? null;

  const { data: suggestions = [], isPending: suggestionsPending } = useQuery({
    // `currentItemId` fait partie de la clé : ouvrir une case remplie et une
    // case vide de la même catégorie ne donne pas la même liste.
    queryKey: ['item-suggestions', category, currentItemId],
    queryFn: () =>
      loadSuggestions(supabase, category, {
        excludeItemId: currentItemId,
        limit: SUGGESTIONS_COUNT,
      }),
    staleTime: SUGGESTIONS_STALE_MS,
    gcTime: SUGGESTIONS_GC_MS,
    // Une panne de suggestion ne doit pas ressembler à une panne de
    // l'écran : pas de bandeau, pas de nouvel essai bruyant. On retombe
    // simplement sur « Tape pour chercher », le comportement d'avant.
    retry: 1,
  });

  /**
   * Confirme un item existant du catalogue → l'attache au bento.
   */
  const onConfirmExisting = async (item: ChosenItem) => {
    if (!userId) return;
    setSubmitting(true);
    try {
      const bentoId = await ensureBento(userId);
      await setBentoSlot(bentoId, category, item.id);
      setSlot(category, {
        title: item.title,
        subtitle: item.subtitle ?? undefined,
        imageUrl: item.imageUrl ?? undefined,
        imageCredit: item.imageCredit ?? undefined,
        paletteKey: paletteKeyForItem(item.id),
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
            imageUrl: top.imageUrl,
            imageCredit: null,
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
        paletteKey: paletteKeyForItem(itemId),
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

  /**
   * Les deux sources ramenées à une seule liste de tuiles.
   *
   * Le libellé VoiceOver est calculé ici plutôt que dans `ItemTile` : une
   * proposition annonce en plus son nombre de choix quand il dépasse 1, un
   * résultat de recherche n'a pas cette information.
   */
  const displayed: DisplayedItem[] = useMemo(
    () =>
      showSuggestions
        ? suggestions.map((s) => ({
            id: s.id,
            title: s.title,
            subtitle: s.subtitle,
            imageUrl: s.imageUrl,
            imageCredit: s.imageCredit,
            a11y: `Choisir ${suggestionAccessibilityLabel(s)}`,
          }))
        : results.map((r) => ({
            id: r.id,
            title: r.title,
            subtitle: r.subtitle,
            imageUrl: r.imageUrl,
            imageCredit: r.imageCredit,
            a11y: `Choisir ${cleanTitle(r.title)}${r.subtitle ? `, ${r.subtitle}` : ''}`,
          })),
    [showSuggestions, suggestions, results],
  );

  /**
   * Libellé au-dessus de la grille.
   *
   * « Au menu » et non « Populaires » : au 12 septembre 2026, au plus trois
   * items par catégorie ont été choisis plus d'une fois, et zéro pour
   * « Chanson ». Annoncer un classement serait faux, et faux d'une manière
   * que l'utilisateur peut vérifier en regardant son propre bento.
   */
  const sectionLabel = showSuggestions
    ? displayed.length > 0 || suggestionsPending
      ? 'Au menu'
      : 'Tape pour chercher'
    : error
      ? 'Erreur réseau'
      : loading
        ? 'Recherche…'
        : results.length > 0
          ? `${results.length} résultat${results.length > 1 ? 's' : ''}`
          : 'Aucun résultat trouvé';

  /**
   * La ligne « Ajouter » n'apparaît que quand la grille correspond
   * réellement au texte tapé, c'est-à-dire quand on a pu vérifier que
   * l'item n'existe pas.
   *
   * Trois conditions, et chacune correspond à un cas observé en recette :
   *
   * - `debouncedQuery === query.trim()` : sinon elle proposait de créer
   *   « inception » pendant que la grille affichait encore les résultats de
   *   « incep » ;
   * - `!loading` : sinon elle s'affichait dès la première frappe, avant tout
   *   résultat ;
   * - `!error` : quand la recherche est tombée, on ne sait pas si l'item
   *   existe. Proposer de le créer, c'est inviter au doublon précisément
   *   quand on est le moins capable de le détecter. Le bandeau d'erreur
   *   suffit à expliquer pourquoi l'écran ne propose rien.
   */
  const canSubmitNew =
    !showSuggestions && debouncedQuery === query.trim() && !loading && !error;

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
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder(category)}
            autoCapitalize="none"
            autoCorrect={false}
            // Le clavier est levé d'emblée : six cases à remplir, c'est six
            // taps économisés. Il reste 229 pt au-dessus du clavier sur un
            // iPhone SE, mesuré, soit une rangée de tuiles entière.
            autoFocus
            returnKeyType="search"
            // La recherche tourne déjà en continu sur le debounce : la touche
            // entrée ne relance rien, elle replie le clavier pour découvrir
            // le reste de la grille.
            onSubmitEditing={() => inputRef.current?.blur()}
            style={{ fontSize: 16, fontWeight: '600', flex: 1, paddingVertical: 0 }}
          />
          {loading ? <ActivityIndicator size="small" /> : null}
        </View>
      </View>

      {/* Résultats + CTA Ajouter */}
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        <Text style={styles.resultsCount} accessibilityRole="header">
          {sectionLabel}
        </Text>
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={{ fontSize: 12, color: '#e63946', lineHeight: 17 }}>
              {(error as Error).message}
            </Text>
          </View>
        ) : null}

        <FlatList
          data={displayed}
          keyExtractor={(r) => r.id}
          numColumns={3}
          // `alignItems: 'flex-start'` et non l'étirement par défaut d'une
          // rangée flex : sans lui, une tuile sans sous-titre est étirée à la
          // hauteur de la plus grande de sa rangée et montre une bande
          // blanche vide sous son affiche. Le catalogue mélange les deux cas
          // (les films portent leur année, les créateurs non), donc c'est
          // visible dès la première grille. Des rangées légèrement inégales
          // vont bien mieux à une DA d'autocollants posés à la main.
          columnWrapperStyle={{ gap: 10, justifyContent: 'flex-start', alignItems: 'flex-start' }}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          // Décale le contenu de la hauteur du clavier pour que la dernière
          // rangée reste atteignable. Remplace un `KeyboardAvoidingView`, que
          // rien ne justifie ici : il n'y a pas de champ en bas d'écran à
          // protéger, juste une liste à ne pas tronquer.
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          // Défiler ferme le clavier : sur un petit écran c'est le geste
          // naturel pour voir plus de résultats.
          keyboardDismissMode="on-drag"
          // Sans ça, le premier tap sur une tuile ne servirait qu'à fermer le
          // clavier et il en faudrait un second pour sélectionner.
          keyboardShouldPersistTaps="handled"
          // Une rangée d'os, pas quatre : c'est ce qui est visible au-dessus
          // du clavier, et remplir l'écran pour un chargement d'environ
          // 50 ms ressemblerait plus à une panne qu'à une attente.
          ListEmptyComponent={
            showSuggestions && suggestionsPending ? (
              <SuggestionSkeleton width={tileWidth} />
            ) : null
          }
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
          renderItem={({ item, index }) => (
            <ItemTile
              item={item}
              index={index}
              width={tileWidth}
              pixelRatio={pixelRatio}
              selected={selected?.id === item.id}
              accessibilityLabel={item.a11y}
              onPress={() => setSelected(item)}
            />
          )}
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
