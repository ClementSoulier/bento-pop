import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import popyIntello from '@bento-pop/brand/assets/mascot/popy-intello.png';
import {
  CONTENT_MAX_FONT_MULTIPLIER,
  CONTROL_MAX_FONT_MULTIPLIER,
} from '@/components/bento/font-scaling';
import { INK_MUTED, INK_PLACEHOLDER, PageTitle, StampButton, YellowBg } from '@/components/primitives';
import { SHADOWS } from '@/components/primitives/shadow';
import {
  PSEUDO_MAX,
  checkPseudoAvailability,
  generatePseudoSuggestions,
  type PseudoCheck,
} from '@/lib/pseudo';
import { supabase } from '@/supabase/client';
import { userErrorMessage } from '@/lib/user-error-message';
import { useSession } from '@/state/session';

/**
 * Onboarding 02 — Choix du pseudo. Input avec preview URL + check de
 * disponibilité débouncé sur Supabase + suggestions populaires. Au valider,
 * crée la ligne `public.users` liée à `auth.uid()`.
 *
 * Cf. design Claude Design — `PseudoScreen` dans `screens.jsx`.
 */
export default function PseudoOnboarding() {
  const [pseudo, setPseudo] = useState('');
  const [check, setCheck] = useState<PseudoCheck>({ status: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const userId = useSession((s) => s.user?.id);
  const refreshProfile = useSession((s) => s.refreshProfile);

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

  const onValidate = async () => {
    if (check.status !== 'available' || !userId) return;
    setSubmitting(true);
    // `terms_accepted_at` est posé en même temps que l'INSERT — l'utilisateur
    // ne peut atteindre cet écran qu'après avoir validé l'écran /onboarding/terms.
    const { error } = await supabase
      .from('users')
      .insert({ id: userId, pseudo, terms_accepted_at: new Date().toISOString() });
    setSubmitting(false);
    if (error) {
      console.warn('[accueil] création du profil', error);
      Alert.alert('Oups', userErrorMessage('create-profile', error));
      return;
    }
    await refreshProfile();
    router.push('/onboarding/mechanics');
  };

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingTop: 24, paddingBottom: 16 }}>
          {/* Tout défile au-dessus du bouton, qui reste en bas : à la plus grande
              police, le titre prenait l'écran, et le champ comme le bouton en
              sortaient. Tant que tout tient, `flexGrow` garde la mise en page
              d'avant, le Popy en bas à droite. */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            alwaysBounceVertical={false}
          >
            <PageTitle
              kicker="ÉTAPE 2 / 3"
              title="Choisis ton pseudo."
              sub="C'est l'adresse de ton bento. 3 à 20 caractères, lettres, chiffres, underscores."
            />

            {/* Input pseudo + statut */}
            <View style={{ marginTop: 32, paddingHorizontal: 20 }}>
              <View
                style={[
                  {
                    backgroundColor: '#ffffff',
                    borderWidth: 3,
                    borderColor: '#0a0a0a',
                    borderRadius: 16,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  },
                  SHADOWS.stamp,
                ]}
              >
                <Text
                  maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
                  style={{ fontFamily: 'Bungee', fontSize: 18, color: INK_PLACEHOLDER }}
                >
                  @
                </Text>
                <TextInput
                  value={pseudo}
                  onChangeText={setPseudo}
                  placeholder="ton_pseudo"
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  maxLength={PSEUDO_MAX}
                  accessibilityLabel="Pseudo"
                  accessibilityHint="3 à 20 caractères, lettres, chiffres, underscores"
                  maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
                  style={{
                    fontFamily: 'Extenda',
                    fontSize: 24,
                    flex: 1,
                    paddingVertical: 0,
                    color: '#0a0a0a',
                    textTransform: 'lowercase',
                  }}
                />
                <StatusBadge check={check} />
              </View>

              {/* L'adresse cède la place au compteur : à la taille 2,0 d'Android, les
                  deux se chevauchaient, « ton_pseudo0 / 20 ». */}
              <View
                style={{
                  marginTop: 12,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <Text
                  numberOfLines={1}
                  maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
                  style={{ fontSize: 12, color: 'rgba(10,10,10,0.6)', flexShrink: 1 }}
                >
                  bento-pop.com/u/<Text style={{ fontWeight: '700' }}>{pseudo || 'ton_pseudo'}</Text>
                </Text>
                <Text
                  maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
                  style={{ fontSize: 12, color: 'rgba(10,10,10,0.6)' }}
                >
                  {pseudo.length} / {PSEUDO_MAX}
                </Text>
              </View>
            </View>

            {/* Suggestions */}
            <View style={{ marginTop: 28, paddingHorizontal: 20 }}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
                style={{
                  fontFamily: 'Bungee',
                  fontSize: 10,
                  letterSpacing: 2,
                  color: INK_MUTED,
                  marginBottom: 10,
                  textTransform: 'uppercase',
                }}
              >
                Suggestions populaires
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {suggestions.map((s, i) => (
                  <Pressable
                    key={s}
                    onPress={() => setPseudo(s)}
                    accessibilityRole="button"
                    accessibilityLabel={`Utiliser la suggestion ${s}`}
                    // La puce fait 31 pt de haut : la cible tactile en fait 44.
                    hitSlop={{ top: 7, bottom: 7 }}
                    style={[
                      {
                        backgroundColor: '#ffffff',
                        borderWidth: 2,
                        borderColor: '#0a0a0a',
                        borderRadius: 999,
                        paddingHorizontal: 12,
                        paddingVertical: 5,
                        transform: [{ rotate: `${[-1, 0.5, -0.5, 1, -0.3][i] ?? 0}deg` }],
                      },
                      SHADOWS.stamp,
                    ]}
                  >
                    <Text
                      maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
                      style={{ fontSize: 13, fontWeight: '600' }}
                    >
                      @{s}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Popy peek. Sa hauteur est réservée : quand le texte grossit, la page
                défile au lieu de poser la mascotte sur les suggestions. */}
            <View style={{ flex: 1, minHeight: 130, position: 'relative' }}>
              <Image
                source={popyIntello}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: -20,
                  width: 130,
                  height: 130,
                  transform: [{ rotate: '8deg' }],
                }}
                resizeMode="contain"
              />
            </View>
          </ScrollView>

          <View style={{ paddingHorizontal: 20 }}>
            <StampButton
              wide
              disabled={check.status !== 'available' || submitting}
              onPress={onValidate}
            >
              {submitting ? 'Création…' : 'Valider mon pseudo'}
            </StampButton>
          </View>
        </View>
      </SafeAreaView>
    </YellowBg>
  );
}

function StatusBadge({ check }: { check: PseudoCheck }) {
  if (check.status === 'idle') return null;
  if (check.status === 'checking') {
    return <ActivityIndicator size="small" color={INK_MUTED} />;
  }
  const color =
    check.status === 'available'
      ? '#2ec4b6'
      : check.status === 'taken' || check.status === 'reserved'
      ? '#e63946'
      : '#d97706';
  const label =
    check.status === 'available'
      ? 'Libre'
      : check.status === 'taken'
      ? 'Pris'
      : check.status === 'reserved'
      ? 'Réservé'
      : check.status === 'too-short'
      ? 'Trop court'
      : check.status === 'too-long'
      ? 'Trop long'
      : check.status === 'invalid'
      ? 'Invalide'
      : 'Erreur';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text
        maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
        style={{ fontSize: 12, fontWeight: '600', color }}
      >
        {label}
      </Text>
    </View>
  );
}
