import { Tabs } from 'expo-router';
import { ComposeIcon, FeaturedIcon, ProfileIcon, SearchIcon } from '@/components/TabIcons';

/**
 * Bottom tab bar 4 onglets : Compose · À la une · Trouver · Profil.
 * Icônes SVG custom (cf. `TabIcons`) — bordure 2.5px noir cohérente avec
 * la signature visuelle Bento Pop. Active = remplie, inactive = outline.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0a0a0a',
        tabBarInactiveTintColor: 'rgba(10,10,10,0.4)',
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
          tabBarIcon: ({ color, focused }) => (
            <ComposeIcon size={22} color={color} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="featured"
        options={{
          title: 'À la une',
          tabBarIcon: ({ color, focused }) => (
            <FeaturedIcon size={22} color={color} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Trouver',
          tabBarIcon: ({ color }) => <SearchIcon size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <ProfileIcon size={22} color={color} active={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
