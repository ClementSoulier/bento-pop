import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { router, useFocusEffect } from 'expo-router';
import logo from '@bento-pop/brand/assets/logo/bento-pop.png';
import { BentoGrid } from '@/components/bento';
import { BentoBoxSkeleton } from '@/components/bento/BentoBoxSkeleton';
import { ProgressBar } from '@/components/bento/ProgressBar';
import { INK_MUTED, SHADOWS, StampButton, YellowBg, useToast } from '@/components/primitives';
import { failureFeedback } from '@/lib/haptics';
import { useBento } from '@/state/bento';
import { useSession } from '@/state/session';
import { editableBentoId, publishBento, switchBento } from '@/lib/bento-actions';
import type { OwnBento } from '@/lib/own-bento';
import {
  CTA_GAP_MIN,
  PSEUDO_LINE_H,
  STATUS_LINE_H,
  SELECTOR_CHIP_H,
  SELECTOR_GAP,
  TITLE_LINE_H,
  composeBentoScale,
} from '@/components/bento/compose-layout';
import {
  CONTROL_MAX_FONT_MULTIPLIER,
  TITLE_MAX_FONT_MULTIPLIER,
  fontScaleFor,
  naturalLineHeight,
  scaledType,
} from '@/components/bento/font-scaling';
import { composeCta } from '@/lib/compose-cta';
import { useOfflineInset } from '@/lib/use-offline-inset';
import type { CategoryKey } from '@/supabase/types';

/**
 * Marge de chaque côté de la grille. Elle en fixe la largeur, que les titres
 * des cases mesurent : cf. `BentoGrid.width`.
 */
const GRID_SIDE_PADDING = 16;

