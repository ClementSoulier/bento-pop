import { View, Text } from 'react-native';
import { useSession } from '@/state/session';

export default function ProfileTab() {
  const profile = useSession((s) => s.profile);
  return (
    <View className="flex-1 items-center justify-center bg-bento-yellow">
      <Text className="font-display text-4xl">Profil</Text>
      <Text className="mt-2 text-base">
        @{profile?.pseudo ?? '—'}
      </Text>
    </View>
  );
}
