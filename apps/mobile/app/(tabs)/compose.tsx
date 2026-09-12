import { useCallback, useState } from 'react';
import { Image, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { router, useFocusEffect } from 'expo-router';
import logo from '@bento-pop/brand/assets/logo/bento-pop.png';
import { BentoGrid } from '@/components/bento';
import { ProgressBar } from '@/components/bento/ProgressBar';
import { StampButton, useToast, YellowBg } from '@/components/primitives';
import { failureFeedback } from '@/lib/haptics';
import { useBento } from '@/state/bento';
import { useSession } from '@/state/session';
import { ensureBento, publishBento } from '@/lib/bento-actions';
import { CTA_GAP, composeBentoScale } from '@/components/bento/compose-layout';


/**
 * Composer — écran principal de l'app.
 *
 * Top bar (logo) + en-tête pseudo + titre + progress bar X/6 + grille
 * bento (taps → modal de recherche pour la catégorie cliquée) + CTA bas
 * dont le label dépend de l'état (« Compléter (n) » ou « Publier mon bento »).
 *
 * Le bento se rescale dynamiquement pour que tout tienne sur l'écran sans
 * scroller — quelle que soit la taille du device (SE → 15 Pro Max).
 *
 * Cf. design Claude Design — `ComposerScreen` dans `screens.jsx`.
 */
export default function ComposeTab() {
  const slots = useBento((s) => s.slots);
  const lastFilled = useBento((s) => s.lastFilled);
  const pseudo = useSession((s) => s.profile?.pseudo);
  const userId = useSession((s) => s.user?.id);
  const refreshProfile = useSession((s) => s.refreshProfile);
  const filled = Object.keys(slots).length;
  const allFilled = filled === 6;
  // Bloqué tant qu'au moins un slot référence un item en attente de
  // modération. La règle est gardée côté UI uniquement pour l'instant
  // (le SQL strict `can_publish_bento` arrive plus tard, cf. spec §7.1).
  const hasPending = Object.values(slots).some((s) => s?.pending);
  const [publishing, setPublishing] = useState(false);
  const tabBarHeight = useBottomTabBarHeight();
  const { height: screenHeight } = useWindowDimensions();
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

  /**
   * Action du bouton principal.
   *
   * Sur un bento vide il n'a rien à publier, mais le griser accueillait un
   * nouvel utilisateur par un gros bouton mort au centre de l'écran. Il
   * ouvre donc la première case, ce qui est exactement ce qu'il faut faire
   * à ce moment-là.
   */
  const onPrimary = () => {
    if (filled === 0) {
      router.push({ pathname: '/search-modal', params: { category: 'film' } });
      return;
    }
    void onPublish();
  };

  const onPublish = async () => {
    if (!userId || !allFilled) return;
    if (hasPending) {
      showToast(
        'Une case attend encore la validation de l\'équipe.',
        { variant: 'neutral', durationMs: 4000 },
      );
      return;
    }
    setPublishing(true);
    try {
      const bentoId = await ensureBento(userId);
      await publishBento(bentoId);
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
  const bentoScale = composeBentoScale({
    screenHeight,
    insetTop: insets.top,
    tabBarHeight,
  });

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
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
            <ProgressBar filled={filled} total={6} />
            <Text style={{ fontFamily: 'Bungee', fontSize: 11, letterSpacing: 1 }}>
              {filled} / 6
            </Text>
          </View>
        </View>

        {/* Grille bento — scale dynamique pour fit l'écran */}
        <View style={{ paddingHorizontal: 16 }}>
          <BentoGrid
            items={slots}
            scale={bentoScale}
            pulse={lastFilled}
            onTap={(cat) =>
              router.push({ pathname: '/search-modal', params: { category: cat } })
            }
          />
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
            garanti même quand le ressort du dessus se réduit à rien. */}
        <View
          style={{
            paddingHorizontal: 16,
            marginTop: CTA_GAP,
            paddingBottom: 12,
          }}
        >
          <StampButton
            wide
            disabled={publishing || (allFilled && hasPending)}
            onPress={onPrimary}
          >
            {publishing
              ? 'Publication…'
              : filled === 0
              ? 'Commence par ton film'
              : allFilled
              ? hasPending
                ? 'En attente de validation'
                : 'Publier mon bento'
              : `Compléter (${6 - filled} restant${6 - filled > 1 ? 's' : ''})`}
          </StampButton>
        </View>
      </SafeAreaView>
    </YellowBg>
  );
}
