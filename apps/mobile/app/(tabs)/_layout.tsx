// SDK 57 : `Tabs` depuis 'expo-router' est déprécié au profit du subpath
// 'expo-router/js-tabs' (les tabs JS classiques, look inchangé). L'autre
// option, 'expo-router/unstable-native-tabs', rendrait des tabs natives
// et casserait la DA Bento Pop (bordure 2.5px, police Bungee).
import { PixelRatio, Platform, Text, View, useWindowDimensions, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bungeeTextWidth } from '@bento-pop/supabase-mobile/bento';
import { BellIcon, ComposeIcon, FeaturedIcon, ProfileIcon, SearchIcon } from '@/components/TabIcons';
import {
  CONTROL_MAX_FONT_MULTIPLIER,
  naturalLineHeight,
  scaledType,
} from '@/components/bento/font-scaling';
import { TAB_BAR_BASE_INSET, tabBarHeight, tabLabelScale } from '@/components/tab-bar';
import {
  useBadgeRefresh,
  useNotificationBadge,
  useNotificationsEnabled,
} from '@/components/notifications/use-notifications';
import { INK_PLACEHOLDER } from '@/components/primitives';
import { badgeText, notificationsTabLabel } from '@/lib/notifications';

const LABEL_SIZE = 9;
const LABEL_SPACING = 1;
const BADGE_SIZE = 9;
/** Bordure et marges de la pastille, de chaque côté. */
const BADGE_BORDER = 2;
const BADGE_PADDING = 4;

/**
 * Libellé d'un onglet.
 *
 * Rendu par l'app et non par React Navigation, pour trois raisons mesurées au
 * chantier 11 sur l'émulateur Pixel 8 : ses libellés suivaient la police sans
 * plafond et se tronquaient à la taille 2,0, « COMPO… », « LA TAB… » ; et la
 * boîte que Bungee y prend sans hauteur de ligne posée, 23 dp pour 9 de police,
 * ne tenait pas dans la barre en navigation à trois boutons, où le libellé
 * sortait coupé en deux. Il plafonne donc comme les autres contrôles, pose sa
 * hauteur de ligne et rétrécit plutôt que de se tronquer.
 *
 * Il rétrécit à la taille que l'écran mesure, et non par
 * `adjustsFontSizeToFit` : avec une hauteur de ligne posée, iOS faisait tomber
 * un texte à la trace, relevé à la recette du 23 (chantier 24, D21). À la
 * taille par défaut, les cinq libellés tiennent sans réduire.
 */
function TabLabel({ color, children, tabs }: { color: ColorValue; children: string; tabs: number }) {
  const { fontScale, width } = useWindowDimensions();
  const type = scaledType(
    fontScale,
    CONTROL_MAX_FONT_MULTIPLIER,
    LABEL_SIZE,
    naturalLineHeight('Bungee', LABEL_SIZE),
  );
  const scale = tabLabelScale(
    children,
    width / tabs,
    type.fontSize,
    LABEL_SPACING,
    Platform.OS === 'android' ? PixelRatio.get() : undefined,
  );
  return (
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      style={{
        color,
        fontFamily: 'Bungee',
        ...type,
        fontSize: type.fontSize * scale,
        letterSpacing: LABEL_SPACING,
        textTransform: 'uppercase',
        textAlign: 'center',
        includeFontPadding: false,
      }}
    >
      {children}
    </Text>
  );
}

/**
 * La cloche de « Notifs » et sa pastille (D5) : le nombre de lignes
 * nouvelles, « 9+ » au-delà ; rien quand il n'y en a pas. Un décor pour le
 * lecteur d'écran, qui entend le nombre dans le libellé de l'onglet (D20).
 */
function NotifsTabIcon({ color, focused, count }: { color: ColorValue; focused: boolean; count: number }) {
  const text = badgeText(count);
  // Une largeur posée, mesurée sur son texte : en position absolue dans une
  // icône de 22 pt, la pastille n'en aurait que 10 pour grandir, et « 9+ »
  // perdait son « + » (recette du lot 5).
  const width = text
    ? Math.max(19, Math.ceil(bungeeTextWidth(text, BADGE_SIZE, 0)) + (BADGE_PADDING + BADGE_BORDER) * 2 + 1)
    : 0;
  return (
    <View style={{ width: 22, height: 22 }}>
      <BellIcon size={22} color={color} active={focused} />
      {text ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -7,
            left: 12,
            width,
            height: 19,
            paddingHorizontal: BADGE_PADDING,
            borderRadius: 10,
            backgroundColor: '#e63946',
            borderWidth: BADGE_BORDER,
            borderColor: '#0a0a0a',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: 'Bungee',
              fontSize: BADGE_SIZE,
              lineHeight: 11,
              color: '#ffffff',
              includeFontPadding: false,
            }}
          >
            {text}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Bottom tab bar : Compose · La table · Trouver · Notifs · Profil.
 *
 * « Notifs » est le chantier 24 (D1, D5) ; son interrupteur éteint, la barre
 * revient aux quatre onglets d'avant, au pixel près (D13).
 *
 * Chaque onglet porte son libellé d'accessibilité, en français : par défaut,
 * React Navigation annonçait « Compose, tab, 1 of 4 » sur iOS, et ne dit plus
 * rien d'utile dès que le libellé est rendu par l'app, qui lirait « COMPOSE ».
 * Icônes SVG custom (cf. `TabIcons`) — bordure 2.5px noir cohérente avec
 * la signature visuelle Bento Pop. Active = remplie, inactive = outline.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const notifsOn = useNotificationsEnabled();
  const count = useNotificationBadge();
  const refreshBadge = useBadgeRefresh();
  const tabs = notifsOn ? 5 : 4;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0a0a0a',
        tabBarInactiveTintColor: INK_PLACEHOLDER,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 2.5,
          borderTopColor: '#0a0a0a',
          paddingTop: 8,
          height: tabBarHeight(
            insets.bottom,
            Platform.OS === 'ios' ? TAB_BAR_BASE_INSET.ios : TAB_BAR_BASE_INSET.android,
          ),
        },
        tabBarLabel: ({ color, children }) => (
          <TabLabel color={color} tabs={tabs}>
            {children}
          </TabLabel>
        ),
      }}
      // Chaque changement d'onglet relit le nombre, s'il date (D9).
      screenListeners={{ focus: refreshBadge }}
    >
      <Tabs.Screen
        name="compose"
        options={{
          title: 'Compose',
          tabBarAccessibilityLabel: `Compose, onglet 1 sur ${tabs}`,
          tabBarIcon: ({ color, focused }) => (
            <ComposeIcon size={22} color={color} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="table"
        options={{
          title: 'La table',
          tabBarAccessibilityLabel: `La table, onglet 2 sur ${tabs}`,
          tabBarIcon: ({ color, focused }) => (
            <FeaturedIcon size={22} color={color} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Trouver',
          tabBarAccessibilityLabel: `Trouver, onglet 3 sur ${tabs}`,
          tabBarIcon: ({ color }) => <SearchIcon size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifs',
          // Éteint, l'onglet sort de la barre (D13).
          href: notifsOn ? undefined : null,
          tabBarAccessibilityLabel: notificationsTabLabel(count, 4, tabs),
          tabBarIcon: ({ color, focused }) => (
            <NotifsTabIcon color={color} focused={focused} count={count} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarAccessibilityLabel: `Profil, onglet ${tabs} sur ${tabs}`,
          tabBarIcon: ({ color, focused }) => (
            <ProfileIcon size={22} color={color} active={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
