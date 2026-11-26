import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, View, type TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CATEGORY_META } from '@bento-pop/supabase-mobile/bento';
import {
  Dialog,
  Icon,
  ItemGrid,
  ItemGridSkeleton,
  Popy,
  ProposeRow,
  SearchField,
  Sheet,
  Tag,
  Text,
  caseCategory,
  type ItemGridEntry,
} from '@/design';
import { cleanTitle } from '@/lib/text';
import { hasExactTitle } from '@/lib/exact-title';
import { userErrorMessage } from '@/lib/user-error-message';
import { ToastHost } from '@/components/ToastHost';
import { useOfflineInset } from '@/lib/use-offline-inset';
import { paletteKeyForItem } from '@/components/bento/palettes';
import { useToast } from '@/components/primitives';
import { searchPlaceholder } from '@/components/search';
import {
  SUGGESTIONS_COUNT,
  loadSuggestions,
  suggestionAccessibilityLabel,
} from '@/lib/suggestions';
import { errorFeedback, selectionFeedback, successFeedback, warningFeedback } from '@/lib/haptics';
import { supabase } from '@/supabase/client';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import type { CategoryKey } from '@/supabase/types';
import { MAIN_CASE_SET } from '@/lib/case-set';
import { useBento } from '@/state/bento';
import { useOwnWhys } from '@/state/own-whys';
import { useSession } from '@/state/session';
import { fillsBento } from '@/lib/compose-slots';
import { searchItems, submitItem, type ItemSearchResult } from '@/lib/items';
import { offerPushAfterProposal } from '@/lib/push-runtime';
import { clearBentoSlot, editableBentoId, setBentoSlot } from '@/lib/bento-actions';

/**
 * La recherche d'un item pour une case (chantier 32, lot 3 : `c02`, `c03`,
 * `c04`, `c10`).
 *
 * La recherche tape le catalogue maison (table `items` filtrée
 * `status='validated'`). Si l'utilisateur ne trouve pas, il peut soumettre
 * un item, qui part en `pending` et attend la modération côté admin.
 *
 * **Une route qui n'est qu'une feuille** (D9 du 32) : en `transparentModal`,
 * elle rend le `Sheet` du design, `full`, sur le composer qu'on voit dessous,
 * le même dessin aux deux plateformes. Les liens profonds, les notifications et
 * le retour au composer, qui relit le bento, ne changent pas. La feuille monte
 * à l'ouverture ; la croix, la poignée tirée, le voile et le retour d'Android la
 * font redescendre, et la route part une fois la feuille sortie.
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

/** Ce dont l'écran a besoin pour afficher un item et remplir une case. */
type ChosenItem = Pick<ItemSearchResult, 'id' | 'title' | 'subtitle' | 'imageUrl' | 'imageCredit'>;

/** Un item prêt à rendre : les données plus son libellé VoiceOver. */
type DisplayedItem = ChosenItem & ItemGridEntry;

/**
 * État d'une case avant modification. `null` veut dire « la case était
 * vide », ce qui est une valeur à part entière : annuler le remplissage
 * d'une case vide doit la revider.
 */
type SlotSnapshot = ReturnType<typeof useBento.getState>['slots'][CategoryKey] | null;

