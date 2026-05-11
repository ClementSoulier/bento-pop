import '../src/styles/global.css';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { View } from 'react-native';
import { queryClient } from '@/lib/query-client';
import { FONTS } from '@/lib/fonts';
import { useSession } from '@/state/session';

/**
 * Root layout : charge les polices, démarre la session anonyme, monte les
 * providers (React Query, gesture handler, safe area), puis délègue au Stack.
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts(FONTS);
  const init = useSession((s) => s.init);
  const initialized = useSession((s) => s.initialized);

  useEffect(() => {
    init().catch((err) => {
      // TODO P2 : surfacer dans une UI d'erreur. Pour le MVP on log.
      console.error('[session.init] failed', err);
    });
  }, [init]);

  if (!fontsLoaded || !initialized) {
    // Pas d'écran de chargement custom au MVP — l'écran reste sur le splash
    // natif Expo. À remplacer par un Splash Bento Pop animé en P2.
    return <View style={{ flex: 1, backgroundColor: '#fbbf24' }} />;
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
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
