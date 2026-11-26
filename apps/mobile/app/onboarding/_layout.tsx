import { Stack } from 'expo-router';
import { useTheme } from '@/design';

export default function OnboardingLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors['bg-brand'] },
        animation: 'slide_from_right',
      }}
    />
  );
}
