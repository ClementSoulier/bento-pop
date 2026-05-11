import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

/**
 * Bottom tab bar 4 onglets : Compose · À la une · Trouver · Profil.
 * Cf. design Claude Design — section "À la une & Recherche".
 *
 * Style provisoire (Ionicons). La version finale utilisera les SVG
 * custom du design (rectangle 4-cases, étoile, loupe, silhouette).
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0a0a0a',
        tabBarInactiveTintColor: 'rgba(10,10,10,0.45)',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 2.5,
          borderTopColor: '#0a0a0a',
          paddingTop: 8,
          height: 84,
        },
        tabBarLabelStyle: {
          fontFamily: 'Bungee',
          fontSize: 9,
          letterSpacing: 1,
          textTransform: 'uppercase',
        },
      }}
    >
      <Tabs.Screen
        name="compose"
        options={{
          title: 'Compose',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" color={color} size={size ?? 22} />
          ),
        }}
      />
      <Tabs.Screen
        name="featured"
        options={{
          title: 'À la une',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="star-outline" color={color} size={size ?? 22} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Trouver',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" color={color} size={size ?? 22} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size ?? 22} />
          ),
        }}
      />
    </Tabs>
  );
}