/**
 * Composer — écran principal de l'app.
 *
 * Top bar (logo) + en-tête pseudo + titre + progress bar X/6 + grille
 * bento (taps → modal de recherche pour la catégorie cliquée) + CTA bas
 * dont le libellé ET l'action viennent de `lib/compose-cta.ts`. Les avoir
 * calculés séparément avait laissé le bouton actif et inerte pour tout bento
 * partiel, soit 16 des 58 bentos en production le 13 septembre 2026.
 *
 * Le bento se rescale dynamiquement pour que tout tienne sur l'écran sans
 * scroller — quelle que soit la taille du device (SE → 15 Pro Max).
 *
 * Cf. design Claude Design — `ComposerScreen` dans `screens.jsx`.
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
  const profile = useSession((s) => s.profile);
  const pseudo = profile?.pseudo;
  const userId = useSession((s) => s.user?.id);
  const refreshProfile = useSession((s) => s.refreshProfile);
  const filledCategories = Object.keys(slots) as CategoryKey[];
  const filled = filledCategories.length;
  // Bloqué tant qu'au moins un slot référence un item en attente de
  // modération. La règle est gardée côté UI uniquement pour l'instant
  // (le SQL strict `can_publish_bento` arrive plus tard, cf. spec §7.1).
  const hasPending = Object.values(slots).some((s) => s?.pending);
  const [publishing, setPublishing] = useState(false);
  const tabBarHeight = useBottomTabBarHeight();
  const { width: screenWidth, height: screenHeight, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const showToast = useToast((s) => s.show);

  // Re-synchronise le bento depuis Supabase à chaque retour sur l'onglet.
  // Sans ça, un item validé (ou refusé) par l'équipe pendant que l'app est
  // ouverte garde son badge « En attente » jusqu'au prochain cold start :
  // le composer lit le store Zustand, jamais re-fetché en cours de session.
  // `refreshProfile` → `hydrateBentoFromRemote` relit `items.status` ; les
  // slots étant déjà persistés en base, re-hydrater ne perd aucune saisie.
  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
    }, [refreshProfile]),
  );

  // Libellé, action et état désactivé viennent d'une seule décision, testée
  // dans `lib/compose-cta.ts`. Les avoir calculés séparément avait produit un
  // bouton actif qui ne faisait rien : cf. le commentaire de ce fichier.
  const cta = composeCta({
    filled: filledCategories,
    hasPending,
    publishing,
    published: publishedAt !== null,
  });

  const onPrimary = () => {
    if (cta.kind === 'open-slot') {
      router.push({ pathname: '/search-modal', params: { category: cta.category } });
      return;
    }
    if (cta.kind === 'publish') void onPublish();
    if (cta.kind === 'view-public') router.push(`/u/${pseudo}` as const);
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
      router.push(`/u/${pseudo}` as const);
      // Feedback de succès — montré APRÈS le push pour que le toast
      // s'affiche sur la page publique (où l'utilisateur peut partager).
      showToast('Bento publié ! Partage-le 🍱', {
        variant: 'success',
        durationMs: 3500,
      });
    } catch (e) {
      failureFeedback();
      console.warn('[compose] publication', e);
      showToast("La publication n'a pas marché. Réessaie.", {
        variant: 'danger',
        durationMs: 5000,
      });
    } finally {
      setPublishing(false);
    }
  };

  // Le budget vertical vit dans `compose-layout.ts`, testé : il s'était
  // trompé sans que rien ne le signale, au point que la boîte et le bouton
  // se touchaient.
  // Le bandeau hors ligne descend l'écran : le budget le compte, sinon la boîte
  // passerait sous la barre d'onglets dès qu'il apparaît.
  const offlineInset = useOfflineInset();
  const bentoScale = composeBentoScale({
    // La bande de sélection prend de la place au-dessus de la grille : le
    // modèle la compte, sans quoi la boîte passerait sous le bouton.
    bentoCount: own.length,
    screenHeight,
    insetTop: insets.top + offlineInset,
    tabBarHeight,
    fontScale,
  });

  // Les textes de l'en-tête appliquent eux-mêmes la police système, plafonnée,
  // hauteurs de ligne comprises : ce sont celles que le budget compte.
  const pseudoType = scaledType(fontScale, CONTROL_MAX_FONT_MULTIPLIER, 10, PSEUDO_LINE_H);
  const titleType = scaledType(fontScale, TITLE_MAX_FONT_MULTIPLIER, 28, TITLE_LINE_H);
  const statusType = scaledType(fontScale, CONTROL_MAX_FONT_MULTIPLIER, 11, STATUS_LINE_H);
  const onlineType = scaledType(
    fontScale,
    CONTROL_MAX_FONT_MULTIPLIER,
    9,
    naturalLineHeight('Bungee', 9),
  );
  const onlineHintType = scaledType(
    fontScale,
    CONTROL_MAX_FONT_MULTIPLIER,
    12,
    naturalLineHeight('Fredoka', 12),
  );

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* L'écran défile quand la grille est à son plancher et que le reste ne
            tient plus : à la plus grande police, et sur un petit téléphone. Tant
            que tout tient, `flexGrow` garde la mise en page d'avant, le ressort
            poussant le bouton en bas. */}
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical={false}
          contentInsetAdjustmentBehavior="never"
        >
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
              allowFontScaling={false}
              numberOfLines={1}
              style={{
                fontFamily: 'Bungee',
                ...pseudoType,
                letterSpacing: 2,
                color: INK_MUTED,
                textTransform: 'uppercase',
                includeFontPadding: false,
              }}
            >
              {/* Sans pseudo, la ligne garde sa hauteur mais ne dit rien.
                  « @… » ne durait qu'un aller-retour avant le chantier 9 ;
                  depuis, on compose sans pseudo aussi longtemps qu'on veut,
                  et afficher une adresse en pointillés tout ce temps promet
                  quelque chose qui n'existe pas. */}
              {pseudo ? `@${pseudo}` : ' '}
            </Text>
            <Text
              accessibilityRole="header"
              allowFontScaling={false}
              numberOfLines={1}
              style={{
                fontFamily: 'Extenda',
                ...titleType,
                letterSpacing: -0.3,
                color: '#0a0a0a',
                textTransform: 'uppercase',
              }}
            >
              {/* Le nom du bento courant. « Mon bento » reste le titre du
                  principal, donc l'écran ne change pas tant qu'un compte n'en
                  a qu'un. Chantier 16. */}
              {current && !current.isPrimary ? current.slug : 'Mon bento'}
            </Text>
            {/* Une seule ligne, deux contenus possibles, la même hauteur : le
                budget vertical de `compose-layout.ts` est mesuré au point et
                ajouter un bloc ferait rétrécir la boîte pour tout le monde.
                Sur un bento en ligne, « 6 / 6 » n'apprend plus rien, alors que
                le fait que les modifications partent en direct, si. */}
            {/* Tant que la première lecture n'a pas répondu, la ligne garde sa
                hauteur mais ne dit rien : « 0 / 6 » affirmerait un bento vide au
                moment précis où le squelette dit qu'on ne sait pas encore.
                Invisible à l'œil et muette au lecteur d'écran, que l'opacité
                seule ne suffirait pas à faire taire. */}
            <View
              accessibilityElementsHidden={!hydrated}
              importantForAccessibility={hydrated ? 'auto' : 'no-hide-descendants'}
              style={{ opacity: hydrated ? 1 : 0 }}
            >
              {cta.kind === 'view-public' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <View
                    style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#0a0a0a' }}
                  />
                  <Text
                    allowFontScaling={false}
                    style={{
                      fontFamily: 'Bungee',
                      ...onlineType,
                      letterSpacing: 1,
                      includeFontPadding: false,
                    }}
                    numberOfLines={1}
                  >
                    En ligne
                  </Text>
                  <Text
                    allowFontScaling={false}
                    style={{
                      fontFamily: 'Fredoka',
                      ...onlineHintType,
                      opacity: 0.7,
                      flexShrink: 1,
                      includeFontPadding: false,
                    }}
                    numberOfLines={1}
                  >
                    tes modifications sont visibles tout de suite
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <ProgressBar filled={filled} total={6} />
                  <Text
                    allowFontScaling={false}
                    style={{
                      fontFamily: 'Bungee',
                      ...statusType,
                      letterSpacing: 1,
                      includeFontPadding: false,
                    }}
                  >
                    {filled} / 6
                  </Text>
                </View>
              )}
            </View>
          </View>

          <BentoSelector own={own} currentId={current?.id ?? null} />

          {/* Grille bento — scale dynamique pour fit l'écran. Tant que la première
              lecture du bento n'a pas répondu, un squelette : un bento vide
              annoncerait à tort que rien n'a été composé. */}
          <View style={{ paddingHorizontal: GRID_SIDE_PADDING }}>
            {hydrated ? (
              <BentoGrid
                items={slots}
                scale={bentoScale}
                // Toute la largeur de l'écran, et non `GRID_WIDTH × bentoScale` :
                // l'échelle se calcule ici sur la hauteur.
                width={screenWidth - GRID_SIDE_PADDING * 2}
                pulse={lastFilled}
                onTap={(cat) =>
                  router.push({ pathname: '/search-modal', params: { category: cat } })
                }
              />
            ) : (
              <BentoBoxSkeleton scale={bentoScale} />
            )}
          </View>

          {/* Spacer flex pour pousser le CTA en bas */}
          <View style={{ flex: 1 }} />

          {/* CTA en flux normal, juste au-dessus du tab bar.
              `paddingBottom` ne compte plus `tabBarHeight` : la zone de contenu
              de l'écran exclut déjà la barre d'onglets, donc l'ajouter la
              comptait deux fois. Mesuré sur une capture iPhone 17, bento
              plein : 93 pt de jaune mort sous le bouton, et **zéro** entre le
              bouton et la boîte, qui se touchaient.
              `marginTop` plutôt qu'un `paddingTop` : c'est un écart minimal
              garanti même quand le ressort du dessus se réduit à rien. Minimal
              et non visé : cf. `CTA_GAP_MIN`. */}
          <View
            style={{
              paddingHorizontal: 16,
              marginTop: CTA_GAP_MIN,
              paddingBottom: 12,
            }}
          >
            <StampButton wide disabled={cta.disabled || !hydrated} onPress={onPrimary}>
              {hydrated ? cta.label : 'Chargement…'}
            </StampButton>
          </View>
        </ScrollView>
      </SafeAreaView>
    </YellowBg>
  );
}

