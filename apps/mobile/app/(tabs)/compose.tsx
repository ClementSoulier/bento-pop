import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect, useIsFocused, useNavigation } from 'expo-router';
import { TilePulse } from '@/components/bento/TilePulse';
import { BentoSelector } from '@/components/compose/BentoSelector';
import { useToast } from '@/components/primitives';
import {
  Bento,
  BentoSkeleton,
  Button,
  Confetti,
  Progress,
  Screen,
  StatusPill,
  Text,
  TopBar,
  composePlateScale,
  reachesWrapScale,
  useTheme,
} from '@/design';
import { errorFeedback, successFeedback } from '@/lib/haptics';
import { useBento } from '@/state/bento';
import { useOwnWhys } from '@/state/own-whys';
import { useSession } from '@/state/session';
import { usePushTarget } from '@/state/push-target';
import { editableBentoId, markPublishOnValidation, publishBento } from '@/lib/bento-actions';
import { followPushTarget } from '@/lib/push-navigation';
import {
  acceptReadyReminder,
  cancelReadyReminder,
  offerEditorialConsent,
  offerReadyReminder,
  onItemModeratedReceived,
  readyReminderOffered,
  reconcileReadyReminders,
  type ReminderTarget,
} from '@/lib/push-runtime';
import { REMINDER_LINK_LABEL, readyReminderKey, reminderWhenLabel } from '@/lib/ready-reminder';
import { bentoRoute } from '@/lib/bento-address';
import { type Edition, loadReleasedEditions } from '@/lib/editions';
import { bentoName } from '@/lib/own-bento';
import { composeCta } from '@/lib/compose-cta';
import { composerSlots } from '@/lib/compose-slots';
import {
  markNoLongerHolds,
  shouldMarkForValidation,
  validationHint,
} from '@/lib/publish-on-validation';
import { useOfflineInset } from '@/lib/use-offline-inset';

/**
 * Le temps que la recherche finisse de se fermer : les confettis tombent sur le
 * composer, pas derrière la feuille qui descend.
 */
const CELEBRATION_DELAY_MS = 350;

/**
 * Le composer, écran principal de l'app (chantier 32, `c01`, `c06`, `c07`, `c08`,
 * `c09`, `u05`) : l'en-tête, les segments ou l'état en ligne, les puces des bentos
 * et des éditions, le plateau, et le bouton, dont le libellé ET l'action viennent
 * de `lib/compose-cta.ts`. Les avoir calculés séparément avait laissé le bouton
 * actif et inerte pour tout bento partiel, soit 16 des 58 bentos en production le
 * 13 septembre 2026.
 *
 * Le plateau rend de la hauteur à ce qui l'entoure sur un écran court (D8) : tout
 * tient sans défiler tant que c'est possible.
 */
