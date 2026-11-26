import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button, Checkbox, Rule, Screen, Steps, Text, useTheme } from '@/design';
import { userErrorMessage } from '@/lib/user-error-message';
import { supabase } from '@/supabase/client';
import { useDraft } from '@/state/draft';
import { useSession } from '@/state/session';

const TERMS_URL = 'https://bento-pop.com/mentions-legales';
const PRIVACY_URL = 'https://bento-pop.com/confidentialite';

/**
 * Les règles du jeu (`p02-regles`, chantier 31), l'acceptation des CGU qu'exige
 * la Guideline 1.2 de l'App Store : étape 2 sur 3 de l'accueil, et, au prochain
 * lancement, sans étapes, pour un compte qui ne les a jamais acceptées (gate
 * dans `app/index.tsx`).
 *
 * Au toucher de « Continuer » :
 *   - un compte existant : `users.terms_accepted_at` est écrit, retour au composer ;
 *   - un nouveau venu : l'acceptation est gardée sur l'appareil, et c'est elle
 *     que `publish_first_bento` inscrira au moment de publier.
 */
export default function TermsOnboarding() {
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const profile = useSession((s) => s.profile);
  const userId = useSession((s) => s.user?.id);
  const refreshProfile = useSession((s) => s.refreshProfile);
  const acceptTerms = useDraft((s) => s.acceptTerms);
  const { colors, border } = useTheme();
  const insets = useSafeAreaInsets();

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
          console.warn('[accueil] acceptation des règles', error);
          Alert.alert('Oups', userErrorMessage('accept-terms', error));
          return;
        }
        await refreshProfile();
        router.replace('/(tabs)/compose');
      } else {
        // Nouveau venu : le pseudo n'est plus demandé ici, depuis le chantier 9.
        acceptTerms();
        router.push('/onboarding/mechanics');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      {/* Pas d'étapes pour un compte revenu accepter les règles : il n'est pas
          dans un parcours. */}
      {profile ? null : (
        <View style={{ paddingTop: 8, paddingBottom: 8, paddingHorizontal: 16 }}>
          <Steps count={3} index={1} />
        </View>
      )}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: profile ? 20 : 12,
          paddingHorizontal: 16,
          paddingBottom: 20,
          gap: 18,
        }}
      >
        <View style={{ gap: 6 }}>
          <Text variant="eyebrow" color="text-secondary">
            {profile ? 'Avant de continuer' : 'Avant de commencer'}
          </Text>
          <Text variant="title-1" accessibilityRole="header">
            Les règles du jeu.
          </Text>
          <Text variant="body-l" color="text-secondary">
            Bento Pop est un espace bienveillant, réservé aux 15 ans et plus. Avant de publier ton
            premier bento, jette un œil aux règles.
          </Text>
        </View>
        <View style={{ gap: 12 }}>
          <Text variant="title-3" accessibilityRole="header">
            Tolérance zéro
          </Text>
          <Rule icon="prohibit" tone="no">
            Pas de contenu haineux, raciste, sexiste, homophobe, transphobe, validiste ou
            discriminatoire.
          </Rule>
          <Rule icon="prohibit" tone="no">
            Pas de harcèlement, d’insultes, de menaces ou d’incitation à la haine envers d’autres
            utilisateur·rice·s.
          </Rule>
          <Rule icon="prohibit" tone="no">
            Pas de contenu illégal, sexuel non consenti, à caractère pédopornographique ou
            promouvant la violence.
          </Rule>
          <Rule icon="prohibit" tone="no">
            Pas d’usurpation d’identité, pas de spam, pas d’arnaque, pas de doxxing.
          </Rule>
        </View>
        <View style={{ gap: 12 }}>
          <Text variant="title-3" accessibilityRole="header">
            Ce qu’on fait
          </Text>
          <Rule icon="flag">
            Tu peux{' '}
            <Text variant="body" weight={600}>
              signaler
            </Text>{' '}
            tout bento, pourquoi, commentaire ou compte qui te paraît hors-limites, on examine sous
            24 h.
          </Rule>
          <Rule icon="user-minus">
            Tu peux{' '}
            <Text variant="body" weight={600}>
              bloquer
            </Text>{' '}
            un·e utilisateur·rice à tout moment depuis sa page profil.
          </Rule>
          <Rule icon="warning-circle">
            Les comptes qui enfreignent ces règles sont avertis puis supprimés sans préavis.
          </Rule>
          {/* D9 du 31 : la maquette n'a plus ces deux liens, l'app les garde.
              Chacun reste un élément à part, que VoiceOver et TalkBack atteignent. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 4, marginTop: 6 }}>
            <Text variant="subhead" color="text-secondary">
              Tu peux lire les
            </Text>
            <FullTextLink
              label="conditions d’utilisation"
              spoken="Ouvrir les conditions d’utilisation"
              url={TERMS_URL}
            />
            <Text variant="subhead" color="text-secondary">
              et la
            </Text>
            <FullTextLink
              label="politique de confidentialité"
              spoken="Ouvrir la politique de confidentialité"
              url={PRIVACY_URL}
            />
            <Text variant="subhead" color="text-secondary">
              complètes.
            </Text>
          </View>
        </View>
      </ScrollView>
      <View
        style={{
          gap: 16,
          paddingTop: 16,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 12,
          borderTopWidth: border.hairline,
          borderTopColor: colors['border-subtle'],
          backgroundColor: colors['bg-surface'],
        }}
      >
        <Checkbox
          checked={accepted}
          onValueChange={setAccepted}
          label="J’ai lu et j’accepte les règles ci-dessus, les CGU et la politique de confidentialité."
        />
        <Button
          block
          label="Continuer"
          disabled={!accepted}
          loading={submitting}
          onPress={onContinue}
        />
      </View>
    </Screen>
  );
}

function FullTextLink({ label, spoken, url }: { label: string; spoken: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={spoken}
      hitSlop={{ top: 12, bottom: 12 }}
      onPress={() => Linking.openURL(url)}
    >
      <Text variant="subhead-strong" style={{ textDecorationLine: 'underline' }}>
        {label}
      </Text>
    </Pressable>
  );
}
