import '../src/styles/global.css';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { queryClient } from '@/lib/query-client';
import { FONTS } from '@/lib/fonts';
import { useSession } from '@/state/session';
import { useBlocked } from '@/state/blocked';
import { Splash } from '@/components/Splash';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ToastHost } from '@/components/primitives';

/**
 * Root layout : charge les polices, démarre la session anonyme, monte les
 * providers (React Query, gesture handler, safe area), puis délègue au Stack.
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts(FONTS);
  const init = useSession((s) => s.init);
  const initialized = useSession((s) => s.initialized);

  const setInitialized = useSession((s) => s.setInitialized);

  useEffect(() => {
    init().catch((err) => {
      // Safety net : init() pose déjà initialized=true dans son finally,
      // mais on garde un fallback ici au cas où une erreur synchrone
      // remonterait avant l'entrée dans le try.
      console.error('[session.init] failed', err);
      setInitialized(true);
    });
    // Hydrate la liste locale de pseudos bloqués (mute list device).
    useBlocked.getState().load();
  }, [init, setInitialized]);

  // Garde-fou ultime : si pour une raison X le splash dure plus de 12 s
  // (fonts qui ne se chargent jamais, etc.), on force l'entrée dans
  // l'app. Évite le rejet App Store « stuck on splash ».
  useEffect(() => {
    const t = setTimeout(() => setInitialized(true), 12000);
    return () => clearTimeout(t);
  }, [setInitialized]);

  if (!fontsLoaded || !initialized) {
    // Splash custom (logo + Popy animé) tant que les fonts ne sont pas
    // chargées ET que la session anonymous n'est pas démarrée. Voilà
    // ce que l'utilisateur voit pendant ~500ms-2s au boot.
    return <Splash />;
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
          <OfflineBanner />
          <ToastHost />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
