import { useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSession } from '@/state/session';
import { useBento } from '@/state/bento';
import { popyForPseudo } from '@/lib/popy-avatar';
import { deleteOwnAccount, ensureBento, unpublishBento } from '@/lib/bento-actions';
import { relativeDate } from '@/lib/relative-date';
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
  const publishedAt = useBento((s) => s.publishedAt);
  const setPublishedAt = useBento((s) => s.setPublishedAt);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);

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

  /**
   * Retrait du fil. Avant ce bouton, la seule façon de ne plus être visible
   * était de supprimer son compte, ce qui est sans commune mesure.
   *
   * Confirmation volontairement calme : le geste est réversible d'un tap, et
   * un `style: 'destructive'` le mettrait au même niveau que la suppression
   * de compte, qui est juste en dessous et qui, elle, ne se rattrape pas.
   */
  const confirmUnpublish = () => {
    Alert.alert(
      'Retirer mon bento du fil ?',
      'Il disparaît de « La table » et de sa page publique. Tes cases restent en place, tu peux le republier quand tu veux.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          onPress: async () => {
            if (!userId) return;
            setUnpublishing(true);
            try {
              const bentoId = await ensureBento(userId);
              await unpublishBento(bentoId);
              setPublishedAt(null);
            } catch (e) {
              Alert.alert('Oups', (e as Error).message);
            } finally {
              setUnpublishing(false);
            }
          },
        },
      ],
    );
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

            {/* La date existait en base depuis toujours et personne ne la
                voyait. C'est elle qui donne la certitude que le bento est
                bien parti, et sa disparition confirme le retrait. */}
            <Text
              style={{
                fontFamily: 'Bungee',
                fontSize: 9,
                letterSpacing: 1,
                marginTop: 10,
                color: 'rgba(10,10,10,0.55)',
                textTransform: 'uppercase',
              }}
            >
              {publishedAt ? `En ligne · publié ${relativeDate(publishedAt)}` : 'Pas encore publié'}
            </Text>

            <View style={{ marginTop: 32, width: '100%', gap: 12 }}>
              {/* Uniquement quand le bento est en ligne. Depuis qu'on peut le
                  retirer du fil, laisser ce bouton mènerait à « Bento
                  introuvable » : un cul-de-sac que l'app propose elle-même,
                  juste après un geste volontaire de l'utilisateur. */}
              {publishedAt ? (
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
              ) : null}
              <StampButton
                wide
                variant={publishedAt ? 'cream' : 'primary'}
                onPress={() => router.push('/(tabs)/compose')}
              >
                {publishedAt ? 'Éditer mon bento' : 'Reprendre mon bento'}
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

            {/* Neutre, et non encadré de rouge : retirer son bento se
                rattrape d'un tap, supprimer son compte non. Les habiller
                pareil serait fabriquer l'erreur. */}
            {publishedAt ? (
              <View style={{ marginBottom: 8 }}>
                <ProfileLink
                  label={unpublishing ? 'Retrait en cours…' : 'Retirer mon bento du fil'}
                  onPress={unpublishing ? () => {} : confirmUnpublish}
                />
              </View>
            ) : null}

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
