import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { hasExactTitle } from '@/lib/exact-title';
import { userErrorMessage } from '@/lib/user-error-message';
import {
  CONTENT_MAX_FONT_MULTIPLIER,
  CONTROL_MAX_FONT_MULTIPLIER,
  TITLE_MAX_FONT_MULTIPLIER,
  scaledType,
} from '@/components/bento/font-scaling';
import { SearchIcon } from '@/components/TabIcons';
import { useOfflineInset } from '@/lib/use-offline-inset';
import { paletteKeyForItem } from '@/components/bento/palettes';
import { INK_MUTED, INK_PLACEHOLDER, useToast } from '@/components/primitives';
import { SHADOWS } from '@/components/primitives/shadow';
import {
  ItemTile,
  SEARCH_ICON_BOX,
  SuggestionSkeleton,
  searchPlaceholder,
  searchTileWidth,
} from '@/components/search';
import {
  SUGGESTIONS_COUNT,
  loadSuggestions,
  suggestionAccessibilityLabel,
} from '@/lib/suggestions';
import { failureFeedback, slotFilledFeedback, tapFeedback } from '@/lib/haptics';
import { supabase } from '@/supabase/client';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import type { CategoryKey } from '@/supabase/types';
import { MAIN_CASE_SET } from '@/lib/case-set';
import { useBento } from '@/state/bento';
import { useSession } from '@/state/session';
import { searchItems, submitItem, type ItemSearchResult } from '@/lib/items';
import {
  clearBentoSlot,
  editableBentoId,
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

/**
 * Signale un échec d'écriture.
 *
 * Le message de l'exception ne va **pas** à l'écran. `bento-actions.ts` lève
 * des chaînes techniques et en partie anglaises (« Bento create failed:
 * … »), qui passaient jusqu'ici derrière un `Alert` intitulé « Oups ». En
 * toast, elles deviennent le message entier, en rouge et en capitales : ni
 * lisibles, ni actionnables. On dit donc ce qui s'est passé et quoi faire,
 * et on garde le détail dans les journaux.
 *
 * Harmoniser les messages de `bento-actions.ts` eux-mêmes déborde de cet
 * écran, ils sont partagés avec le composer et le profil.
 */
function reportWriteFailure(what: string, error: unknown) {
  console.warn(`[search-modal] ${what}`, error);
}

/** Ce dont l'écran a besoin pour afficher une tuile et remplir une case. */
type ChosenItem = Pick<
  ItemSearchResult,
  'id' | 'title' | 'subtitle' | 'imageUrl' | 'imageCredit'
>;

/** Une tuile prête à rendre : les données plus son libellé VoiceOver. */
type DisplayedItem = ChosenItem & { a11y: string };

/**
 * État d'une case avant modification. `null` veut dire « la case était
 * vide », ce qui est une valeur à part entière : annuler le remplissage
 * d'une case vide doit la revider.
 */
type SlotSnapshot = ReturnType<typeof useBento.getState>['slots'][CategoryKey] | null;

export default function SearchModal() {
  const params = useLocalSearchParams<{ category?: string }>();
  // La clé de la case à remplir. Pour le bento principal c'est une clé de
  // catégorie, pour une édition `ed<édition>_<rang>` : c'est le store qui
  // sait laquelle, et `search_items` la reçoit telle quelle puisqu'elle est
  // la clé en base.
  const category = (params.category ?? 'film') as string;
  const cases = useBento((s) => s.cases);
  const caseMeta = cases.find((c) => c.key === category) ?? cases[0];
  // L'identifiant de la case, ce que `bento_items` référence. Une case
  // introuvable dans le jeu courant ne s'écrit pas : mieux vaut ne rien
  // poser que de poser sur la case de quelqu'un d'autre.
  const caseId = caseMeta?.id ?? null;
  // Les six cases du bento principal portent un nom commun, une case
  // d'édition porte une question : l'article ne s'accorde que sur les
  // premières.
  const estBentoPrincipal = MAIN_CASE_SET.some((c) => c.key === category);
  const meta = { label: caseMeta?.prompt ?? '', stamp: caseMeta?.stamp ?? '', gender: caseMeta?.gender ?? 'm' };

  const [query, setQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  /**
   * Verrou du tap unique. Une ref et non un état : il doit être lu et posé
   * dans le même tour de boucle que le tap, avant tout rendu.
   */
  const choosingRef = useRef(false);

  const { width: windowWidth, fontScale } = useWindowDimensions();
  // Sur iOS, la modale est une feuille native posée au-dessus de la vue racine :
  // le bandeau hors ligne n'y est pas visible, donc il n'y a rien à réserver.
  // Sur Android, c'est un écran de la pile comme un autre.
  const bannerInset = useOfflineInset();
  const offlineInset = Platform.OS === 'android' ? bannerInset : 0;
  const tileWidth = searchTileWidth(windowWidth);
  // Constant sur la durée de vie de l'écran : la densité d'un écran ne change
  // pas. Mémorisé pour ne pas rappeler le pont natif à chaque tuile rendue.
  const pixelRatio = useMemo(() => PixelRatio.get(), []);
  const inputRef = useRef<TextInput>(null);

  const userId = useSession((s) => s.user?.id);
  const setSlot = useBento((s) => s.setSlot);
  const clearSlot = useBento((s) => s.clearSlot);
  const beginWrite = useBento((s) => s.beginWrite);
  const endWrite = useBento((s) => s.endWrite);
  const currentSlot = useBento((s) => s.slots[category]);
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
   * Restaure l'état d'avant un remplissage : soit l'item précédent, soit la
   * case vide. Sert à l'annulation par toast.
   *
   * **Un échec se dit.** La première version avalait l'erreur en silence,
   * avec l'idée que l'utilisateur pouvait toujours rouvrir la case. Sauf
   * qu'à l'écran, une annulation qui échoue et une annulation ignorée se
   * ressemblent exactement : le toast disparaît, la case ne bouge pas, et
   * rien ne dit s'il faut recommencer. Annuler est une promesse.
   */
  const restoreSlot = async (bentoId: string | null, previous: SlotSnapshot) => {
    // L'annulation part depuis le toast, donc alors que le composer a déjà
    // le focus et peut relancer une hydratation à tout moment.
    beginWrite();
    try {
      if (previous?.itemId) {
        // `bentoId` nul : brouillon d'avant compte, il n'y a rien à défaire
        // côté serveur, seulement localement. Chantier 9.
        if (bentoId && caseId !== null) await setBentoSlot(bentoId, caseId, previous.itemId);
        setSlot(category, previous);
      } else {
        // Le cas qui manquerait si on se contentait de réécrire l'ancien
        // item : remplir une case vide puis annuler doit la revider, pas la
        // laisser telle quelle.
        if (bentoId && caseId !== null) await clearBentoSlot(bentoId, caseId);
        clearSlot(category);
      }
    } catch (e) {
      reportWriteFailure('annulation', e);
      showToast("L'annulation n'a pas marché. Rouvre la case.", {
        variant: 'danger',
        durationMs: 5000,
      });
    } finally {
      endWrite();
    }
  };

  /**
   * Un tap sur une tuile remplit la case et ferme la modale.
   *
   * Le double tap d'avant (sélectionner, puis « Choisir X » en bas) coûtait
   * deux taps à tout le monde, soit douze sur un bento complet, pour un
   * geste dont la seule conséquence est réversible.
   *
   * L'écriture part en arrière-plan et la modale se ferme tout de suite :
   * `setSlot` est un store Zustand et `showToast` aussi, donc l'un et
   * l'autre survivent au démontage de cet écran. Si l'écriture échoue, le
   * store revient en arrière et le toast le dit.
   *
   * La clé primaire de `bento_items` étant `(bento_id, category_id)`, une
   * seconde tuile remplacerait simplement la première : il n'y a pas d'état
   * incohérent atteignable. Le verrou `choosingRef` sert seulement à ce
   * qu'un double tap très rapide, avant que la modale n'ait disparu, ne
   * lance pas deux écritures dont l'ordre d'arrivée n'est pas garanti.
   */
  const onChoose = async (item: ChosenItem) => {
    // **Pas de garde sur `userId`.** Depuis le chantier 9, choisir un item du
    // catalogue n'écrit rien côté serveur tant qu'il n'y a pas de profil : la
    // case va dans le brouillon de l'appareil. Exiger une session ici
    // rendait le composer muet, sans message, quand `signInAnonymously`
    // échoue, ce qui est exactement la situation du rejet App Store
    // 2bf822e0 : une revue sur réseau restreint. Cf. `state/session.ts`.
    if (choosingRef.current) return;
    choosingRef.current = true;

    // Au moment du tap, pas à la fin de l'écriture : le retour tactile doit
    // accompagner le geste, pas confirmer un aller-retour réseau.
    tapFeedback();

    const previous = currentSlot ?? null;
    // Posé avant l'écriture optimiste : le composer reprend le focus dès le
    // `router.back()` ci-dessous et relit le bento en base, où la nouvelle
    // case n'existe pas encore. Sans ce verrou, l'hydratation écraserait la
    // tuile qu'on vient d'afficher. Cf. `state/bento.ts`.
    beginWrite();
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

    try {
      // `null` : pas encore de profil, donc rien où écrire côté serveur. La
      // case est déjà posée localement et le miroir l'a mise sur l'appareil ;
      // elle partira en base à la publication. Chantier 9.
      const bentoId = userId ? await editableBentoId(userId) : null;
      if (bentoId && caseId !== null) await setBentoSlot(bentoId, caseId, item.id);
      slotFilledFeedback();
      showToast(`${meta.label} : ${cleanTitle(item.title, 20)}`, {
        variant: 'success',
        durationMs: 5000,
        action: { label: 'Annuler', onPress: () => void restoreSlot(bentoId, previous) },
      });
    } catch (e) {
      // Retour arrière local : la case affichée doit refléter la base.
      if (previous) setSlot(category, previous);
      else clearSlot(category);
      failureFeedback();
      reportWriteFailure('remplissage de case', e);
      showToast("La case n'a pas pu être enregistrée. Réessaie.", {
        variant: 'danger',
        durationMs: 5000,
      });
    } finally {
      endWrite();
    }
  };

  /**
   * Propose un item absent du catalogue.
   *
   * **Plus de popup anti-doublon.** `find_similar_items` et `search_items`
   * partagent score, filtre de catégorie et filtre de statut, et ne
   * diffèrent que par leur seuil, 0,4 contre 0,15 : les résultats de la
   * première sont donc toujours un sous-ensemble de ceux de la seconde, et
   * toujours en tête. Vérifié sur 24 requêtes réelles, 24 fois sur 24. La
   * popup interrompait l'utilisateur pour lui montrer la tuile devant
   * laquelle il venait de passer. Les vrais doublons se traitent en aval,
   * par la modération et `admin_merge_items`.
   *
   * Contrairement au choix d'un item existant, on attend ici avant de
   * fermer : l'identifiant n'existe pas encore, donc rien à écrire de façon
   * optimiste. C'est aussi lisible ainsi, choisir est instantané, créer
   * prend un instant.
   */
  const onSubmitNew = async () => {
    if (!userId) return;
    const title = query.trim();
    if (title.length < 2) return;

    setSubmitting(true);
    try {
      if (caseId === null) throw new Error('Case inconnue.');
      const itemId = await submitItem(caseId, title);
      const bentoId = await editableBentoId(userId);
      if (bentoId && caseId !== null) await setBentoSlot(bentoId, caseId, itemId);
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
      reportWriteFailure('soumission d\'item', e);
      showToast("La proposition n'a pas pu être envoyée. Réessaie.", {
        variant: 'danger',
        durationMs: 5000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onClear = async () => {
    if (!userId || !currentSlot) return;
    const snapshot = currentSlot;
    setSubmitting(true);
    try {
      const bentoId = await editableBentoId(userId);
      if (bentoId && caseId !== null) await clearBentoSlot(bentoId, caseId);
      clearSlot(category);
      router.back();
      showToast('Case vidée', {
        variant: 'neutral',
        durationMs: 5000,
        action: { label: 'Annuler', onPress: () => void restoreSlot(bentoId, snapshot) },
      });
    } catch (e) {
      reportWriteFailure('vidage de case', e);
      showToast("La case n'a pas pu être vidée. Réessaie.", {
        variant: 'danger',
        durationMs: 5000,
      });
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
   *   suffit à expliquer pourquoi l'écran ne propose rien ;
   * - **et le titre tapé n'est pas déjà dans la grille** (chantier 11) : la
   *   condition ne comparait rien, et « Ajouter « Squeezie » » s'affichait
   *   au-dessous de la tuile Squeezie, relevé en production.
   */
  const canSubmitNew =
    !showSuggestions &&
    debouncedQuery === query.trim() &&
    !loading &&
    !error &&
    !hasExactTitle(query, results.map((r) => r.title));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fbf3de', paddingTop: offlineInset }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Fermer la recherche"
          // La pastille fait 36 pt : la cible tactile en fait 44.
          hitSlop={4}
          style={[styles.closeBtn, SHADOWS.stamp]}
        >
          {/* Une croix dans une cible de 36 pt, pas un texte à lire : grossie, elle
              débordait de son cercle. */}
          <Text allowFontScaling={false} style={{ fontSize: 18, fontWeight: '800', lineHeight: 18 }}>
            ×
          </Text>
        </Pressable>
        {/* Le tampon est une abréviation, « CRÉA » : le lecteur d'écran entend
            l'intitulé entier. Sur une case d'édition, l'intitulé est la
            question affichée juste en dessous, qui porte le rôle d'en-tête :
            le tampon ne dit plus que ce qu'on cherche. */}
        <Text
          numberOfLines={1}
          accessibilityRole={estBentoPrincipal ? 'header' : 'text'}
          accessibilityLabel={
            estBentoPrincipal ? `Case ${meta.label}` : `Case ${meta.stamp.toLowerCase()}`
          }
          maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
          style={[styles.headerLabel, { flexShrink: 1 }]}
        >
          Case · {meta.stamp}
        </Text>
        <View style={{ flex: 1 }} />
        {/* Remontée du bas de l'écran : c'est une action rare, elle n'a pas
            à occuper en permanence la zone que le clavier vient recouvrir.
            `minHeight` à 44 pour une cible tactile réglementaire, contre
            8 pt de padding vertical dans la version précédente. */}
        {currentSlot ? (
          <Pressable
            onPress={() => void onClear()}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Vider cette case"
            accessibilityState={{ disabled: submitting }}
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}
          >
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
              style={styles.clearLabel}
            >
              Vider
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* La question d'une case d'édition, en entier et jamais coupée : c'est
          elle qu'on remplit. La recette du 16 septembre l'a montré, le titre
          ne disait que « Case · Film », et sur « Le duel du samedi » les deux
          cases sont des films. Le tampon reste au-dessus, parce que « Celui
          qui t'a fait rire » ne dit pas, lui, qu'on cherche un film. */}
      {!estBentoPrincipal && meta.label ? (
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={TITLE_MAX_FONT_MULTIPLIER}
          style={styles.question}
        >
          {meta.label}
        </Text>
      ) : null}

      {/* Search input */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
        <View style={[styles.searchInput, SHADOWS.stamp]}>
          {/* L'icône de la barre d'onglets, et non l'emoji 🔍 : même dessin sur les
              deux plateformes, et rien que VoiceOver lise à voix haute. */}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={SEARCH_ICON_BOX}
          >
            <SearchIcon size={18} color={INK_PLACEHOLDER} />
          </View>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder(meta, estBentoPrincipal)}
            autoCapitalize="none"
            autoCorrect={false}
            // Le clavier est levé d'emblée : six cases à remplir, c'est six
            // taps économisés. Il reste 229 pt au-dessus du clavier sur un
            // iPhone SE, mesuré, soit une rangée de tuiles entière.
            autoFocus
            returnKeyType="search"
            accessibilityLabel={searchPlaceholder(meta, estBentoPrincipal)}
            // La recherche tourne déjà en continu sur le debounce : la touche
            // entrée ne relance rien, elle replie le clavier pour découvrir
            // le reste de la grille.
            onSubmitEditing={() => inputRef.current?.blur()}
            maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
            style={{ fontSize: 16, fontWeight: '600', flex: 1, paddingVertical: 0 }}
          />
          {loading ? <ActivityIndicator size="small" /> : null}
        </View>
      </View>

      {/* Résultats + CTA Ajouter */}
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        <Text
          style={styles.resultsCount}
          accessibilityRole="header"
          numberOfLines={1}
          maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
        >
          {sectionLabel}
        </Text>
        {error ? (
          <View style={styles.errorBanner}>
            <Text
              allowFontScaling={false}
              style={{
                ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 12, 17),
                // À l'encre, pas en rouge : le rouge sur son propre voile ne
                // donnait que 3,29 : 1. Le cadre rouge dit déjà l'erreur.
                color: '#0a0a0a',
              }}
            >
              {userErrorMessage('search', error)}
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
                  accessibilityState={{ disabled: submitting, busy: submitting }}
                  style={[styles.addRow, SHADOWS.stamp]}
                >
                  <View style={styles.addIconBubble}>
                    {/* Un signe dans une pastille de 38 pt, pas un texte à lire. */}
                    <Text
                      allowFontScaling={false}
                      style={{ fontSize: 20, lineHeight: 20, fontWeight: '800' }}
                    >
                      +
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={styles.addRowTitle}
                      numberOfLines={1}
                      maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
                    >
                      Ajouter « {query.trim()} »
                    </Text>
                    <Text
                      style={styles.addRowSubtitle}
                      maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
                    >
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
              accessibilityLabel={item.a11y}
              onPress={() => void onChoose(item)}
            />
          )}
        />
      </View>

      {/* Plus de barre de boutons en bas : le tap sur une tuile valide, et
          « Vider cette case » a rejoint l'en-tête. C'est ce qui libère le bas
          de l'écran, donc ce qui rend inutile un `KeyboardAvoidingView`. */}
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
  question: {
    fontFamily: 'Bungee',
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#0a0a0a',
    paddingHorizontal: 20,
    paddingBottom: 12,
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
    color: INK_MUTED,
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
    // À l'encre, soulignée : en rouge sur le crème, 3,77 : 1 seulement.
    color: '#0a0a0a',
    textTransform: 'uppercase',
    textDecorationLine: 'underline',
  },
});
