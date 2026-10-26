import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { filledCaseLabel } from '@bento-pop/supabase-mobile/bento';
import {
  CONTENT_MAX_FONT_MULTIPLIER,
  CONTROL_MAX_FONT_MULTIPLIER,
  fontScaleFor,
  scaledType,
} from '@/components/bento/font-scaling';
import { AccountError } from '@/components/account/AccountParts';
import { INK_MUTED, INK_PLACEHOLDER, StampButton } from '@/components/primitives';
import { publicBentoQueryKey, publicBentoQueryOptions } from '@/lib/public-bento-query';
import { setWhy } from '@/lib/why-actions';
import {
  WHY_WARN_REMAINING,
  canSaveWhy,
  changedWhys,
  whyErrorKey,
  whyErrorMessage,
  whyRemaining,
} from '@/lib/whys';
import { useAppStatus } from '@/state/app-status';
import { useOwnWhys } from '@/state/own-whys';
import { publicSupabase, supabase } from '@/supabase/client';

const INK = '#0a0a0a';

/**
 * « Tes pourquoi », chantier 12 (§5.2, D2) : une ligne par case remplie de
 * son bento, un champ d'une phrase. Ouvert depuis sa page, par l'invitation
 * ou par « Modifier ».
 *
 * Les cases et leurs items viennent de la page déjà lue, par le même cache ;
 * les pourquoi, de `my_bento_whys`, masqués compris. « Enregistrer » n'envoie
 * que ce qui a changé ; un refus se dit sous son champ, les autres
 * s'enregistrent quand même.
 *
 * `KeyboardAvoidingView` en `padding` sur les deux plateformes : l'affichage
 * bord à bord du SDK 57 ne redimensionne plus la fenêtre sous le clavier,
 * relevé au 22.
 */
