import '../src/styles/global.css';
import { startDraft } from '@/state/draft-mirror';
import { Stack, router, usePathname, useRootNavigationState } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { queryClient } from '@/lib/query-client';
import { FONTS } from '@/lib/fonts';
import { useSession } from '@/state/session';
import { useDraft } from '@/state/draft';
import { usePushTarget } from '@/state/push-target';
import { useBlocked } from '@/state/blocked';
import { useAppStatus } from '@/state/app-status';
import { Splash } from '@/components/Splash';
import { OfflineBanner } from '@/components/OfflineBanner';
import { UpdateBanner } from '@/components/UpdateBanner';
import { ForceUpdateScreen, MaintenanceScreen } from '@/components/AppBlocker';
import { ToastHost } from '@/components/primitives';
import { runStartupUpdateWithExpo } from '@/lib/ota-runtime';
import type { OtaPhase } from '@/lib/ota';
import { startPushRegistration, startPushResponses } from '@/lib/push-runtime';

/**
 * Root layout : charge les polices, démarre la session anonyme, monte les
 * providers (React Query, gesture handler, safe area), puis délègue au Stack.
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts(FONTS);
  const init = useSession((s) => s.init);
  const initialized = useSession((s) => s.initialized);
  const setInitialized = useSession((s) => s.setInitialized);

  const appStatus = useAppStatus((s) => s.status);
  const appStatusLoading = useAppStatus((s) => s.loading);
  const appStatusConfig = useAppStatus((s) => s.config);
  const initAppStatus = useAppStatus((s) => s.init);
  const stopAppStatusLoading = useAppStatus((s) => s.stopLoading);

  // Phase de mise à jour à distance. On démarre en 'checking' plutôt qu'en
  // 'done' : sinon le premier rendu passerait le splash avant que l'effet
  // n'ait démarré, et l'app clignoterait juste avant un rechargement.
  const [otaPhase, setOtaPhase] = useState<OtaPhase | 'done'>('checking');

  // Chantier 9 : le brouillon d'avant compte, dans les deux sens.
  useEffect(() => startDraft(), []);

  useEffect(() => {
    init()
      .catch((err) => {
        // Safety net : init() pose déjà initialized=true dans son finally,
        // mais on garde un fallback ici au cas où une erreur synchrone
        // remonterait avant l'entrée dans le try.
        console.error('[session.init] failed', err);
        setInitialized(true);
      })
      // Chantier 17 : une fois la session posée, l'appareil se réenregistre,
      // à chaque ouverture et à chaque retour au premier plan. Sans jamais
      // rien demander, et sans rien bloquer.
      .finally(() => startPushRegistration());
    // Charge le verdict app-config (maintenance / force update) en parallèle
    // de session.init. Le store gère lui-même son timeout / fail-open et
    // attache un listener AppState pour refetch sur retour foreground.
    initAppStatus().catch((err) => {
      console.error('[app-status.init] failed', err);
    });
    // Hydrate la liste locale de pseudos bloqués (mute list device).
    useBlocked.getState().load();
  }, [init, setInitialized, initAppStatus]);

  // Mise à jour à distance au lancement. La vérification est plafonnée court
  // et se cache derrière le boot déjà payé ; l'écran de téléchargement
  // n'apparaît que si une mise à jour existe VRAIMENT. Tous les chemins
  // d'échec sont dans `ota.ts` et mènent ici au même endroit : 'done', donc
  // l'app démarre. Cf. `docs/MISES-A-JOUR-APP.md`.
  useEffect(() => {
    runStartupUpdateWithExpo(setOtaPhase)
      .then((outcome) => {
        // 'reloading' est le seul cas où l'on ne reprend pas la main :
        // laisser le splash évite un clignotement avant le redémarrage.
        if (outcome !== 'reloading') setOtaPhase('done');
      })
      .catch((err) => {
        // `runStartupUpdate` ne lève pas, mais on ne parie pas là-dessus :
        // c'est exactement ce genre de pari qui bloque un splash.
        console.error('[ota] failed', err);
        setOtaPhase('done');
      });
  }, []);

  // Garde-fou ultime : si pour une raison X le splash dure plus de 12 s,
  // on force l'entrée dans l'app. Évite le rejet App Store « stuck on
  // splash ».
  //
  // Il libère TOUS les verrous, pas seulement `initialized` : la version
  // précédente laissait passer `appStatusLoading`, si bien qu'une lecture
  // d'`app_config` qui n'aboutissait jamais gardait l'écran jaune pour
  // toujours. Un seul point de sortie, pas trois timeouts qui se coursent.
  useEffect(() => {
    const t = setTimeout(() => {
      setInitialized(true);
      stopAppStatusLoading();
      setOtaPhase('done');
    }, 12000);
    return () => clearTimeout(t);
  }, [setInitialized, stopAppStatusLoading]);

  if (!fontsLoaded || !initialized || appStatusLoading || otaPhase !== 'done') {
    // Splash custom (logo + Popy animé) tant que les fonts ne sont pas
    // chargées ET que la session anonymous n'est pas démarrée. Voilà
    // ce que l'utilisateur voit pendant ~500ms-2s au boot.
    //
    // La légende n'apparaît qu'au téléchargement d'une mise à jour : pendant
    // la vérification, qui a lieu à chaque lancement, le splash reste
    // strictement identique à d'habitude.
    return <Splash caption={otaPhase === 'downloading' ? 'Mise à jour…' : undefined} />;
  }

  // Verdict app-config : maintenance ou force update bloquent tout accès
  // à l'app. Les écrans sont rendus sans le Stack expo-router → pas de
  // navigation possible. Refetch sur retour foreground (cf. app-status store).
  if (appStatus === 'maintenance' && appStatusConfig) {
    return (
      <MaintenanceScreen
        title={appStatusConfig.maintenanceTitle}
        message={appStatusConfig.maintenanceMessage}
      />
    );
  }
  if (appStatus === 'force_update') {
    return <ForceUpdateScreen />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#fbbf24' },
            }}
          >
            <Stack.Screen
              name="search-modal"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
                contentStyle: { backgroundColor: '#fbf3de' },
              }}
            />
          </Stack>
          <PushResponder />
          <UpdateBanner />
          <OfflineBanner />
          <ToastHost />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Le tap d'une notification (chantier 17, lot 4). La cible attend dans
 * `usePushTarget`, et le composer la suit dès qu'il est à l'écran. Ici, on
 * l'y mène, et seulement si l'entrée de l'app y mènerait elle-même
 * (`app/index.tsx`) : sinon, l'accueil ou les règles d'abord, et le tap
 * s'oublie.
 *
 * **Une seule navigation à la fois.** Mesuré au simulateur le 23 septembre
 * 2026 : quand la racine et le composer naviguaient chacun de leur côté, le
 * composer ouvrait la recherche, puis la racine empilait un second composer
 * dans la feuille de la recherche. Désormais la racine ne fait rien quand le
 * composer est déjà là, et ferme d'abord toute modale.
 */
function PushResponder() {
  const navigationReady = Boolean(useRootNavigationState()?.key);
  const pathname = usePathname();
  const target = usePushTarget((s) => s.target);
  const profile = useSession((s) => s.profile);
  const draftHydrated = useDraft((s) => s.hydrated);
  const termsAcceptedAt = useDraft((s) => s.termsAcceptedAt);

  useEffect(() => startPushResponses((next) => usePushTarget.getState().set(next)), []);

  useEffect(() => {
    if (!target || !navigationReady) return;
    if (!profile && !draftHydrated) return;
    const composerOpen = profile ? Boolean(profile.terms_accepted_at) : Boolean(termsAcceptedAt);
    if (!composerOpen) {
      usePushTarget.getState().take();
      return;
    }
    // Déjà sur le composer, ou l'entrée de l'app qui y redirige encore : il
    // suivra la cible lui-même.
    if (pathname === '/compose' || pathname === '/') return;
    if (router.canDismiss()) router.dismissAll();
    router.navigate('/(tabs)/compose');
  }, [target, navigationReady, pathname, profile, draftHydrated, termsAcceptedAt]);

  return null;
}