/** La question posée avant d'effacer un pourquoi (chantier 12, D7 ; D11 du 32). */
type WhyLossAsk = { verb: 'replace' | 'clear'; title: string };

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
  const meta = {
    label: caseMeta?.prompt ?? '',
    stamp: caseMeta?.stamp ?? '',
    gender: caseMeta?.gender ?? 'm',
  };
  // La catégorie de la case (D5) : la couleur de sa puce et des affiches absentes.
  const tint = caseMeta ? caseCategory(caseMeta) : null;

  const [query, setQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<TextInput>(null);
  /**
   * La feuille : montée à l'ouverture, elle redescend avant que la route parte,
   * et le clavier avec elle, plutôt que de rester levé jusqu'au départ de la route.
   */
  const [open, setOpen] = useState(true);
  const close = () => {
    inputRef.current?.blur();
    setOpen(false);
  };
  /**
   * La route part une fois, et seulement si elle est encore là : un départ de
   * trop ferait reculer la navigation sous le composer. Si la sortie de la
   * feuille n'aboutissait pas, la route transparente resterait posée sur le
   * composer et prendrait ses touchers : elle part d'elle-même au bout d'une
   * seconde, la sortie en durant 320 ms.
   */
  const left = useRef(false);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  const leave = () => {
    if (left.current || !alive.current) return;
    left.current = true;
    router.back();
  };
  useEffect(() => {
    if (open) return;
    const fallback = setTimeout(leave, 1000);
    return () => clearTimeout(fallback);
    // `leave` ne lit que des refs : seule la fermeture compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  /**
   * Verrou du tap unique. Une ref et non un état : il doit être lu et posé
   * dans le même tour de boucle que le tap, avant tout rendu.
   */
  const choosingRef = useRef(false);

  // Sur iOS, la route est une présentation native posée au-dessus de la vue
  // racine : le bandeau hors ligne n'y est pas visible, donc il n'y a rien à
  // réserver. Sur Android, il passe au-dessus de la route : la feuille descend
  // de sa hauteur.
  const bannerInset = useOfflineInset();
  const offlineInset = Platform.OS === 'android' ? bannerInset : 0;

  const userId = useSession((s) => s.user?.id);
  const setSlot = useBento((s) => s.setSlot);
  const clearSlot = useBento((s) => s.clearSlot);
  const beginWrite = useBento((s) => s.beginWrite);
  const endWrite = useBento((s) => s.endWrite);
  const currentSlot = useBento((s) => s.slots[category]);
  /**
   * La case telle que la feuille la montre : figée dès qu'elle se ferme. Choisir,
   * proposer ou vider change la case puis ferme la feuille dans le même geste ;
   * sans ça, elle se redessinait en descendant, « Vider » apparu et ses
   * propositions rechargées.
   */
  const shownSlotRef = useRef(currentSlot);
  if (open) shownSlotRef.current = currentSlot;
  const shownSlot = shownSlotRef.current;
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

  const currentItemId = shownSlot?.itemId ?? null;

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
   * Chantier 12 (D7) : remplacer ou vider une case expliquée efface son
   * pourquoi, qui expliquait l'autre item. La question d'abord, seulement
   * quand la case en a un ; `true` quand on peut continuer.
   *
   * Dans le `Dialog` du design (D11 du 32), le gabarit « Confirmation » du
   * guide, à la place de l'`Alert` du système : Popy gênée, la question, la
   * conséquence, l'action destructive puis « Annuler ». Le texte ne change pas.
   */
  const [whyLoss, setWhyLoss] = useState<WhyLossAsk | null>(null);
  const [whyLossOpen, setWhyLossOpen] = useState(false);
  const whyLossAnswer = useRef<((proceed: boolean) => void) | null>(null);
  const confirmWhyLoss = (verb: 'replace' | 'clear'): Promise<boolean> => {
    const bentoId = useBento.getState().current?.id;
    if (!currentSlot?.itemId || !useOwnWhys.getState().has(bentoId, category)) {
      return Promise.resolve(true);
    }
    const title = cleanTitle(currentSlot.title, 30);
    return new Promise((resolve) => {
      // Le clavier se range : la question prend tout l'écran.
      inputRef.current?.blur();
      whyLossAnswer.current = resolve;
      setWhyLoss({ verb, title });
      setWhyLossOpen(true);
      // L'ouverture d'une confirmation destructive, le retour du guide.
      warningFeedback();
    });
  };
  /** Une seule réponse, même si le bouton et le retour arrivent ensemble. */
  const answerWhyLoss = (proceed: boolean) => {
    const answer = whyLossAnswer.current;
    whyLossAnswer.current = null;
    setWhyLossOpen(false);
    answer?.(proceed);
  };

  /** Ce que la base vient d'effacer, effacé ici aussi. */
  const forgetWhy = (bentoId: string | null) => {
    if (bentoId) useOwnWhys.getState().put(bentoId, category, null);
  };

  /**
   * Un tap sur un item remplit la case et ferme la feuille.
   *
   * Le double tap d'avant (sélectionner, puis « Choisir X » en bas) coûtait
   * deux taps à tout le monde, soit douze sur un bento complet, pour un
   * geste dont la seule conséquence est réversible.
   *
   * L'écriture part en arrière-plan et la feuille se ferme tout de suite :
   * `setSlot` est un store Zustand et `showToast` aussi, donc l'un et
   * l'autre survivent au démontage de cet écran. Si l'écriture échoue, le
   * store revient en arrière et le toast le dit.
   *
   * La clé primaire de `bento_items` étant `(bento_id, category_id)`, une
   * seconde tuile remplacerait simplement la première : il n'y a pas d'état
   * incohérent atteignable. Le verrou `choosingRef` sert seulement à ce
   * qu'un double tap très rapide, avant que la feuille n'ait disparu, ne
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
    selectionFeedback();

    const previous = currentSlot ?? null;
    const replacing = Boolean(previous?.itemId && previous.itemId !== item.id);
    if (replacing && !(await confirmWhyLoss('replace'))) {
      choosingRef.current = false;
      return;
    }
    // À demander avant de poser la case : c'est ce choix qui complète le bento.
    const completes = fillsBento(cases, useBento.getState().slots, category);
    // Posé avant l'écriture optimiste : le composer reprend le focus dès que
    // la route part, et relit le bento en base, où la nouvelle case n'existe
    // pas encore. Sans ce verrou, l'hydratation écraserait la case qu'on vient
    // d'afficher. Cf. `state/bento.ts`.
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
    close();

    try {
      // `null` : pas encore de profil, donc rien où écrire côté serveur. La
      // case est déjà posée localement et le miroir l'a mise sur l'appareil ;
      // elle partira en base à la publication. Chantier 9.
      const bentoId = userId ? await editableBentoId(userId) : null;
      if (bentoId && caseId !== null) await setBentoSlot(bentoId, caseId, item.id);
      if (replacing) forgetWhy(bentoId);
      // La célébration porte son retour de succès : un seul par événement (D13).
      if (completes) useBento.getState().askCelebration();
      else successFeedback();
      showToast(`${meta.label} : ${cleanTitle(item.title, 20)}`, {
        variant: 'success',
        // Les flèches de la maquette `c07` (chantier 31).
        icon: 'arrows-clockwise',
        durationMs: 5000,
        action: { label: 'Annuler', onPress: () => void restoreSlot(bentoId, previous) },
      });
    } catch (e) {
      // Retour arrière local : la case affichée doit refléter la base.
      if (previous) setSlot(category, previous);
      else clearSlot(category);
      errorFeedback();
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
    if (!(await confirmWhyLoss('replace'))) return;

    setSubmitting(true);
    try {
      if (caseId === null) throw new Error('Case inconnue.');
      const itemId = await submitItem(caseId, title);
      const bentoId = await editableBentoId(userId);
      if (bentoId && caseId !== null) await setBentoSlot(bentoId, caseId, itemId);
      forgetWhy(bentoId);
      if (fillsBento(cases, useBento.getState().slots, category)) {
        useBento.getState().askCelebration();
      }
      setSlot(category, {
        title,
        subtitle: undefined,
        imageUrl: undefined,
        paletteKey: paletteKeyForItem(itemId),
        itemId,
        pending: true,
      });
      close();
      showToast('Proposition envoyée à la modération', {
        variant: 'neutral',
        durationMs: 4000,
      });
      // Chantier 17 (D5, D14) : c'est le moment où « on te prévient quand il
      // sera validé » a un sens. Ne bloque rien, ne lève pas.
      void offerPushAfterProposal(title);
    } catch (e) {
      reportWriteFailure("soumission d'item", e);
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
    if (!(await confirmWhyLoss('clear'))) return;
    const snapshot = currentSlot;
    setSubmitting(true);
    try {
      const bentoId = await editableBentoId(userId);
      if (bentoId && caseId !== null) await clearBentoSlot(bentoId, caseId);
      forgetWhy(bentoId);
      clearSlot(category);
      close();
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
   * Les deux sources ramenées à une seule liste d'items.
   *
   * Le libellé VoiceOver est calculé ici plutôt que dans `ItemCard` : une
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
            accessibilityLabel: `Choisir ${suggestionAccessibilityLabel(s)}`,
          }))
        : results.map((r) => ({
            id: r.id,
            title: r.title,
            subtitle: r.subtitle,
            imageUrl: r.imageUrl,
            imageCredit: r.imageCredit,
            accessibilityLabel: `Choisir ${cleanTitle(r.title)}${r.subtitle ? `, ${r.subtitle}` : ''}`,
          })),
    [showSuggestions, suggestions, results],
  );

  /**
   * Aucun résultat pour ce qu'on a tapé (`c04`) : Popy surprise et « Aucun
   * résultat trouvé » à la place du libellé, la ligne pour proposer dessous.
   */
  const noResult = !showSuggestions && !error && !loading && results.length === 0;

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
        : `${results.length} résultat${results.length > 1 ? 's' : ''}`;

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
   *   quand on est le moins capable de le détecter. Le message d'erreur
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
    !hasExactTitle(
      query,
      results.map((r) => r.title),
    );

  // L'en-tête (`c02`, `c10`) : la puce de la case, « Case », ou « Case · Film »
  // sur une édition, et le titre, la question entière sur une édition. Le
  // lecteur d'écran garde ce qu'il disait : « Case Artiste » en en-tête sur le
  // bento principal ; sur une édition, « Case film », puis la question.
  const typeName = tint ? CATEGORY_META[tint].label : null;
  const eyebrow = !estBentoPrincipal && typeName ? `Case · ${typeName}` : 'Case';

  return (
    <View style={{ flex: 1, marginTop: offlineInset }}>
      <Sheet
        visible={open}
        onClose={close}
        onHidden={leave}
        inScreen
        height="full"
        eyebrow={eyebrow}
        eyebrowLeading={<Tag category={tint} variant="surface" label={meta.stamp} />}
        eyebrowAccessibilityLabel={
          estBentoPrincipal ? null : `Case ${meta.stamp.toLocaleLowerCase('fr')}`
        }
        title={meta.label}
        titleAccessibilityLabel={estBentoPrincipal ? `Case ${meta.label}` : undefined}
        closeLabel="Fermer la recherche"
        // Une action rare, dans l'en-tête : elle n'a pas à occuper la zone que
        // le clavier vient recouvrir.
        action={
          shownSlot
            ? {
                label: 'Vider',
                accessibilityLabel: 'Vider cette case',
                onPress: () => void onClear(),
                disabled: submitting,
              }
            : undefined
        }
      >
        <SearchField
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          placeholder={searchPlaceholder(meta, estBentoPrincipal)}
          autoCapitalize="none"
          autoCorrect={false}
          // Le clavier est levé d'emblée : six cases à remplir, c'est six
          // taps économisés.
          autoFocus
          // La recherche tourne déjà en continu sur le debounce : la touche
          // entrée ne relance rien, elle replie le clavier pour découvrir
          // le reste de la grille.
          onSubmitEditing={() => inputRef.current?.blur()}
        />
        <ScrollView
          // Jusqu'au bord de la zone sûre, comme la maquette : la marge du bas de
          // la feuille ne coupe pas la grille, elle termine le défilement.
          style={{ flex: 1, marginBottom: -16 }}
          contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
          // Défiler ferme le clavier : sur un petit écran c'est le geste
          // naturel pour voir plus de résultats.
          keyboardDismissMode="on-drag"
          // Sans ça, le premier tap sur un item ne servirait qu'à fermer le
          // clavier et il en faudrait un second pour le choisir.
          keyboardShouldPersistTaps="handled"
        >
          {noResult ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8 }}>
              <Popy mood="surpris" size={64} />
              <Text variant="title-3" accessibilityRole="header" style={{ flex: 1 }}>
                Aucun résultat trouvé
              </Text>
            </View>
          ) : (
            <Text variant="eyebrow" color="text-secondary" accessibilityRole="header">
              {sectionLabel}
            </Text>
          )}
          {error ? (
            // L'erreur dit ce qui se passe et quoi faire, avec son icône : jamais
            // la couleur seule (le guide).
            <View accessible style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
              <Icon name="warning-circle" size={18} color="text-danger" />
              <Text variant="footnote" weight={600} color="text-danger" style={{ flex: 1 }}>
                {userErrorMessage('search', error)}
              </Text>
            </View>
          ) : null}
          {showSuggestions && suggestionsPending ? (
            <ItemGridSkeleton />
          ) : displayed.length > 0 ? (
            <ItemGrid
              items={displayed}
              category={tint}
              onItemPress={(item) => void onChoose(item)}
            />
          ) : null}
          {canSubmitNew ? (
            <ProposeRow query={query.trim()} busy={submitting} onPress={() => void onSubmitNew()} />
          ) : null}
        </ScrollView>
      </Sheet>

      <Dialog
        visible={whyLossOpen}
        mood="gene"
        title={
          whyLoss?.verb === 'clear'
            ? `Vider la case « ${whyLoss.title} » ?`
            : `Remplacer « ${whyLoss?.title ?? ''} » ?`
        }
        message="Son pourquoi sera effacé."
        actions={[
          {
            label: whyLoss?.verb === 'clear' ? 'Vider' : 'Remplacer',
            variant: 'danger',
            onPress: () => answerWhyLoss(true),
          },
          { label: 'Annuler', onPress: () => answerWhyLoss(false) },
        ]}
        onCancel={() => answerWhyLoss(false)}
      />

      {/* Les toasts levés pendant que la feuille est ouverte, quand une écriture
          échoue : celui de la racine resterait caché sous la route sur iOS
          (chantier 31, D7). La feuille partie, la racine les reprend. */}
      {open ? <ToastHost scope="modal" /> : null}
    </View>
  );
}
