import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button, Chip, Popy, Screen, Text, TextField, TopBar, useTheme } from '@/design';
import { useToast } from '@/components/primitives';
import {
  PSEUDO_MAX,
  checkPseudoAvailability,
  generatePseudoSuggestions,
  type PseudoCheck,
} from '@/lib/pseudo';
import { pseudoLine } from '@/lib/pseudo-status';
import { userErrorMessage } from '@/lib/user-error-message';
import { errorFeedback } from '@/lib/haptics';
import { useSession } from '@/state/session';
import { useDraft } from '@/state/draft';
import { publishFirstBento } from '@/lib/bento-actions';
import { keptEmail } from '@/lib/account';
import { offerKeepAccount } from '@/lib/keep-offer';

/** Popy de la maquette, 104 de haut, posée 36 au-dessus du bouton. */
const POPY_SIZE = 104;
const POPY_GAP = 36;

/**
 * Le pseudo, demandé **au moment de publier**.
 *
 * Chantier 9. Cet écran était le troisième d'un parcours de quatre : on
 * exigeait un identifiant unique, avec vérification réseau, avant que
 * quiconque ait vu une case remplie. Mesuré le 16 septembre 2026 : 34 comptes
 * sur 61, soit 56 %, portent un pseudo et n'ont jamais rien publié. Chacun a
 * réservé une adresse que personne d'autre ne peut prendre, pour une boîte
 * que personne ne verra.
 *
 * Il arrive maintenant depuis le composer, six cases remplies, au tap sur
 * « Publier mon bento ». D'où le changement de nature : ce n'est plus une
 * étape d'un parcours, c'est la dernière chose à faire avant que le bento
 * soit public, et le libellé le dit.
 *
 * Au valider, `publish_first_bento` crée profil, bento, cases et publication
 * **en une transaction**. Ni profil orphelin si les cases échouent, ni cases
 * orphelines si la publication échoue.
 *
 * Refait au design au chantier 32 (`u01`), sa logique intacte (D16) : le
 * gabarit « Parcours » du guide, le champ préfixé « @ », l'état de la
 * vérification sous lui (D12), les suggestions en puces, Popy « intello » qui
 * se dandine. La publication réussie célèbre, une fois (D13) ; son échec passe
 * en toast, le pseudo restant saisi.
 */
