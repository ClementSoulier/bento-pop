import { useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSession } from '@/state/session';
import { popyForPseudo } from '@/lib/popy-avatar';
import { deleteOwnAccount } from '@/lib/bento-actions';
import { exportUserData } from '@/lib/data-export';
import { SHADOWS, StampButton, YellowBg } from '@/components/primitives';

const PRIVACY_URL = 'https://bento-pop.com/confidentialite';
const TERMS_URL = 'https://bento-pop.com/mentions-legales';

export default function ProfileTab() {
  const profile = useSession((s) => s.profile);
  const userId = useSession((s) => s.user?.id);
  const resetAndReinit = useSession((s) => s.resetAndReinit);
  const pseudo = profile?.pseudo ?? '';
  const popy = popyForPseudo(pseudo);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const onExport = async () => {
    if (!userId) return;
    setExporting(true);
    try {
      await exportUserData(userId);
    } catch (e) {
      Alert.alert('Export impossible', (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Supprimer mon compte ?',
      'Toutes tes données seront effacées définitivement : pseudo, bento, items sélectionnés. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            if (!userId) return;
            setDeleting(true);
            try {
              await deleteOwnAccount(userId);
              await resetAndReinit();
              // Le `Redirect` dans app/index.tsx renverra vers l'onboarding
              router.replace('/');
            } catch (e) {
              Alert.alert('Oups', (e as Error).message);
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          <View style={{ alignItems: 'center', paddingTop: 32 }}>
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

            <View style={{ marginTop: 32, width: '100%', gap: 12 }}>
              <Pressable
                onPress={() => router.push(`/u/${pseudo}` as const)}
                accessibilityRole="button"
                accessibilityLabel="Voir mon bento public"
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

          {/* Section À propos / Légal */}
          <View style={{ marginTop: 36, gap: 8 }}>
            <Text
              style={{
                fontFamily: 'Bungee',
                fontSize: 10,
                letterSpacing: 2,
                color: 'rgba(10,10,10,0.55)',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              À propos
            </Text>
            <ProfileLink label="Crédits & attributions" onPress={() => router.push('/credits')} />
            <ProfileLink
              label="Politique de confidentialité"
              onPress={() => Linking.openURL(PRIVACY_URL)}
            />
            <ProfileLink
              label="Conditions d'utilisation"
              onPress={() => Linking.openURL(TERMS_URL)}
            />
            <ProfileLink
              label={exporting ? 'Export en cours…' : 'Exporter mes données'}
              onPress={exporting ? () => {} : onExport}
            />
          </View>

          {/* Section Compte */}
          <View style={{ marginTop: 24, gap: 8 }}>
            <Text
              style={{
                fontFamily: 'Bungee',
                fontSize: 10,
                letterSpacing: 2,
                color: 'rgba(10,10,10,0.55)',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              Compte
            </Text>
            <Pressable
              onPress={confirmDelete}
              disabled={deleting}
              accessibilityRole="button"
              accessibilityLabel={deleting ? 'Suppression en cours' : 'Supprimer mon compte'}
              accessibilityHint="Cette action est irréversible"
              accessibilityState={{ disabled: deleting, busy: deleting }}
              style={{
                paddingVertical: 14,
                paddingHorizontal: 18,
                borderRadius: 14,
                borderWidth: 2,
                borderColor: '#e63946',
                backgroundColor: 'rgba(230,57,70,0.06)',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Bungee',
                  fontSize: 12,
                  letterSpacing: 1,
                  color: '#e63946',
                  textTransform: 'uppercase',
                }}
              >
                {deleting ? 'Suppression…' : 'Supprimer mon compte'}
              </Text>
            </Pressable>
            <Text
              style={{
                fontSize: 11,
                color: 'rgba(10,10,10,0.55)',
                textAlign: 'center',
                lineHeight: 16,
                marginTop: 4,
              }}
            >
              Efface définitivement ton pseudo, ton bento et tes choix. Cette action est irréversible.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </YellowBg>
  );
}

function ProfileLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={{
        paddingVertical: 13,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        borderWidth: 2,
        borderColor: '#0a0a0a',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '600' }}>{label}</Text>
      <Text style={{ fontSize: 18, color: 'rgba(10,10,10,0.4)' }}>›</Text>
    </Pressable>
  );
}
