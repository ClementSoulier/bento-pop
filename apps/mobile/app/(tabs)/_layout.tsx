// SDK 57 : `Tabs` depuis 'expo-router' est déprécié au profit du subpath
// 'expo-router/js-tabs' (les tabs JS classiques, look inchangé). L'autre
// option, 'expo-router/unstable-native-tabs', rendrait des tabs natives
// et casserait la DA Bento Pop (bordure 2.5px, police Bungee).
import { Platform, Text, useWindowDimensions, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ComposeIcon, FeaturedIcon, ProfileIcon, SearchIcon } from '@/components/TabIcons';
import {
  CONTROL_MAX_FONT_MULTIPLIER,
  naturalLineHeight,
  scaledType,
} from '@/components/bento/font-scaling';
import { TAB_BAR_BASE_INSET, tabBarHeight } from '@/components/tab-bar';
import { INK_PLACEHOLDER } from '@/components/primitives';

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
 */
function TabLabel({ color, children }: { color: ColorValue; children: string }) {
  const { fontScale } = useWindowDimensions();
  return (
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      adjustsFontSizeToFit
      style={{
        color,
        fontFamily: 'Bungee',
        ...scaledType(fontScale, CONTROL_MAX_FONT_MULTIPLIER, 9, naturalLineHeight('Bungee', 9)),
        letterSpacing: 1,
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
 * Bottom tab bar 4 onglets : Compose · La table · Trouver · Profil.
 *
 * Chaque onglet porte son libellé d'accessibilité, en français : par défaut,
 * React Navigation annonçait « Compose, tab, 1 of 4 » sur iOS, et ne dit plus
 * rien d'utile dès que le libellé est rendu par l'app, qui lirait « COMPOSE ».
 * Icônes SVG custom (cf. `TabIcons`) — bordure 2.5px noir cohérente avec
 * la signature visuelle Bento Pop. Active = remplie, inactive = outline.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
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
        tabBarLabel: ({ color, children }) => <TabLabel color={color}>{children}</TabLabel>,
      }}
    >
      <Tabs.Screen
        name="compose"
        options={{
          title: 'Compose',
          tabBarAccessibilityLabel: 'Compose, onglet 1 sur 4',
          tabBarIcon: ({ color, focused }) => (
            <ComposeIcon size={22} color={color} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="table"
        options={{
          title: 'La table',
          tabBarAccessibilityLabel: 'La table, onglet 2 sur 4',
          tabBarIcon: ({ color, focused }) => (
            <FeaturedIcon size={22} color={color} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Trouver',
          tabBarAccessibilityLabel: 'Trouver, onglet 3 sur 4',
          tabBarIcon: ({ color }) => <SearchIcon size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarAccessibilityLabel: 'Profil, onglet 4 sur 4',
          tabBarIcon: ({ color, focused }) => (
            <ProfileIcon size={22} color={color} active={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