export default function PseudoOnboarding() {
  const { size } = useTheme();
  const insets = useSafeAreaInsets();
  const [pseudo, setPseudo] = useState('');
  const [check, setCheck] = useState<PseudoCheck>({ status: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const userId = useSession((s) => s.user?.id);
  const refreshProfile = useSession((s) => s.refreshProfile);
  const draftSlots = useDraft((s) => s.slots);
  const termsAcceptedAt = useDraft((s) => s.termsAcceptedAt);
  const clearDraft = useDraft((s) => s.clear);
  const showToast = useToast((s) => s.show);

  // Debounce le check (350ms) pour ne pas spammer Supabase à chaque keystroke.
  useEffect(() => {
    if (pseudo.length === 0) {
      setCheck({ status: 'idle' });
      return;
    }
    setCheck({ status: 'checking' });
    const t = setTimeout(async () => {
      const result = await checkPseudoAvailability(pseudo);
      setCheck(result);
    }, 350);
    return () => clearTimeout(t);
  }, [pseudo]);

  // Suggestions générées à partir du début du pseudo tapé (sinon défaut "bento").
  const suggestions = useMemo(() => generatePseudoSuggestions(pseudo), [pseudo]);
  // Un pseudo pris propose le dernier, « _culture » : la phrase du guide.
  const line = pseudoLine(pseudo, check, suggestions[suggestions.length - 1]);

  const onValidate = async () => {
    if (check.status !== 'available' || !userId) return;
    const kept = keptEmail(useSession.getState().user) !== null;
    setSubmitting(true);
    // Chantier 18, D3 : un item attend encore, la base crée le bento marqué et
    // le publiera à la validation. Il n'est pas en ligne : pas de page
    // publique à ouvrir, on revient au composer, qui dit « Bientôt en ligne ».
    const aLaValidation = Object.values(draftSlots).some((slot) => slot?.pending);
    try {
      await publishFirstBento(pseudo, termsAcceptedAt, draftSlots);
      // Le brouillon a trouvé sa place en base : le garder ferait ressurgir
      // d'anciennes cases au prochain démarrage.
      clearDraft();
      await refreshProfile();
      if (aLaValidation) {
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/compose');
        showToast('Ton bento sortira dès la validation', { variant: 'success', durationMs: 3500 });
        // Chantier 28, D4 : un bento qui attend sa validation, c'est déjà
        // quelque chose à perdre. La feuille « Garde ton bento », une fois.
        void offerKeepAccount({ userId, kept, thenEditorial: false });
        return;
      }
      router.replace(`/u/${pseudo}` as const);
      // Chantier 17, D20 : juste après la première publication, l'accord pour
      // les éditions. Une seule fois par téléphone, et jamais bloquant.
      // Chantier 28, D11 : derrière la feuille « Garde ton bento », qui passe
      // d'abord ; l'accord suit sa fermeture. Chantier 32, D13 : la publication
      // célèbre, sur la feuille (`u02`), ou sur la page quand elle ne se propose pas.
      void offerKeepAccount({ userId, kept, thenEditorial: true, celebration: true });
    } catch (e) {
      console.warn('[publication] premier bento', e);
      errorFeedback();
      showToast(userErrorMessage('create-profile', e), { variant: 'danger', durationMs: 5000 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <TopBar onBack={() => router.back()} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {/* Tout défile au-dessus du bouton, qui reste en bas : à la plus grande
            police, le titre prenait l'écran, et le champ comme le bouton en
            sortaient. Tant que tout tient, Popy garde sa place en bas à droite ;
            quand le texte grossit, la page défile plutôt que de la poser sur
            les suggestions. */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            gap: 16,
            paddingHorizontal: size['screen-margin'],
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical={false}
        >
          {/* Plus de numéro d'étape : cet écran n'est plus dans un parcours, il
              est la dernière chose avant que le bento soit public. */}
          <View style={{ gap: 6 }}>
            <Text variant="eyebrow" color="text-secondary">
              Dernière étape
            </Text>
            <Text variant="title-1" accessibilityRole="header">
              Choisis ton pseudo.
            </Text>
            <Text variant="body-l" color="text-secondary">
              C’est l’adresse de ton bento. 3 à 20 caractères, lettres, chiffres, underscores.
            </Text>
          </View>

          <TextField
            value={pseudo}
            onChangeText={setPseudo}
            prefix="@"
            placeholder="ton_pseudo"
            accessibilityLabel="Pseudo"
            accessibilityHint="3 à 20 caractères, lettres, chiffres, underscores"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            maxLength={PSEUDO_MAX}
            // L'état de la vérification à la place de l'adresse (D12), le compteur à droite.
            helper={line.kind === 'helper' ? line.text : undefined}
            success={line.kind === 'success' ? line.text : undefined}
            error={line.kind === 'error' ? line.text : undefined}
            helperRight={`${pseudo.length} / ${PSEUDO_MAX}`}
          />

          <View style={{ gap: 10, marginTop: 6 }}>
            <Text variant="eyebrow" color="text-secondary">
              Suggestions populaires
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {suggestions.map((suggestion) => (
                <Chip
                  key={suggestion}
                  label={`@${suggestion}`}
                  accessibilityLabel={`Utiliser la suggestion ${suggestion}`}
                  onPress={() => setPseudo(suggestion)}
                />
              ))}
            </View>
          </View>

          {/* La place de Popy, réservée. */}
          <View
            style={{
              flexGrow: 1,
              minHeight: POPY_SIZE + POPY_GAP,
              justifyContent: 'flex-end',
              alignItems: 'flex-end',
              paddingBottom: POPY_GAP,
              paddingRight: 2,
            }}
          >
            <Popy mood="intello" size={POPY_SIZE} tilt={10} wiggle />
          </View>
        </ScrollView>

        <View
          style={{
            gap: 2,
            paddingHorizontal: size['screen-margin'],
            paddingBottom: insets.bottom,
          }}
        >
          <Button
            block
            label="Publier mon bento"
            loading={submitting}
            disabled={check.status !== 'available' || submitting}
            onPress={() => void onValidate()}
          />
          {/* Chantier 28 : un compte gardé ailleurs se retrouve ici, avant d'en
              publier un second. */}
          <View style={{ alignItems: 'center' }}>
            <Button
              variant="tertiary"
              size="md"
              label="J’ai déjà un compte"
              disabled={submitting}
              onPress={() => router.push('/account/sign-in')}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