/**
 * Le sélecteur de bento, sous l'en-tête du composer.
 *
 * Ne rend rien tant qu'un compte n'a qu'un bento, ce qui est le cas de tous
 * au 16 septembre 2026 : le composer ne change donc pas d'aspect, et
 * `composeSelectorHeight` rend zéro dans ce cas. C'est la promesse du §5.4.
 *
 * Au-dessus de la grille et non dessous, pour la raison mesurée sur la page
 * publique : le budget vertical du composer est calculé au point, et tout ce
 * qui suit la boîte tombe derrière le bloc du bouton.
 */
function BentoSelector({ own, currentId }: { own: OwnBento[]; currentId: string | null }) {
  const { fontScale } = useWindowDimensions();
  const scale = fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER);
  if (own.length <= 1) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
      style={{ marginBottom: SELECTOR_GAP, flexGrow: 0 }}
    >
      {own.map((bento) => {
        const actif = bento.id === currentId;
        return (
          <Pressable
            key={bento.id}
            onPress={() => {
              if (actif) return;
              void switchBento(bento.id);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: actif }}
            accessibilityLabel={
              bento.isPrimary ? 'Éditer mon bento' : `Éditer le bento ${bento.slug}`
            }
            style={[
              {
                height: SELECTOR_CHIP_H * scale,
                justifyContent: 'center',
                paddingHorizontal: 14,
                borderRadius: 999,
                borderWidth: 2.5,
                borderColor: '#0a0a0a',
                backgroundColor: actif ? '#0a0a0a' : '#fbf3de',
              },
              actif ? null : SHADOWS.stamp,
            ]}
          >
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={{
                fontFamily: 'Bungee',
                fontSize: 11 * scale,
                lineHeight: 15 * scale,
                letterSpacing: 0.5,
                color: actif ? '#fbbf24' : '#0a0a0a',
              }}
            >
              {bento.isPrimary ? 'Mon bento' : bento.slug}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