export default function WhysScreen() {
  const params = useLocalSearchParams<{ bentoId: string; pseudo: string; slug?: string }>();
  const bentoId = params.bentoId;
  const pseudo = params.pseudo ?? '';
  const slug = params.slug ? params.slug : null;
  const { fontScale } = useWindowDimensions();
  const queryClient = useQueryClient();
  const enabled = useAppStatus((s) => s.config?.whysEnabled ?? true);

  const page = useQuery(publicBentoQueryOptions(publicSupabase, pseudo, slug));
  const bento = page.data?.bento?.id === bentoId ? page.data.bento : null;
  const own = useOwnWhys((s) => s.byBento[bentoId]);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const inputs = useRef<Record<string, TextInput | null>>({});
  const seeded = useRef(false);

  useEffect(() => {
    void useOwnWhys.getState().load(bentoId);
  }, [bentoId]);

  // Les champs partent de ce que la base garde, une fois lu.
  useEffect(() => {
    if (seeded.current || own === undefined) return;
    seeded.current = true;
    setDrafts(Object.fromEntries(Object.entries(own).map(([key, why]) => [key, why?.body ?? ''])));
  }, [own]);

  const filled = bento ? bento.cases.filter((c) => bento.slots[c.key]) : [];
  const before = Object.fromEntries(Object.entries(own ?? {}).map(([key, why]) => [key, why?.body ?? '']));
  const changes = changedWhys(before, drafts);
  const invalid = Object.values(drafts).some((draft) => !canSaveWhy(draft));
  const canSave = !busy && seeded.current && changes.length > 0 && !invalid;

  const save = async () => {
    if (!canSave) return;
    Keyboard.dismiss();
    setBusy(true);
    const next: Record<string, string | null> = {};
    for (const { caseKey, body } of changes) {
      try {
        const row = await setWhy(supabase, bentoId, caseKey, body);
        useOwnWhys.getState().put(
          bentoId,
          caseKey,
          row ? { body: row.body, hidden: row.status === 'hidden', hiddenReason: row.hidden_reason } : null,
        );
        next[caseKey] = null;
      } catch (e) {
        // Un refus attendu (filtre, rythme) se dit sous son champ ; seul
        // l'inattendu se journalise.
        if (!whyErrorKey(e)) console.warn('[pourquoi] écriture', e);
        next[caseKey] = whyErrorMessage(e);
      }
    }
    setErrors(next);
    setBusy(false);
    // Les pourquoi visibles de tous se relisent avec la page.
    void queryClient.invalidateQueries({ queryKey: publicBentoQueryKey(pseudo, slug) });
    if (Object.values(next).every((error) => error === null)) {
      AccessibilityInfo.announceForAccessibility('Tes pourquoi sont enregistrés.');
      router.back();
    }
  };

  const titleSize = 28 * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER);
  const body = scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 15, 21);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fbf3de' }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 8,
          }}
        >
          <Text
            accessibilityRole="header"
            allowFontScaling={false}
            numberOfLines={1}
            style={{ fontFamily: 'Bungee', fontSize: titleSize * 0.7, lineHeight: titleSize * 0.9, color: INK }}
          >
            Tes pourquoi
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

        {!enabled ? (
          <Notice text="Les pourquoi sont fermés pour le moment." />
        ) : page.isError ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
            <Text allowFontScaling={false} style={{ ...body, color: INK, textAlign: 'center' }}>
              Ton bento n'a pas pu se charger.
            </Text>
            <StampButton onPress={() => void page.refetch()}>Réessayer</StampButton>
          </View>
        ) : !bento || own === undefined ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={INK} accessibilityLabel="Chargement de tes pourquoi" />
          </View>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, gap: 22 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text allowFontScaling={false} style={{ ...body, color: INK }}>
                {/* Trait d'union insécable : « bento-pop.com » se coupait en fin de ligne. */}
                Une phrase par case, pour dire pourquoi ce choix. Elle se lit sous ta boîte, dans
                l'app et sur bento‑pop.com.
              </Text>
              {filled.map((c, index) => {
                const draft = drafts[c.key] ?? '';
                const hidden = own[c.key]?.hidden && draft === (own[c.key]?.body ?? '');
                const last = index === filled.length - 1;
                return (
                  <View key={c.key}>
                    <Text
                      allowFontScaling={false}
                      numberOfLines={2}
                      style={{
                        fontFamily: 'Bungee',
                        fontSize: 10 * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER),
                        letterSpacing: 1,
                        color: INK_MUTED,
                        textTransform: 'uppercase',
                      }}
                    >
                      {filledCaseLabel(c)}
                    </Text>
                    <Text allowFontScaling={false} style={{ ...body, color: INK, fontWeight: '800', marginBottom: 8 }}>
                      {bento.slots[c.key]?.title}
                    </Text>
                    <TextInput
                      ref={(node) => {
                        inputs.current[c.key] = node;
                      }}
                      value={draft}
                      onChangeText={(value) => {
                        // Une ligne : un saut collé devient un espace, comme en base.
                        setDrafts((d) => ({ ...d, [c.key]: value.replace(/\n/g, ' ') }));
                        setErrors((e) => ({ ...e, [c.key]: null }));
                      }}
                      placeholder="Pourquoi ce choix ?"
                      placeholderTextColor={INK_PLACEHOLDER}
                      accessibilityLabel={`Pourquoi, ${c.prompt}`}
                      multiline
                      submitBehavior="submit"
                      returnKeyType={last ? 'done' : 'next'}
                      onSubmitEditing={() => {
                        const following = filled[index + 1];
                        if (following) inputs.current[following.key]?.focus();
                        else Keyboard.dismiss();
                      }}
                      editable={!busy}
                      maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
                      style={{
                        minHeight: 44,
                        borderWidth: 2.5,
                        borderColor: INK,
                        borderRadius: 18,
                        backgroundColor: '#ffffff',
                        paddingHorizontal: 14,
                        paddingTop: 11,
                        paddingBottom: 11,
                        fontSize: 15,
                        color: INK,
                      }}
                    />
                    <Remaining text={draft} />
                    {hidden ? (
                      <Text
                        allowFontScaling={false}
                        style={{
                          marginTop: 6,
                          ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 13, 18),
                          color: INK,
                          fontWeight: '700',
                        }}
                      >
                        Masqué par l'équipe
                        {own[c.key]?.hiddenReason ? ` · ${own[c.key]?.hiddenReason}` : ''}. Réécris-le
                        pour qu'il revienne.
                      </Text>
                    ) : null}
                    <AccountError message={errors[c.key] ?? null} />
                  </View>
                );
              })}
            </ScrollView>
            <View
              style={{
                borderTopWidth: 2,
                borderTopColor: 'rgba(10,10,10,0.12)',
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: 12,
              }}
            >
              <StampButton wide disabled={!canSave} onPress={() => void save()}>
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </StampButton>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Ce qu'il reste à écrire, sous les 20 derniers caractères. */
function Remaining({ text }: { text: string }) {
  const { fontScale } = useWindowDimensions();
  const remaining = whyRemaining(text);
  if (remaining > WHY_WARN_REMAINING) return null;
  return (
    <Text
      allowFontScaling={false}
      accessibilityLiveRegion="polite"
      style={{
        marginTop: 6,
        alignSelf: 'flex-end',
        ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 12, 16),
        color: remaining < 0 ? '#c1121f' : INK_MUTED,
        fontWeight: '600',
      }}
    >
      {remaining >= 0
        ? `${remaining} caractère${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''}`
        : `${-remaining} de trop`}
    </Text>
  );
}

function Notice({ text }: { text: string }) {
  const { fontScale } = useWindowDimensions();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text
        allowFontScaling={false}
        style={{
          ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 15, 21),
          color: INK_MUTED,
          textAlign: 'center',
          fontWeight: '600',
        }}
      >
        {text}
      </Text>
    </View>
  );
}
