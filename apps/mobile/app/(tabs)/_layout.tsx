// SDK 57 : `Tabs` depuis 'expo-router' est déprécié au profit du subpath
// 'expo-router/js-tabs' (les tabs JS classiques). L'autre option,
// 'expo-router/unstable-native-tabs', rendrait des tabs natives, que la barre
// du design ne peut pas devenir.
import { useContext } from 'react';
import { View } from 'react-native';
import {
  BottomTabBarHeightCallbackContext,
  Tabs,
  type BottomTabBarProps,
} from 'expo-router/js-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { popyKeyFor } from '@bento-pop/supabase-mobile/bento';
import { TabBar, popyTint, tabBarHeight, visibleTabs, type TabKey } from '@/design';
import {
  useBadgeRefresh,
  useNotificationBadge,
  useNotificationsEnabled,
} from '@/components/notifications/use-notifications';
import { UpdateNotice } from '@/components/UpdateNotice';
import { selectionFeedback } from '@/lib/haptics';
import { useSession } from '@/state/session';

/** Les routes de `app/(tabs)/`, par onglet du design. */
const ROUTES: Record<TabKey, string> = {
  table: 'table',
  trouver: 'search',
  compose: 'compose',
  notifs: 'notifications',
  profil: 'profile',
};

const TAB_OF_ROUTE = Object.fromEntries(
  Object.entries(ROUTES).map(([tab, route]) => [route, tab as TabKey]),
);

/**
 * La barre d'onglets du design system v2 (chantier 31) : La table, Trouver,
 * Compose au centre, Notifs, Profil.
 *
 * - L'app ouvre toujours Compose, et le retour d'Android y ramène (D1).
 * - La zone de notifications coupée depuis le back-office, Notifs sort de la
 *   barre et Compose devient le troisième de quatre onglets (D2).
 * - Profil montre l'avatar de la personne, sa Popy sur la teinte de sa Popy ;
 *   sans pseudo, « content » sur le jaune (D6).
 * - Changer d'onglet joue une sélection légère (D13).
 * - Le bandeau de mise à jour se pose au-dessus des onglets, dans le flux
 *   (D8) : il prend la zone sûre du haut, et les écrans dessous la reçoivent
 *   nulle, par un `SafeAreaProvider` à eux, toujours là pour ne jamais
 *   remonter les onglets.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const notifsOn = useNotificationsEnabled();
  const refreshBadge = useBadgeRefresh();
  return (
    <View style={{ flex: 1 }}>
      <UpdateNotice />
      <SafeAreaProvider style={{ flex: 1 }}>
        <Tabs
          initialRouteName="compose"
          backBehavior="initialRoute"
          screenOptions={{
            headerShown: false,
            // La hauteur que `useBottomTabBarHeight` rend avant que la barre se
            // mesure : la sienne, filet compris.
            tabBarStyle: { height: tabBarHeight(insets.bottom) },
          }}
          // Chaque changement d'onglet relit le nombre, s'il date (D9 du 24).
          screenListeners={{ focus: refreshBadge }}
          tabBar={(props) => <AppTabBar {...props} notifsOn={notifsOn} />}
        >
          <Tabs.Screen name="table" options={{ title: 'La table' }} />
          <Tabs.Screen name="search" options={{ title: 'Trouver' }} />
          <Tabs.Screen name="compose" options={{ title: 'Compose' }} />
          <Tabs.Screen
            name="notifications"
            options={{ title: 'Notifs', href: notifsOn ? undefined : null }}
          />
          <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
        </Tabs>
      </SafeAreaProvider>
    </View>
  );
}

/**
 * La `TabBar` du design branchée sur la navigation : l'appui émet
 * `tabPress`, que les écrans écoutent pour remonter en haut, puis change
 * d'onglet ; la hauteur mesurée remonte à `useBottomTabBarHeight`.
 */
function AppTabBar({ state, navigation, notifsOn }: BottomTabBarProps & { notifsOn: boolean }) {
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  const notifications = useNotificationBadge();
  const pseudo = useSession((s) => s.profile?.pseudo);
  const avatar = useSession((s) => s.profile?.avatar);
  const popy = pseudo ? popyKeyFor(pseudo, avatar) : 'content';
  const focused = state.routes[state.index];
  return (
    <View onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}>
      <TabBar
        active={focused ? TAB_OF_ROUTE[focused.name] : undefined}
        tabs={visibleTabs(notifsOn)}
        notifs={notifications}
        mood={popy}
        color={popyTint(popy)}
        onSelect={(tab) => {
          const route = state.routes.find((r) => r.name === ROUTES[tab]);
          if (!route) return;
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (route.key === focused?.key || event.defaultPrevented) return;
          selectionFeedback();
          navigation.navigate(route.name, route.params);
        }}
      />
    </View>
  );
}