export default function ComposeTab() {
  const slots = useBento((s) => s.slots);
  // Chantier 16 : le bento qu'on édite, et tous ceux du compte.
  const own = useBento((s) => s.own);
  const current = useBento((s) => s.current);
  const hydrated = useBento((s) => s.hydrated);
  const lastFilled = useBento((s) => s.lastFilled);
  const publishedAt = useBento((s) => s.publishedAt);
  const setPublishedAt = useBento((s) => s.setPublishedAt);
  const pendingWrites = useBento((s) => s.pendingWrites);
  const profile = useSession((s) => s.profile);
  const pseudo = profile?.pseudo;
  const userId = useSession((s) => s.user?.id);
  const refreshProfile = useSession((s) => s.refreshProfile);
  const cases = useBento((s) => s.cases);
  const filledKeys = Object.keys(slots);
  const filled = filledKeys.length;
  // Bloqué tant qu'au moins un slot référence un item en attente de
  // modération. La règle est gardée côté UI uniquement pour l'instant
  // (le SQL strict `can_publish_bento` arrive plus tard, cf. spec §7.1).
  const hasPending = Object.values(slots).some((s) => s?.pending);
  const [publishing, setPublishing] = useState(false);
  const { width: screenWidth, fontScale } = useWindowDimensions();
  const { size } = useTheme();

  const showToast = useToast((s) => s.show);

  /**
   * Les éditions sorties, relues à chaque retour sur l'onglet **et** à chaque
   * retour de l'app au premier plan tant que l'onglet est affiché.
   *
   * Le second cas est la promesse du chantier : une édition programmée sort
   * sans relancer l'app. Il manquait, et la recette du 16 septembre l'a
   * montré au contrôle D : l'app ramenée au premier plan, même processus,
   * la pastille n'apparaissait qu'après un changement d'onglet.
   *
   * La RLS ne rend que les sorties : l'app n'a donc aucun filtre de date à
   * appliquer, et une édition programmée reste invisible même si quelqu'un
   * inspecte la requête. Une lecture qui échoue garde la liste connue : les
   * éditions sont un ajout, pas un prérequis, et un réseau qui se réveille
   * au retour de l'app ne doit pas faire disparaître les pastilles.
   */
  const [editions, setEditions] = useState<Edition[]>([]);
  useFocusEffect(
    useCallback(() => {
      let vivant = true;
      const charger = () => {
        void loadReleasedEditions()
          .then((liste) => { if (vivant) setEditions(liste); })
          .catch(() => {});
      };
      charger();
      const abonnement = AppState.addEventListener('change', (etat) => {
        if (etat === 'active') charger();
      });
      return () => {
        vivant = false;
        abonnement.remove();
      };
    }, []),
  );

  // Re-synchronise le bento depuis Supabase à chaque retour sur l'onglet.
  // Sans ça, un item validé (ou refusé) par l'équipe pendant que l'app est
  // ouverte garde sa pastille « en attente » jusqu'au prochain cold start :
  // le composer lit le store Zustand, jamais re-fetché en cours de session.
  // `refreshProfile` → `hydrateBentoFromRemote` relit `items.status` ; les
  // slots étant déjà persistés en base, re-hydrater ne perd aucune saisie.
  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
      // Au retour au premier plan aussi : l'équipe a pu modérer une case
      // pendant que l'app dormait, et, chantier 18, un bento marqué peut
      // sortir à la validation de son dernier item, le bouton disant alors
      // « Voir mon bento public ». Jusqu'au lot 5b du 17, seul ce second cas
      // relisait : une case validée restait « en attente » sous la
      // notification qui la disait en ligne, jusqu'au prochain démarrage.
      const abonnement = AppState.addEventListener('change', (etat) => {
        if (etat === 'active') void refreshProfile();
      });
      // Et dès qu'une notification de modération arrive, app ouverte.
      const desabonner = onItemModeratedReceived(() => void refreshProfile());
      return () => {
        abonnement.remove();
        desabonner();
      };
    }, [refreshProfile]),
  );

  // Chantier 12 (D7) : les pourquoi du bento composé, pour que remplacer ou
  // vider une case expliquée le demande d'abord. Lus à chaque retour, comme
  // le bento ; rien sans profil, le brouillon n'en ayant aucun.
  const currentId = current?.id ?? null;
  const withProfile = useSession((s) => s.profile != null);
  useFocusEffect(
    useCallback(() => {
      if (currentId && withProfile) void useOwnWhys.getState().load(currentId);
    }, [currentId, withProfile]),
  );

  // Chantier 17, lot 4 : le tap d'une notification, suivi une fois le bento
  // lu et l'écran affiché, au démarrage comme app ouverte. Pas avant d'être à
  // l'écran : l'onglet reste monté quand on en change, et suivre la cible
  // depuis un onglet caché ouvrirait la recherche par-dessus un autre.
  // `take` l'oublie aussitôt : un tap ne se suit qu'une fois. Les cases sont
  // relues d'abord, lot 5b : composer déjà à l'écran, rien d'autre ne les
  // relisait, et la case tapée gardait son ancien état.
  const focused = useIsFocused();
  const pushTarget = usePushTarget((s) => s.target);
  useEffect(() => {
    if (!pushTarget || !hydrated || !focused) return;
    const target = usePushTarget.getState().take();
    if (target) {
      void refreshProfile()
        .then(() => followPushTarget(target))
        .catch((e) => console.warn('[push] tap', e));
    }
  }, [pushTarget, hydrated, focused, refreshProfile]);

  // Libellé, action et état désactivé viennent d'une seule décision, testée
  // dans `lib/compose-cta.ts`. Les avoir calculés séparément avait produit un
  // bouton actif qui ne faisait rien : cf. le commentaire de ce fichier.
  const cta = composeCta({
    cases,
    // Un bento d'édition porte des questions, pas des noms communs.
    nomsCommuns: current?.editionId == null,
    filled: filledKeys,
    hasPending,
    publishing,
    published: publishedAt !== null,
    hasProfile: profile != null,
    awaitingValidation: current?.publishOnValidationAt != null,
  });

  // Chantier 18 : la base ne publie à la validation qu'un bento que l'app a
  // marqué (D5). La marque se pose dès que ce que la base sait le permet, et
  // la base revérifie tout ; elle s'oublie ici dès qu'elle ne tient plus, la
  // base l'ayant levée de son côté (D2).
  const bentoCourant = current?.id;
  const marque = current?.publishOnValidationAt != null;
  const complet = filled === cases.length;
  const aMarquer =
    bentoCourant != null &&
    shouldMarkForValidation({
      hasProfile: profile != null,
      hydrated,
      pendingWrites,
      published: publishedAt !== null,
      marked: marque,
      complete: complet,
      hasPending,
    });
  const aOublier = markNoLongerHolds({
    marked: marque,
    published: publishedAt !== null,
    complete: complet,
    hasPending,
  });
  useEffect(() => {
    if (!bentoCourant) return;
    if (aOublier) {
      useBento.getState().setPublishOnValidation(bentoCourant, null);
      return;
    }
    if (!aMarquer) return;
    void markPublishOnValidation(bentoCourant)
      .then((ok) => {
        if (ok) useBento.getState().setPublishOnValidation(bentoCourant, new Date().toISOString());
      })
      .catch((e) => console.warn('[compose] marque de publication', e));
  }, [bentoCourant, aMarquer, aOublier]);
  const enAttente = Object.values(slots).flatMap((slot) => (slot?.pending ? [slot.title] : []));

  // Chantier 8 : le rappel d'un bento prêt, complet, tout validé, jamais
  // publié (D1). La décision est dans `lib/ready-reminder.ts`, testée.
  const readyKey = readyReminderKey({
    cta: cta.kind,
    hydrated,
    hasProfile: profile != null,
    current: current ? { id: current.id, firstPublishedAt: current.firstPublishedAt } : null,
  });
  const reminderTarget: ReminderTarget | null = readyKey
    ? {
        key: readyKey,
        // Le brouillon, sans profil, n'a pas de nom à porter.
        bento: profile && current ? { isPrimary: current.isPrimary, name: bentoName(current) } : null,
      }
    : null;
  // Lu au moment du départ, que les écouteurs ci-dessous voient après coup.
  const reminderRef = useRef(reminderTarget);
  reminderRef.current = reminderTarget;

  // Le lien « Me le rappeler demain » (D10) : seulement pour un bento prêt,
  // pas encore répondu, et un système qui peut encore demander. Relu à chaque
  // retour sur l'onglet, l'autorisation ayant pu changer entre-temps.
  const [reminderOffered, setReminderOffered] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let vivant = true;
      void readyReminderOffered(readyKey).then((offert) => {
        if (vivant) setReminderOffered(offert);
      });
      return () => {
        vivant = false;
      };
    }, [readyKey]),
  );

  // Les rappels qui n'ont plus lieu d'être s'annulent : le bento publié, une
  // case vidée, un item remplacé par une proposition, le bento supprimé. La
  // signature résume ce qui compte de la liste, qui change d'identité à chaque
  // lecture sans que rien n'ait bougé ; l'effet relit la liste elle-même.
  const hasProfile = profile != null;
  const editedId = current?.id ?? null;
  const ownSignature = own
    .map((b) => `${b.id}:${b.publishedAt ?? ''}:${b.firstPublishedAt ?? ''}`)
    .join('|');
  useEffect(() => {
    if (!hydrated) return;
    void reconcileReadyReminders({
      hasProfile,
      ownKnown: hasProfile,
      own: useBento.getState().own,
      editedKey: hasProfile ? editedId : null,
      readyKey,
    });
  }, [hydrated, hasProfile, editedId, readyKey, ownSignature]);

  // Première porte : on quitte le composer pour un autre onglet, bento prêt.
  // `blur` part aussi quand une modale s'ouvre par-dessus le composer : seul
  // un onglet affiché qui n'est plus le composer dit qu'on est parti.
  const navigation = useNavigation();
  useEffect(
    () =>
      navigation.addListener('blur', () => {
        const state = navigation.getState();
        const shown = state ? state.routes[state.index ?? 0]?.name : undefined;
        const target = reminderRef.current;
        if (shown && shown !== 'compose' && target) {
          void offerReadyReminder(target, () => setReminderOffered(false));
        }
      }),
    [navigation],
  );

  // Deuxième porte : on revient de l'écran du pseudo sans avoir publié.
  const publishFlowStarted = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!publishFlowStarted.current) return;
      publishFlowStarted.current = false;
      const target = reminderRef.current;
      if (target) void offerReadyReminder(target, () => setReminderOffered(false));
    }, []),
  );

  // Troisième porte, le lien : il vaut accord, sans question de plus.
  const onRemindMe = async () => {
    if (!reminderTarget) return;
    setReminderOffered(false);
    const date = await acceptReadyReminder(reminderTarget);
    showToast(
      date
        ? `On te le rappelle ${reminderWhenLabel(new Date(), date)}.`
        : 'Sans les notifications, le rappel ne peut pas arriver.',
      // La cloche de la maquette `c08` (chantier 31).
      { variant: date ? 'success' : 'neutral', icon: date ? 'bell-ringing' : undefined, durationMs: 3500 },
    );
  };

  // Le tap d'un rappel fait pulser le bouton (D11). `null` au départ : rien
  // ne pulse tant qu'aucun rappel n'a été tapé.
  const publishSpotlight = usePushTarget((s) => s.publishSpotlight);

  // L'adresse publique du bento qu'on édite, et non celle du compte. Les deux
  // se confondaient tant qu'un compte n'avait qu'un bento : à la recette du
  // 16 septembre, publier « Le duel du samedi » ouvrait le bento principal.
  const adressePublique = pseudo ? bentoRoute(pseudo, current?.slug, current?.isPrimary) : null;

  const onPrimary = () => {
    if (cta.kind === 'open-slot') {
      router.push({ pathname: '/search-modal', params: { category: cta.caseKey } });
      return;
    }
    // Sans profil, « Publier dès la validation » passe par le pseudo, comme
    // « Publier » : c'est `onPublish` qui y mène (chantier 18, D3).
    if (cta.kind === 'publish' || cta.kind === 'publish-on-validation') void onPublish();
    if (cta.kind === 'view-public' && adressePublique) router.push(adressePublique);
  };

  // Appelée seulement quand `composeCta` a rendu 'publish', donc sur un bento
  // complet et sans case en modération : ces deux conditions ne sont plus
  // revérifiées ici, il n'y a qu'un endroit qui décide. Reste la session, que
  // le CTA ne connaît pas.
  const onPublish = async () => {
    if (!userId) return;

    // Pas encore de profil : c'est ici que le pseudo se demande, et pas trois
    // écrans avant d'avoir vu une case. L'écran suivant crée profil, bento,
    // cases et publication d'un seul geste. Chantier 9.
    if (!profile) {
      // Chantier 8 : revenir de cet écran sans avoir publié propose le rappel.
      publishFlowStarted.current = true;
      router.push('/onboarding/pseudo');
      return;
    }

    setPublishing(true);
    try {
      const bentoId = await editableBentoId(userId);
      if (!bentoId) return;
      await publishBento(bentoId);
      // Sans ça le CTA resterait « Publier mon bento » jusqu'à la prochaine
      // hydratation, et l'app continuerait d'ignorer qu'elle vient de rendre
      // ce bento public.
      setPublishedAt(new Date().toISOString());
      // Chantier 8 : publié, le rappel tombe.
      void cancelReadyReminder(bentoId);
      if (adressePublique) router.push(adressePublique);
      // Feedback de succès — montré APRÈS le push pour que le toast
      // s'affiche sur la page publique (où l'utilisateur peut partager).
      showToast('Bento publié ! Partage-le 🍱', {
        variant: 'success',
        durationMs: 3500,
      });
      // Le premier des deux moments de l'accord éditorial (D20) : on est
      // désormais dans le fil, l'édition de jeudi a un sens.
      void offerEditorialConsent();
    } catch (e) {
      errorFeedback();
      console.warn('[compose] publication', e);
      showToast("La publication n'a pas marché. Réessaie.", {
        variant: 'danger',
        durationMs: 5000,
      });
    } finally {
      setPublishing(false);
    }
  };

  // Le bandeau hors ligne descend l'écran, jusqu'à ce que le 33 le refasse.
  const offlineInset = useOfflineInset();

  /**
   * Les éditions sorties que ce compte peut composer, **calculées une fois**.
   *
   * Vide sans profil. La recette du 16 septembre l'a montré : le sélecteur
   * proposait les éditions à une session sans profil, et un tap ne pouvait
   * que renvoyer « Publie d'abord ton bento », puisque `create_edition_bento`
   * exige un profil. On ne propose pas une action vouée à l'échec.
   */
  const editionsAComposer = profile
    ? editions.filter((e) => !own.some((b) => b.editionId === e.id))
    : [];

  // La célébration d'un bento complet (D13), demandée par la recherche : une fois,
  // à l'écran. Le jeton de départ n'en est pas une : revenir sur l'onglet ne
  // rejoue rien.
  const celebration = useBento((s) => s.celebration);
  const celebrated = useRef(celebration);
  const [rain, setRain] = useState(0);
  useEffect(() => {
    if (!focused || celebration === celebrated.current) return;
    celebrated.current = celebration;
    const timer = setTimeout(() => {
      setRain(celebration);
      successFeedback();
    }, CELEBRATION_DELAY_MS);
    return () => clearTimeout(timer);
  }, [focused, celebration]);

  // Ce que le plateau peut garder (D8) : la place de l'écran, moins tout le reste,
  // tel qu'il se mesure. À 130 % de texte et au-delà, les cases gardent leur
  // hauteur, et l'écran défile.
  const [viewport, setViewport] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [plateHeight, setPlateHeight] = useState(0);
  const heightScale =
    reachesWrapScale(fontScale) || viewport <= 0 || plateHeight <= 0
      ? 1
      : composePlateScale({
          room: viewport - (contentHeight - plateHeight),
          count: cases.length,
          plateWidth: screenWidth - 2 * size['screen-margin'],
        });

  const nomDuBento = current ? bentoName(current) : 'Mon bento';

  return (
    <Screen>
      {offlineInset > 0 ? <View style={{ height: offlineInset }} /> : null}
      {/* L'écran défile quand le plateau a rendu ce qu'il pouvait et que le reste ne
          tient plus : à la plus grande police, et sur un petit téléphone. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
        contentInsetAdjustmentBehavior="never"
        onLayout={(e) => setViewport(e.nativeEvent.layout.height)}
        onContentSizeChange={(_, height) => setContentHeight(height)}
      >
        {/* Le nom du bento courant : « Mon bento » pour le principal, le titre de
            son édition pour une édition, cf. `bentoName`. Sans pseudo, pas de
            sur-titre : une adresse en pointillés promettrait ce qui n'existe pas. */}
        <TopBar variant="large" eyebrow={pseudo ? `@${pseudo}` : undefined} title={nomDuBento} />
        <View style={{ paddingHorizontal: size['screen-margin'], paddingBottom: 12, gap: 14 }}>
          {/* Tant que la première lecture n'a pas répondu, la ligne garde sa place
              mais ne dit rien : « 0 / 6 » affirmerait un bento vide au moment précis
              où le squelette dit qu'on ne sait pas encore. */}
          <View
            accessibilityElementsHidden={!hydrated}
            importantForAccessibility={hydrated ? 'auto' : 'no-hide-descendants'}
            style={{ opacity: hydrated ? 1 : 0 }}
          >
            {cta.kind === 'view-public' ? (
              <ComposeStatus
                label="En ligne"
                hint="tes modifications sont visibles tout de suite"
                tone="live"
              />
            ) : cta.kind === 'awaiting-validation' ? (
              // Chantier 18 : le pendant d'« En ligne ». Le bento sortira tout seul à
              // la validation, et on le dit (promesse du 5).
              <ComposeStatus
                label="Bientôt en ligne"
                hint={validationHint(enAttente)}
                tone="pending"
                accessibilityLabel={`Bientôt en ligne : ton bento sortira ${validationHint(enAttente)}`}
              />
            ) : (
              <Progress value={filled} total={cases.length} />
            )}
          </View>

          <BentoSelector own={own} currentId={current?.id ?? null} editions={editionsAComposer} />

          <View onLayout={(e) => setPlateHeight(e.nativeEvent.layout.height)}>
            {/* Tant que la première lecture n'a pas répondu, un squelette : un bento
                vide annoncerait à tort que rien n'a été composé. */}
            {hydrated ? (
              <Bento
                slots={composerSlots(cases, slots)}
                dropped={lastFilled}
                heightScale={heightScale}
                onSlotPress={(caseKey) =>
                  router.push({ pathname: '/search-modal', params: { category: caseKey } })
                }
              />
            ) : (
              <BentoSkeleton count={cases.length} />
            )}
          </View>

          <TilePulse trigger={publishSpotlight > 0 ? publishSpotlight : null}>
            <Button
              block
              label={hydrated ? cta.label : 'Chargement…'}
              disabled={cta.disabled || !hydrated}
              loading={cta.kind === 'busy'}
              onPress={onPrimary}
            />
          </TilePulse>

          {/* Chantier 8, D10 : pour un départ que rien n'intercepte, l'app passée en
              arrière-plan. */}
          {readyKey && reminderOffered ? (
            <Button
              variant="tertiary"
              size="md"
              label={REMINDER_LINK_LABEL}
              accessibilityHint="Une notification demain à 18 h, si ton bento n'est pas publié."
              onPress={() => void onRemindMe()}
              style={{ alignSelf: 'center', marginTop: -8 }}
            />
          ) : null}
        </View>
      </ScrollView>
      {rain > 0 ? <Confetti key={rain} onDone={() => setRain(0)} /> : null}
    </Screen>
  );
}

/** L'état d'un bento en ligne, ou qui le sera : la pastille, et sa phrase. */
function ComposeStatus({
  label,
  hint,
  tone,
  accessibilityLabel,
}: {
  label: string;
  hint: string;
  tone: 'live' | 'pending';
  accessibilityLabel?: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? `${label} : ${hint}`}
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: -6 }}
    >
      <StatusPill label={label} tone={tone} />
      <Text variant="footnote" color="text-secondary" style={{ flexShrink: 1 }}>
        {hint}
      </Text>
    </View>
  );
}
