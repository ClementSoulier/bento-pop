import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
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
import {
  accountError,
  accountErrorMessage,
  isCompleteCode,
  isValidEmail,
  keptEmail,
  maskEmail,
  normalizeEmail,
} from '@/lib/account';
import { confirmKeepCode, requestKeepCode } from '@/lib/account-actions';
import { releaseEditorialOffer } from '@/lib/keep-offer';
import { useSession } from '@/state/session';
import { supabase } from '@/supabase/client';

/**
 * Garder son compte, chantier 28 (D1, D7) : une adresse, puis le code reçu à
 * cette adresse. Le compte reste anonyme jusqu'au code juste, et son
 * identifiant ne change jamais : pseudo, bentos et propositions restent les
 * siens. Ouvert depuis Réglages, ou depuis la feuille qui suit la première
 * publication (D4).
 *
 * Une adresse déjà gardée par un autre compte est refusée par la base ; la
 * phrase propose alors « J'ai déjà un compte ».
 */
export default function KeepAccountScreen() {
  const showToast = useToast((s) => s.show);
  // Déjà gardé, par un lien profond : une autre adresse serait un changement
  // d'adresse, hors du chantier (D15). L'écran le dit, sans rien envoyer.
  const alreadyKept = useSession((s) => keptEmail(s.user));
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; taken: boolean } | null>(null);
  const wait = useResendCountdown(sentAt);

  // D11 : quitter cet écran, gardé ou non, laisse passer l'accord des éditions
  // qui attendait derrière la feuille.
  useEffect(() => releaseEditorialOffer, []);

  const send = async (target: string) => {
    const normalized = normalizeEmail(target);
    if (!isValidEmail(normalized)) {
      setError({ message: accountErrorMessage({ code: 'email_address_invalid' }), taken: false });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestKeepCode(supabase, normalized);
      setSentTo(normalized);
      setSentAt(Date.now());
      setCode('');
    } catch (e) {
      console.warn('[compte] garder, envoi du code', e);
      setError({ message: accountErrorMessage(e), taken: accountError(e) === 'email-taken' });
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (value: string) => {
    if (!sentTo || !isCompleteCode(value)) return;
    setBusy(true);
    setError(null);
    try {
      await confirmKeepCode(supabase, sentTo, value);
      showToast('Compte gardé', { variant: 'success' });
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/profile');
    } catch (e) {
      console.warn('[compte] garder, vérification du code', e);
      setError({ message: accountErrorMessage(e), taken: false });
      setBusy(false);
    }
  };

  // Le code se vérifie de lui-même au sixième chiffre, collé ou rempli par le
  // système compris.
  const onCode = (value: string) => {
    setCode(value);
    setError(null);
    if (isCompleteCode(value)) void confirm(value);
  };

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1 }}>
        <AccountTopBar />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {alreadyKept && sentTo === null ? (
            <>
              <AccountTitle>Compte gardé</AccountTitle>
              <AccountText>
                Ton compte est déjà gardé avec {maskEmail(alreadyKept)}. Un code à cette adresse suffit pour
                le retrouver.
              </AccountText>
            </>
          ) : sentTo === null ? (
            <>
              <AccountTitle>Garde ton compte</AccountTitle>
              <AccountText>
                Ajoute ton adresse email. Si tu changes de téléphone ou réinstalles l'app, un code suffira
                pour retrouver ton pseudo et tes bentos.
              </AccountText>
              <EmailField
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setError(null);
                }}
                onSubmit={() => void send(email)}
                editable={!busy}
              />
              <AccountError message={error?.message ?? null} />
              {error?.taken ? (
                <TextButton label="J'ai déjà un compte" onPress={() => router.replace('/account/sign-in')} />
              ) : null}
              <AccountText muted>Ton adresse ne sert qu'à ça. Elle n'est jamais affichée ni partagée.</AccountText>
              <View style={{ marginTop: 28 }}>
                <StampButton wide disabled={busy || email.trim() === ''} onPress={() => void send(email)}>
                  {busy ? 'Envoi…' : 'Recevoir un code'}
                </StampButton>
              </View>
            </>
          ) : (
            <>
              <AccountTitle>Ton code</AccountTitle>
              <AccountText>Code envoyé à {maskEmail(sentTo)}. Il est valable une heure.</AccountText>
              <CodeField value={code} onChangeText={onCode} editable={!busy} />
              <AccountError message={error?.message ?? null} />
              <View style={{ marginTop: 28 }}>
                <StampButton wide disabled={busy || !isCompleteCode(code)} onPress={() => void confirm(code)}>
                  {busy ? 'Vérification…' : 'Garder mon compte'}
                </StampButton>
              </View>
              <TextButton
                label={wait > 0 ? `Renvoyer le code dans ${wait} s` : 'Renvoyer le code'}
                disabled={busy || wait > 0}
                onPress={() => void send(sentTo)}
              />
              <TextButton
                label="Changer d'adresse"
                disabled={busy}
                onPress={() => {
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
