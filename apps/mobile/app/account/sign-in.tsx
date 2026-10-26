import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StampButton, YellowBg, useToast } from '@/components/primitives';
import {
  AccountError,
  AccountText,
  AccountTitle,
  AccountTopBar,
  CodeField,
  EmailField,
  TextButton,
  useResendCountdown,
} from '@/components/account/AccountParts';
import { accountErrorMessage, isCompleteCode, isValidEmail, keptEmail, maskEmail, normalizeEmail } from '@/lib/account';
import { requestSignInCode } from '@/lib/account-actions';
import { signInWithCode } from '@/state/account-flow';
import { useDraft } from '@/state/draft';
import { useSession } from '@/state/session';
import { supabase } from '@/supabase/client';

type Step = 'warning' | 'email' | 'code';

/**
 * « J'ai déjà un compte », chantier 28 (D2, D9) : retrouver un compte gardé
 * depuis un autre téléphone, ou après une réinstallation. Ouvert depuis
 * l'accueil, l'écran du pseudo et Réglages.
 *
 * Ce téléphone a déjà un compte, créé à son lancement. Vide, il est effacé
 * à la bascule (D2), et seul le brouillon est à perdre, ce que l'écran dit.
 * S'il a déjà publié, il ne s'abandonne pas en silence (D9) : on le garde
 * d'abord avec une autre adresse, ou on le supprime en connaissance de cause.
 * Rien ne s'efface avant que le code soit juste.
 */
export default function SignInScreen() {
  const showToast = useToast((s) => s.show);
  const profile = useSession((s) => s.profile);
  const user = useSession((s) => s.user);
  const hasDraft = useDraft((s) => Object.values(s.slots).some(Boolean));

  // Un compte gardé ne se perd pas en en retrouvant un autre : il se
  // retrouvera de son code. L'avertissement de D9 ne vaut que pour un anonyme.
  const [step, setStep] = useState<Step>(profile && keptEmail(user) === null ? 'warning' : 'email');
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wait = useResendCountdown(sentAt);

  const confirmDelete = () => {
    Alert.alert(
      `Supprimer @${profile?.pseudo ?? ''} ?`,
      'Son pseudo, ses bentos et ses propositions seront effacés au moment où tu retrouveras ton autre compte. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer et continuer', style: 'destructive', onPress: () => setStep('email') },
      ],
    );
  };

  const send = async (target: string) => {
    const normalized = normalizeEmail(target);
    if (!isValidEmail(normalized)) {
      setError(accountErrorMessage({ code: 'email_address_invalid' }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestSignInCode(supabase, normalized);
      setSentTo(normalized);
      setSentAt(Date.now());
      setCode('');
      setStep('code');
    } catch (e) {
      console.warn('[compte] reconnexion, envoi du code', e);
      setError(accountErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (value: string) => {
    if (!sentTo || !isCompleteCode(value)) return;
    setBusy(true);
    setError(null);
    try {
      // Un compte gardé ne s'efface jamais par ici : seul celui de ce
      // téléphone, anonyme, vide ou supprimé en connaissance de cause.
      await signInWithCode(sentTo, value, { dropCurrent: keptEmail(user) === null });
      showToast('Compte retrouvé', { variant: 'success' });
      router.replace('/');
    } catch (e) {
      console.warn('[compte] reconnexion, vérification du code', e);
      setError(accountErrorMessage(e));
      setBusy(false);
    }
  };

  const onCode = (value: string) => {
    setCode(value);
    setError(null);
    if (isCompleteCode(value)) void confirm(value);
  };

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1 }}>
        <AccountTopBar fallback="/" />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {step === 'warning' ? (
            <>
              <AccountTitle>J'ai déjà un compte</AccountTitle>
              <AccountText>
                Le compte de ce téléphone, @{profile?.pseudo}, a déjà publié. Si tu retrouves ton autre
                compte, celui-ci sera perdu.
              </AccountText>
              <AccountText muted>
                Garde-le d'abord avec une autre adresse : tu pourras passer de l'un à l'autre.
              </AccountText>
              <View style={{ marginTop: 28 }}>
                <StampButton wide onPress={() => router.replace('/account/keep')}>
                  Le garder d'abord
                </StampButton>
              </View>
              <TextButton label="Le supprimer et continuer" onPress={confirmDelete} />
            </>
          ) : step === 'email' ? (
            <>
              <AccountTitle>J'ai déjà un compte</AccountTitle>
              <AccountText>Saisis l'adresse qui garde ton compte. On t'y envoie un code.</AccountText>
              <EmailField
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setError(null);
                }}
                onSubmit={() => void send(email)}
                editable={!busy}
              />
              <AccountError message={error} />
              {hasDraft && !profile && keptEmail(user) === null ? (
                <AccountText muted>Le brouillon de ce téléphone sera remplacé par ton compte.</AccountText>
              ) : null}
              <View style={{ marginTop: 28 }}>
                <StampButton wide disabled={busy || email.trim() === ''} onPress={() => void send(email)}>
                  {busy ? 'Envoi…' : 'Recevoir un code'}
                </StampButton>
              </View>
            </>
          ) : (
            <>
              <AccountTitle>Ton code</AccountTitle>
              <AccountText>Code envoyé à {sentTo ? maskEmail(sentTo) : ''}. Il est valable une heure.</AccountText>
              <CodeField value={code} onChangeText={onCode} editable={!busy} />
              <AccountError message={error} />
              <View style={{ marginTop: 28 }}>
                <StampButton wide disabled={busy || !isCompleteCode(code)} onPress={() => void confirm(code)}>
                  {busy ? 'Connexion…' : 'Retrouver mon compte'}
                </StampButton>
              </View>
              <TextButton
                label={wait > 0 ? `Renvoyer le code dans ${wait} s` : 'Renvoyer le code'}
                disabled={busy || wait > 0 || !sentTo}
                onPress={() => sentTo && void send(sentTo)}
              />
              <TextButton
                label="Changer d'adresse"
                disabled={busy}
                onPress={() => {
                  setStep('email');
                  setSentTo(null);
                  setSentAt(null);
                  setCode('');
                  setError(null);
                }}
              />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </YellowBg>
  );
}
