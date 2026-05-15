import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { PageTitle, Sticker, StampButton, YellowBg } from '@/components/primitives';
import { SHADOWS } from '@/components/primitives/shadow';
import { supabase } from '@/supabase/client';
import { useSession } from '@/state/session';

const TERMS_URL = 'https://bento-pop.com/mentions-legales';
const PRIVACY_URL = 'https://bento-pop.com/confidentialite';

/**
 * Onboarding — Acceptation des CGU (App Store Guideline 1.2).
 *
 * Présenté AVANT la création du profil (pseudo) pour les nouveaux comptes,
 * et au prochain lancement pour les comptes existants qui n'ont jamais
 * accepté (gate dans `app/index.tsx`).
 *
 * Au tap « Continuer » :
 *   - si le profil existe déjà → UPDATE users.terms_accepted_at + retour tabs
 *   - sinon → simple navigation vers /onboarding/pseudo (le timestamp sera
 *     posé dans l'INSERT de la ligne `users` au moment du choix du pseudo)
 */
export default function TermsOnboarding() {
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const profile = useSession((s) => s.profile);
  const userId = useSession((s) => s.user?.id);
  const refreshProfile = useSession((s) => s.refreshProfile);

  const onContinue = async () => {
    if (!accepted) return;
    setSubmitting(true);
    try {
      if (profile && userId) {
        // Compte existant : on enregistre l'acceptation et on retourne dans l'app.
        const { error } = await supabase
          .from('users')
          .update({ terms_accepted_at: new Date().toISOString() })
          .eq('id', userId);
        if (error) {
          Alert.alert('Oups', `Impossible d'enregistrer l'acceptation : ${error.message}`);
          return;
        }
        await refreshProfile();
        router.replace('/(tabs)/compose');
      } else {
        // Nouveau compte : on continue l'onboarding, l'acceptation sera
        // persistée dans l'INSERT de la ligne `users` au step suivant.
        router.push('/onboarding/pseudo');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingTop: 16, paddingBottom: 16 }}>
          <PageTitle
            kicker={profile ? 'AVANT DE CONTINUER' : 'AVANT DE COMMENCER'}
            title={'Les règles\ndu jeu.'}
            sub="Bento Pop est un espace bienveillant. Avant de publier ton premier bento, jette un œil aux règles."
          />

          <ScrollView
            style={{ flex: 1, marginTop: 20 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
          >
            <Sticker rotation={-2} style={{ alignSelf: 'flex-start', marginBottom: 14 }}>
              TOLÉRANCE ZÉRO
            </Sticker>
            <RuleLine>
              Pas de contenu haineux, raciste, sexiste, homophobe, transphobe, validiste ou
              discriminatoire.
            </RuleLine>
            <RuleLine>
              Pas de harcèlement, d'insultes, de menaces ou d'incitation à la haine envers d'autres
              utilisateur·rice·s.
            </RuleLine>
            <RuleLine>
              Pas de contenu illégal, sexuel non consenti, à caractère pédopornographique ou
              promouvant la violence.
            </RuleLine>
            <RuleLine>
              Pas d'usurpation d'identité, pas de spam, pas d'arnaque, pas de doxxing.
            </RuleLine>

            <Sticker rotation={2} style={{ alignSelf: 'flex-start', marginTop: 18, marginBottom: 14 }}>
              CE QU'ON FAIT
            </Sticker>
            <RuleLine>
              Tu peux <Text style={{ fontWeight: '800' }}>signaler</Text> tout bento qui te paraît
              hors-limites — on examine sous 24 h.
            </RuleLine>
            <RuleLine>
              Tu peux <Text style={{ fontWeight: '800' }}>bloquer</Text> un·e utilisateur·rice à
              tout moment depuis sa page profil.
            </RuleLine>
            <RuleLine>
              Les comptes qui enfreignent ces règles sont avertis puis supprimés sans préavis.
            </RuleLine>

            <View style={{ marginTop: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Text style={{ fontSize: 13, color: 'rgba(10,10,10,0.7)' }}>Tu peux lire les</Text>
              <Pressable
                onPress={() => Linking.openURL(TERMS_URL)}
                accessibilityRole="link"
                accessibilityLabel="Ouvrir les conditions d'utilisation"
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: '#0a0a0a',
                    fontWeight: '700',
                    textDecorationLine: 'underline',
                  }}
                >
                  conditions d'utilisation
                </Text>
              </Pressable>
              <Text style={{ fontSize: 13, color: 'rgba(10,10,10,0.7)' }}>et la</Text>
              <Pressable
                onPress={() => Linking.openURL(PRIVACY_URL)}
                accessibilityRole="link"
                accessibilityLabel="Ouvrir la politique de confidentialité"
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: '#0a0a0a',
                    fontWeight: '700',
                    textDecorationLine: 'underline',
                  }}
                >
                  politique de confidentialité
                </Text>
              </Pressable>
              <Text style={{ fontSize: 13, color: 'rgba(10,10,10,0.7)' }}>complètes.</Text>
            </View>
          </ScrollView>

          <View style={{ paddingHorizontal: 20 }}>
            <Pressable
              onPress={() => setAccepted((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: accepted }}
              accessibilityLabel="J'accepte les conditions d'utilisation"
              style={[
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  backgroundColor: '#ffffff',
                  borderWidth: 3,
                  borderColor: '#0a0a0a',
                  borderRadius: 14,
                  marginBottom: 14,
                },
                SHADOWS.stamp,
              ]}
            >
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderWidth: 3,
                  borderColor: '#0a0a0a',
                  borderRadius: 6,
                  backgroundColor: accepted ? '#0a0a0a' : '#ffffff',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {accepted ? (
                  <Text style={{ color: '#fbbf24', fontSize: 18, fontWeight: '900', lineHeight: 22 }}>
                    ✓
                  </Text>
                ) : null}
              </View>
              <Text style={{ flex: 1, fontSize: 14, color: '#0a0a0a', lineHeight: 19 }}>
                J'ai lu et j'accepte les règles ci-dessus, les CGU et la politique de
                confidentialité.
              </Text>
            </Pressable>

            <StampButton wide disabled={!accepted || submitting} onPress={onContinue}>
              {submitting ? 'Enregistrement…' : 'Continuer'}
            </StampButton>
          </View>
        </View>
      </SafeAreaView>
    </YellowBg>
  );
}

function RuleLine({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
      <Text style={{ fontSize: 18, color: '#0a0a0a', lineHeight: 22 }}></Text>
      <Text style={{ flex: 1, fontSize: 14, color: 'rgba(10,10,10,0.85)', lineHeight: 20 }}>
        {children}
      </Text>
    </View>
  );
}
