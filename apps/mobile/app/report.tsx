import { useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  CONTENT_MAX_FONT_MULTIPLIER,
  CONTROL_MAX_FONT_MULTIPLIER,
  fontScaleFor,
  scaledType,
} from '@/components/bento/font-scaling';
import { AccountError } from '@/components/account/AccountParts';
import { INK_MUTED, INK_PLACEHOLDER, StampButton } from '@/components/primitives';
import { radioA11y } from '@/lib/a11y-states';
import {
  REPORT_DETAILS_MAX_LENGTH,
  REPORT_REASONS,
  socialErrorKey,
  socialErrorMessage,
} from '@/lib/social';
import { submitReport } from '@/lib/social-actions';
import { supabase } from '@/supabase/client';
import type { ReportReason, ReportTargetKind } from '@/supabase/types';

const INK = '#0a0a0a';

type Kind = Extract<ReportTargetKind, 'comment' | 'account' | 'bento' | 'why'>;

const TITLES: Record<Kind, (pseudo: string) => string> = {
  comment: (pseudo) => `Signaler le commentaire de @${pseudo}`,
  account: (pseudo) => `Signaler @${pseudo}`,
  bento: (pseudo) => `Signaler le bento de @${pseudo}`,
  why: (pseudo) => `Signaler un pourquoi de @${pseudo}`,
};

/**
 * « Signaler », chantier 22 (§5.4, D10) : un commentaire, un compte ou un
 * bento, et depuis le chantier 12 un pourquoi (D8), un motif parmi six, un
 * détail facultatif. Une alerte système ne
 * suffit pas : Android n'y affiche que trois boutons.
 *
 * Ouvert par `router.push('/report', { kind, id, pseudo })`. La cible se lit
 * en base (`submit_report`), jamais depuis ces paramètres : ils ne servent
 * qu'au titre.
 *
 * **Le merci se dit ici**, avant de fermer : un toast vit sous la pile, et
 * ouvert depuis les commentaires, cet écran revient à un autre écran modal,
 * qui le cachait. Relevé à la recette du lot 3.
 */
export default function ReportScreen() {
  const params = useLocalSearchParams<{ kind: string; id: string; pseudo?: string }>();
  const kind = (['comment', 'account', 'bento', 'why'] as const).find((k) => k === params.kind) ?? 'bento';
  const { fontScale } = useWindowDimensions();
  const [sent, setSent] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!reason || busy || !params.id) return;
    setBusy(true);
    setError(null);
    try {
      await submitReport(supabase, { kind, targetId: params.id, reason, details });
      setSent(true);
      AccessibilityInfo.announceForAccessibility(
        "Merci. L'équipe regarde ton signalement sous 24 heures.",
      );
    } catch (e) {
      // Un refus attendu (filtre, rythme, droits) se dit à l'écran ; seul
      // l'inattendu se journalise.
      if (!socialErrorKey(e)) console.warn('[signalement]', e);
      setError(socialErrorMessage(e));
      setBusy(false);
    }
  };

  const text = (size: number, line: number) =>
    scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, size, line);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fbf3de' }} edges={['top', 'bottom']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 8,
          gap: 12,
        }}
      >
        <Text
          accessibilityRole="header"
          allowFontScaling={false}
          numberOfLines={2}
          style={{
            flex: 1,
            fontFamily: 'Bungee',
            fontSize: 18 * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER),
            lineHeight: 24 * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER),
            color: INK,
          }}
        >
          {TITLES[kind](params.pseudo ?? '')}
        </Text>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
          hitSlop={8}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            borderWidth: 2.5,
            borderColor: INK,
            backgroundColor: '#ffffff',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text allowFontScaling={false} style={{ fontSize: 16, fontWeight: '800', color: INK }}>
            ✕
          </Text>
        </Pressable>
      </View>

      {sent ? (
        <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24, gap: 12 }}>
          <Text
            accessibilityRole="header"
            allowFontScaling={false}
            style={{ ...text(22, 28), color: INK, fontWeight: '800' }}
          >
            Merci.
          </Text>
          <Text allowFontScaling={false} style={{ ...text(15, 21), color: INK }}>
            L'équipe regarde ton signalement sous 24 h. Si ce qui est signalé enfreint les règles,
            il est retiré.
          </Text>
          <View style={{ marginTop: 16 }}>
            <StampButton wide onPress={() => router.back()}>
              Fermer
            </StampButton>
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 10 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <Text allowFontScaling={false} style={{ ...text(15, 21), color: INK, marginBottom: 6 }}>
            Pourquoi ? L'équipe regarde chaque signalement sous 24 h.
          </Text>

          <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
            {REPORT_REASONS.map((r) => {
              const selected = reason === r.code;
              const choice = radioA11y(selected, Platform.OS);
              return (
                <Pressable
                  key={r.code}
                  onPress={() => {
                    setReason(r.code);
                    setError(null);
                  }}
                  accessibilityRole={choice.role}
                  accessibilityState={choice.state}
                  accessibilityLabel={r.label}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    minHeight: 48,
                    paddingHorizontal: 14,
                    borderWidth: 2.5,
                    borderColor: INK,
                    borderRadius: 16,
                    backgroundColor: selected ? '#ffd857' : '#ffffff',
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      borderWidth: 2.5,
                      borderColor: INK,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {selected ? (
                      <View
                        style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: INK }}
                      />
                    ) : null}
                  </View>
                  <Text
                    allowFontScaling={false}
                    style={{ flex: 1, ...text(15, 20), color: INK, fontWeight: '700' }}
                  >
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text
            allowFontScaling={false}
            style={{ ...text(13, 18), color: INK_MUTED, marginTop: 12, fontWeight: '600' }}
          >
            Un détail, si tu veux
          </Text>
          <TextInput
            value={details}
            onChangeText={(value) => setDetails(value.slice(0, REPORT_DETAILS_MAX_LENGTH))}
            placeholder="Ce qui s'est passé"
            placeholderTextColor={INK_PLACEHOLDER}
            accessibilityLabel="Un détail, si tu veux"
            multiline
            maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
            style={{
              minHeight: 88,
              borderWidth: 2.5,
              borderColor: INK,
              borderRadius: 16,
              backgroundColor: '#ffffff',
              paddingHorizontal: 14,
              paddingTop: 12,
              paddingBottom: 12,
              fontSize: 15,
              color: INK,
              textAlignVertical: 'top',
            }}
          />

          <AccountError message={error} />

          <View style={{ marginTop: 16 }}>
            <StampButton wide disabled={!reason || busy} onPress={() => void send()}>
              {busy ? 'Envoi…' : 'Envoyer'}
            </StampButton>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
