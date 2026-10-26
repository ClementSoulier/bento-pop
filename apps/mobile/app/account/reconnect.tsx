import { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StampButton, YellowBg, useToast } from '@/components/primitives';
import {
  AccountError,
  AccountText,
  AccountTitle,
  CodeField,
  TextButton,
  useResendCountdown,
} from '@/components/account/AccountParts';
import { accountErrorMessage, isCompleteCode, maskEmail } from '@/lib/account';
import { requestSignInCode } from '@/lib/account-actions';
import { signInWithCode } from '@/state/account-flow';
import { useSession } from '@/state/session';
import { supabase } from '@/supabase/client';

/**
 * « Reconnecte-toi », chantier 28 (D6) : la session d'un compte gardé a été
 * refusée pour de bon, et l'app ne crée pas de compte neuf à la place.
 * L'adresse est connue, rangée sur l'appareil : un code suffit.
 *
 * « Continuer sans compte » ouvre l'app sur un compte anonyme neuf. Le compte
 * gardé n'est pas perdu : « J'ai déjà un compte » le retrouvera.
 */
export default function ReconnectScreen() {
  const showToast = useToast((s) => s.show);
  const lost = useSession((s) => s.lostAccount);
  const continueWithoutAccount = useSession((s) => s.continueWithoutAccount);
  const email = lost?.email ?? null;

  const [sentAt, setSentAt] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wait = useResendCountdown(sentAt);

  // Plus rien à retrouver : la session est revenue, ou on a continué sans.
  useEffect(() => {
    if (!email && !busy) router.replace('/');
  }, [email, busy]);

  if (!email) return <YellowBg>{null}</YellowBg>;

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await requestSignInCode(supabase, email);
      setSentAt(Date.now());
      setCode('');
    } catch (e) {
      console.warn('[compte] reconnecte-toi, envoi du code', e);
      setError(accountErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (value: string) => {
    if (!isCompleteCode(value)) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithCode(email, value, { dropCurrent: false });
      showToast('Compte retrouvé', { variant: 'success' });
      router.replace('/');
    } catch (e) {
      console.warn('[compte] reconnecte-toi, vérification du code', e);
      setError(accountErrorMessage(e));
      setBusy(false);
    }
  };

  const onCode = (value: string) => {
    setCode(value);
    setError(null);
    if (isCompleteCode(value)) void confirm(value);
  };

  const withoutAccount = () => {
    Alert.alert(
      'Continuer sans compte ?',
      `Ton compte reste gardé. Pour le retrouver plus tard : Réglages, puis « J'ai déjà un compte », avec ${maskEmail(email)}.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Continuer',
          onPress: async () => {
            await continueWithoutAccount();
            router.replace('/');
          },
        },
      ],
    );
  };

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 44, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <AccountTitle>Reconnecte-toi</AccountTitle>
          {sentAt === null ? (
            <>
              <AccountText>
                Ta session a expiré sur ce téléphone. Reçois un code à {maskEmail(email)} pour retrouver ton
                compte.
              </AccountText>
              <AccountError message={error} />
              <View style={{ marginTop: 28 }}>
                <StampButton wide disabled={busy} onPress={() => void send()}>
                  {busy ? 'Envoi…' : 'Recevoir un code'}
                </StampButton>
              </View>
            </>
          ) : (
            <>
              <AccountText>Code envoyé à {maskEmail(email)}. Il est valable une heure.</AccountText>
              <CodeField value={code} onChangeText={onCode} editable={!busy} />
              <AccountError message={error} />
              <View style={{ marginTop: 28 }}>
                <StampButton wide disabled={busy || !isCompleteCode(code)} onPress={() => void confirm(code)}>
                  {busy ? 'Connexion…' : 'Retrouver mon compte'}
                </StampButton>
              </View>
              <TextButton
                label={wait > 0 ? `Renvoyer le code dans ${wait} s` : 'Renvoyer le code'}
                disabled={busy || wait > 0}
                onPress={() => void send()}
              />
            </>
          )}
          <TextButton label="Continuer sans compte" disabled={busy} onPress={withoutAccount} />
        </ScrollView>
      </SafeAreaView>
    </YellowBg>
  );
}
