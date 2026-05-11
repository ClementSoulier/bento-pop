import { View, Text, Image, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSession } from '@/state/session';
import { popyForPseudo } from '@/lib/popy-avatar';
import { SHADOWS, StampButton, YellowBg } from '@/components/primitives';

export default function ProfileTab() {
  const profile = useSession((s) => s.profile);
  const pseudo = profile?.pseudo ?? '';
  const popy = popyForPseudo(pseudo);

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1, paddingHorizontal: 24 }}>
        <View style={{ flex: 1, alignItems: 'center', paddingTop: 48 }}>
          {/* Avatar Popy */}
          <View
            style={[
              {
                width: 130,
                height: 130,
                borderRadius: 65,
                backgroundColor: '#ffffff',
                borderWidth: 4,
                borderColor: '#0a0a0a',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              },
              SHADOWS.stampLg,
            ]}
          >
            <Image source={popy.source} style={{ width: 110, height: 110 }} resizeMode="contain" />
          </View>

          <Text
            style={{
              fontFamily: 'Extenda',
              fontSize: 36,
              letterSpacing: 1,
              marginTop: 20,
              textTransform: 'uppercase',
            }}
          >
            @{pseudo || '—'}
          </Text>
          {profile?.display_name ? (
            <Text style={{ fontSize: 14, color: 'rgba(10,10,10,0.65)', marginTop: 4 }}>
              {profile.display_name}
            </Text>
          ) : null}

          <View style={{ marginTop: 36, width: '100%', gap: 12 }}>
            <Pressable
              onPress={() => router.push(`/u/${pseudo}` as const)}
              style={[
                {
                  backgroundColor: '#ffffff',
                  borderWidth: 3,
                  borderColor: '#0a0a0a',
                  borderRadius: 999,
                  paddingVertical: 14,
                  alignItems: 'center',
                },
                SHADOWS.stamp,
              ]}
            >
              <Text
                style={{
                  fontFamily: 'Bungee',
                  fontSize: 14,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                Voir mon bento public
              </Text>
            </Pressable>
            <StampButton wide variant="cream" onPress={() => router.push('/(tabs)/compose')}>
              Éditer mon bento
            </StampButton>
          </View>
        </View>
      </SafeAreaView>
    </YellowBg>
  );
}
