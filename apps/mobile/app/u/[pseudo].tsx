import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

/**
 * Bento public partageable : /u/<pseudo>.
 * Cible des liens de partage (Instagram, WhatsApp, etc.) et de l'app web.
 */
export default function PublicBento() {
  const { pseudo } = useLocalSearchParams<{ pseudo: string }>();
  return (
    <View className="flex-1 items-center justify-center bg-bento-yellow">
      <Text className="font-display text-4xl">@{pseudo}</Text>
      <Text className="mt-2 text-base">Bento public — TODO (P3)</Text>
    </View>
  );
}
