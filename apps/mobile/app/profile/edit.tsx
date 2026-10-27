import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { popyKeyFor } from '@bento-pop/supabase-mobile/bento';
import {
  CONTENT_MAX_FONT_MULTIPLIER,
  CONTROL_MAX_FONT_MULTIPLIER,
  TITLE_MAX_FONT_MULTIPLIER,
  fontScaleFor,
  scaledType,
} from '@/components/bento/font-scaling';
import {
  INK_MUTED,
  INK_PLACEHOLDER,
  SHADOWS,
  SectionTitle,
  YellowBg,
  useToast,
} from '@/components/primitives';
import { POPY_CHOICES, type Popy } from '@/lib/popy-avatar';
import { PSEUDO_MAX, checkPseudoAvailability, type PseudoCheck } from '@/lib/pseudo';
import {
  DISPLAY_NAME_MAX,
  ProfileWriteFailure,
  changePseudo,
  displayNameLength,
  formatChangeDate,
  nameAction,
  nextPseudoChangeAt,
  profileWriteMessage,
  pseudoFieldMessage,
  writeAvatar,
  writeDisplayName,
  type FieldMessage,
  type ProfileWriteError,
} from '@/lib/profile-edit';
import { refreshPublicViews } from '@/lib/public-bento-query';
import { useSocialLinksEnabled } from '@/components/social-links/use-social-links';
import {
  SOCIAL_LINKS_ROOT,
  fetchSocialLinks,
  setSocialLinks,
  socialLinksKey,
} from '@/lib/social-link-actions';
import {
  SOCIAL_LABELS,
  SOCIAL_NETWORKS,
  readHandleInput,
  socialErrorFor,
  type SocialNetworkName,
} from '@/lib/social-links';
import { useSession } from '@/state/session';
import { supabase } from '@/supabase/client';

const TITLE = 'Modifier le profil';
const TITLE_SIZE = 30;

/** Un Popy de la grille, trois par ligne jusqu'au plus petit écran. */
const POPY_SIZE = 84;

/** La taille d'une saisie, en points, à la taille système par défaut. */
const INPUT_SIZE = 16;

/**
 * La hauteur d'un champ de saisie, en tailles de police : posée par l'écran,
 * elle suit une taille système changée écran ouvert. Mesurée sinon, le champ
 * gardait sa hauteur de la plus grande taille, 9 points de trop, une fois
 * revenu à la taille par défaut (recette du lot 4).
 */
const INPUT_LINE = 1.3;

/** Un champ de saisie : blanc, cerclé, comme celui du pseudo à la publication. */
const FIELD = {
  backgroundColor: '#ffffff',
  borderWidth: 3,
  borderColor: '#0a0a0a',
  borderRadius: 16,
  paddingVertical: 14,
  paddingHorizontal: 16,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
} as const;

/** La pastille d'une phrase sous un champ : la couleur double le texte, sans le remplacer. */
const TONES: Readonly<Record<FieldMessage['tone'], string>> = {
  ok: '#2ec4b6',
  error: '#e63946',
  neutral: INK_MUTED,
};

function failureReason(e: unknown): ProfileWriteError {
  return e instanceof ProfileWriteFailure ? e.reason : { kind: 'unknown' };
}

/**
 * Modifier son profil, chantier 21 (D4, D5, D7) : le Popy, le nom affiché et
 * le pseudo, chacun enregistré à part par sa fonction de la base, qui en tient
 * les règles. Ouvert par le crayon de l'onglet Profil. Le chantier 25 y ajoute
 * ses réseaux, sous le nom (D10).
 *
 * Le Popy s'enregistre au tap, comme un interrupteur des réglages : un autre
 * tap le défait. Le nom et le pseudo ont leur bouton, et le pseudo se
 * confirme : ses anciens liens mèneront au nouveau, et le suivant attendra
 * 30 jours.
 *
 * Les textes appliquent eux-mêmes la taille système, plafonnée, comme les
 * réglages, cf. `app/settings.tsx`.
 */
export default function EditProfileScreen() {
  const profile = useSession((s) => s.profile);
  const setProfile = useSession((s) => s.setProfile);
  const refreshProfile = useSession((s) => s.refreshProfile);
  const queryClient = useQueryClient();
  const showToast = useToast((s) => s.show);
  const { fontScale } = useWindowDimensions();

  const socialOn = useSocialLinksEnabled();
  const pseudo = profile?.pseudo ?? '';
  const [name, setName] = useState(profile?.display_name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [savingPopy, setSavingPopy] = useState(false);
  const [pseudoInput, setPseudoInput] = useState(pseudo);
  const [check, setCheck] = useState<PseudoCheck>({ status: 'idle' });
  const [pseudoError, setPseudoError] = useState<string | null>(null);
  const [savingPseudo, setSavingPseudo] = useState(false);

  // Comme à la publication : la base répond 350 ms après la dernière touche.
  // Son pseudo actuel ne se vérifie pas, il n'y a rien à changer.
  useEffect(() => {
    setPseudoError(null);
    if (pseudoInput.trim() === pseudo) {
      setCheck({ status: 'idle' });
      return;
    }
    setCheck({ status: 'checking' });
    let cancelled = false;
    const t = setTimeout(async () => {
      const result = await checkPseudoAvailability(pseudoInput);
      if (!cancelled) setCheck(result);
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [pseudoInput, pseudo]);

  const titleSize = TITLE_SIZE * fontScaleFor(fontScale, TITLE_MAX_FONT_MULTIPLIER);
  const contentScale = fontScaleFor(fontScale, CONTENT_MAX_FONT_MULTIPLIER);

  if (!profile) {
    return (
      <YellowBg>
        <SafeAreaView style={{ flex: 1 }}>
          <TopBar />
          <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
            <Hint>{profileWriteMessage({ kind: 'auth' }, 'name')}</Hint>
          </View>
        </SafeAreaView>
      </YellowBg>
    );
  }

  const shownPopy = popyKeyFor(pseudo, profile.avatar);
  const nextChange = nextPseudoChangeAt(profile.pseudo_changed_at);
  const action = nameAction(name, profile.display_name);
  const nameMessage = nameError ?? (action.kind === 'invalid' ? action.message : null);
  const pseudoMessage: FieldMessage | null = pseudoError
    ? { text: pseudoError, tone: 'error' }
    : pseudoFieldMessage(check);

  const choosePopy = async (popy: Popy) => {
    if (savingPopy || popy.key === shownPopy) return;
    const before = profile.avatar;
    setSavingPopy(true);
    // Tout de suite à l'écran, rendu si l'écriture échoue.
    setProfile({ ...profile, avatar: popy.key });
    try {
      const stored = await writeAvatar(supabase, popy.key);
      const latest = useSession.getState().profile;
      if (latest) setProfile({ ...latest, avatar: stored });
      refreshPublicViews(queryClient);
      showToast(`${popy.name} enregistré`, { variant: 'success' });
    } catch (e) {
      console.warn('[profil] Popy', e);
      const latest = useSession.getState().profile;
      if (latest) setProfile({ ...latest, avatar: before });
      showToast(profileWriteMessage(failureReason(e), 'avatar'), { variant: 'danger' });
    } finally {
      setSavingPopy(false);
    }
  };

  const saveName = async () => {
    if (savingName || action.kind === 'none' || action.kind === 'invalid') return;
    Keyboard.dismiss();
    setSavingName(true);
    setNameError(null);
    try {
      const stored = await writeDisplayName(supabase, name);
      const latest = useSession.getState().profile;
      if (latest) setProfile({ ...latest, display_name: stored });
      setName(stored ?? '');
      refreshPublicViews(queryClient);
      showToast(stored ? 'Nom enregistré' : 'Nom retiré', { variant: 'success' });
    } catch (e) {
      console.warn('[profil] nom', e);
      setNameError(profileWriteMessage(failureReason(e), 'name'));
    } finally {
      setSavingName(false);
    }
  };

  const savePseudo = async (next: string) => {
    setSavingPseudo(true);
    setPseudoError(null);
    try {
      // Le Popy affiché, que la base fige s'il n'a jamais été choisi :
      // changer de pseudo ne change pas de visage (D7).
      const stored = await changePseudo(supabase, next, shownPopy);
      const latest = useSession.getState().profile;
      if (latest) {
        setProfile({
          ...latest,
          pseudo: stored,
          avatar: latest.avatar ?? shownPopy,
          pseudo_changed_at: new Date().toISOString(),
        });
      }
      // La ligne de la base fait foi, dates comprises.
      void refreshProfile();
      refreshPublicViews(queryClient);
      showToast(`Tu es maintenant @${stored}`, { variant: 'success' });
    } catch (e) {
      console.warn('[profil] pseudo', e);
      const reason = failureReason(e);
      setPseudoError(profileWriteMessage(reason, 'pseudo'));
      // Changé depuis un autre téléphone : la ligne relue donne la date, et
      // l'écran passe de lui-même à « Prochain changement possible le… ».
      if (reason.kind === 'too-soon') void refreshProfile();
    } finally {
      setSavingPseudo(false);
    }
  };

  const confirmPseudo = () => {
    const next = pseudoInput.trim();
    if (savingPseudo || check.status !== 'available') return;
    Keyboard.dismiss();
    // Le changement suivant, si celui-ci part maintenant.
    const after = nextPseudoChangeAt(new Date().toISOString());
    Alert.alert(
      `Passer à @${next} ?`,
      `Les liens déjà partagés mèneront à @${next}, et personne d’autre ne pourra prendre @${pseudo}.` +
        (after ? ` Prochain changement possible le ${formatChangeDate(after)}.` : ''),
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Changer', onPress: () => void savePseudo(next) },
      ],
    );
  };

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1 }}>
        <TopBar />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <Text
            accessibilityRole="header"
            allowFontScaling={false}
            style={{
              marginTop: 18,
              fontFamily: 'Extenda',
              fontSize: titleSize,
              lineHeight: titleSize * 1.05,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            {TITLE}
          </Text>

          {/* Le Popy, enregistré au tap. */}
          <View style={{ marginTop: 24, gap: 8 }}>
            <SectionTitle>Ton Popy</SectionTitle>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                rowGap: 14,
              }}
            >
              {POPY_CHOICES.map((popy) => (
                <PopyChoice
                  key={popy.key}
                  popy={popy}
                  selected={popy.key === shownPopy}
                  disabled={savingPopy}
                  onPress={() => void choosePopy(popy)}
                />
              ))}
            </View>
          </View>

          {/* Le nom, facultatif (D4). */}
          <View style={{ marginTop: 28, gap: 8 }}>
            <SectionTitle>Ton nom</SectionTitle>
            <View style={[FIELD, SHADOWS.stamp]}>
              <TextInput
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  setNameError(null);
                }}
                placeholder="Facultatif"
                placeholderTextColor={INK_PLACEHOLDER}
                accessibilityLabel="Nom affiché"
                accessibilityHint={`Facultatif, ${DISPLAY_NAME_MAX} caractères au plus`}
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => void saveName()}
                allowFontScaling={false}
                style={{
                  flex: 1,
                  fontSize: INPUT_SIZE * contentScale,
                  height: Math.ceil(INPUT_SIZE * INPUT_LINE * contentScale),
                  paddingVertical: 0,
                  color: '#0a0a0a',
                }}
              />
              <Text allowFontScaling={false} style={{ fontSize: 12 * contentScale, color: INK_MUTED }}>
                {`${displayNameLength(name)} / ${DISPLAY_NAME_MAX}`}
              </Text>
            </View>
            {nameMessage ? <FieldLine message={{ text: nameMessage, tone: 'error' }} /> : null}
            <Hint>Il s’affiche à côté de la date de ton bento, sur ta page et dans « La table ».</Hint>
            <ActionButton
              label={
                savingName
                  ? 'Enregistrement…'
                  : action.kind === 'remove'
                    ? 'Retirer le nom'
                    : 'Enregistrer le nom'
              }
              disabled={savingName || action.kind === 'none' || action.kind === 'invalid'}
              busy={savingName}
              onPress={() => void saveName()}
            />
          </View>

          {socialOn ? <SocialSection userId={profile.id} /> : null}

          {/* Le pseudo, une fois tous les 30 jours au plus (D5). */}
          <View style={{ marginTop: 28, gap: 8 }}>
            <SectionTitle>Ton pseudo</SectionTitle>
            {nextChange ? (
              <>
                <View style={[FIELD, { backgroundColor: '#fbf3de' }]}>
                  <Text
                    numberOfLines={1}
                    allowFontScaling={false}
                    style={{ fontSize: 16 * contentScale, fontWeight: '700', color: '#0a0a0a' }}
                  >
                    {`@${pseudo}`}
                  </Text>
                </View>
                <Hint>{`Prochain changement possible le ${formatChangeDate(nextChange)}.`}</Hint>
              </>
            ) : (
              <>
                <View style={[FIELD, SHADOWS.stamp]}>
                  <Text
                    allowFontScaling={false}
                    style={{ fontSize: 16 * contentScale, fontWeight: '700', color: INK_PLACEHOLDER }}
                  >
                    @
                  </Text>
                  <TextInput
                    value={pseudoInput}
                    onChangeText={setPseudoInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    maxLength={PSEUDO_MAX}
                    accessibilityLabel="Pseudo"
                    accessibilityHint="3 à 20 caractères : lettres, chiffres, points et underscores"
                    returnKeyType="done"
                    allowFontScaling={false}
                    style={{
                      flex: 1,
                      fontSize: INPUT_SIZE * contentScale,
                      height: Math.ceil(INPUT_SIZE * INPUT_LINE * contentScale),
                      fontWeight: '700',
                      paddingVertical: 0,
                      color: '#0a0a0a',
                    }}
                  />
                </View>
                {/* L'adresse cède la place au compteur, comme à la publication. */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text
                    numberOfLines={1}
                    allowFontScaling={false}
                    style={{ fontSize: 12 * contentScale, color: INK_MUTED, flexShrink: 1 }}
                  >
                    {`bento-pop.com/u/${pseudoInput.trim() || pseudo}`}
                  </Text>
                  <Text allowFontScaling={false} style={{ fontSize: 12 * contentScale, color: INK_MUTED }}>
                    {`${pseudoInput.trim().length} / ${PSEUDO_MAX}`}
                  </Text>
                </View>
                {pseudoMessage ? <FieldLine message={pseudoMessage} /> : null}
                <Hint>
                  Les liens déjà partagés mèneront à ton nouveau pseudo. Ensuite, plus de changement
                  pendant 30 jours.
                </Hint>
                <ActionButton
                  label={savingPseudo ? 'Changement…' : 'Changer de pseudo'}
                  disabled={savingPseudo || check.status !== 'available'}
                  busy={savingPseudo}
                  onPress={confirmPseudo}
                />
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </YellowBg>
  );
}

/**
 * Ses réseaux, chantier 25 (D4, D6, D10) : un champ par réseau, son pseudo
 * ou l'adresse de son profil, un seul bouton pour les deux. Un champ vide
 * délie ; un refus, de l'écran ou de la base, se lit sous son champ.
 */
function SocialSection({ userId }: { userId: string }) {
  const { fontScale } = useWindowDimensions();
  const contentScale = fontScaleFor(fontScale, CONTENT_MAX_FONT_MULTIPLIER);
  const queryClient = useQueryClient();
  const showToast = useToast((s) => s.show);
  const stored = useQuery({
    queryKey: socialLinksKey(userId, userId),
    queryFn: () => fetchSocialLinks(supabase, userId),
  });
  // `null` tant que la base n'a pas répondu : les champs attendent ses
  // valeurs pour ne pas effacer un lien qu'ils n'auraient pas encore lu.
  const [inputs, setInputs] = useState<Record<SocialNetworkName, string> | null>(null);
  const [errors, setErrors] = useState<Partial<Record<SocialNetworkName, string>>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (inputs === null && stored.isFetched) {
      setInputs({ instagram: stored.data?.instagram ?? '', tiktok: stored.data?.tiktok ?? '' });
    }
  }, [inputs, stored.isFetched, stored.data]);

  const values = inputs ?? { instagram: '', tiktok: '' };
  const parsed = {
    instagram: readHandleInput('instagram', values.instagram),
    tiktok: readHandleInput('tiktok', values.tiktok),
  };
  const current = { instagram: stored.data?.instagram ?? null, tiktok: stored.data?.tiktok ?? null };
  const invalid = SOCIAL_NETWORKS.some((n) => !parsed[n].ok);
  const changed = SOCIAL_NETWORKS.some((n) => {
    const field = parsed[n];
    return field.ok && field.handle !== current[n];
  });

  const save = async () => {
    if (saving || inputs === null || invalid || !changed) return;
    const instagram = parsed.instagram.ok ? parsed.instagram.handle : null;
    const tiktok = parsed.tiktok.ok ? parsed.tiktok.handle : null;
    Keyboard.dismiss();
    setSaving(true);
    setErrors({});
    setGeneral(null);
    try {
      const kept = await setSocialLinks(supabase, instagram, tiktok);
      setInputs({ instagram: kept.instagram ?? '', tiktok: kept.tiktok ?? '' });
      await queryClient.invalidateQueries({ queryKey: [SOCIAL_LINKS_ROOT] });
      refreshPublicViews(queryClient);
      showToast(kept.instagram || kept.tiktok ? 'Réseaux enregistrés' : 'Réseaux retirés', { variant: 'success' });
    } catch (e) {
      console.warn('[profil] réseaux', e);
      const { network, message } = socialErrorFor(e);
      if (network) setErrors({ [network]: message });
      else setGeneral(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ marginTop: 28, gap: 8 }}>
      <SectionTitle>Tes réseaux</SectionTitle>
      {SOCIAL_NETWORKS.map((network) => {
        const field = parsed[network];
        const message = errors[network] ?? (field.ok ? null : field.message);
        return (
          <View key={network} style={{ gap: 6 }}>
            <Text
              allowFontScaling={false}
              style={{ ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 13, 18), fontWeight: '700', color: '#0a0a0a' }}
            >
              {SOCIAL_LABELS[network]}
            </Text>
            <View style={[FIELD, SHADOWS.stamp]}>
              <Text
                allowFontScaling={false}
                style={{ fontSize: 16 * contentScale, fontWeight: '700', color: INK_PLACEHOLDER }}
              >
                @
              </Text>
              <TextInput
                value={values[network]}
                editable={inputs !== null && !saving}
                onChangeText={(value) => {
                  setInputs({ ...values, [network]: value });
                  setErrors({});
                  setGeneral(null);
                }}
                placeholder="ton_pseudo"
                placeholderTextColor={INK_PLACEHOLDER}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                keyboardType="url"
                accessibilityLabel={`Pseudo ${SOCIAL_LABELS[network]}`}
                accessibilityHint="Ton pseudo, ou l'adresse de ton profil. Vide, le lien est retiré."
                returnKeyType="done"
                onSubmitEditing={() => void save()}
                allowFontScaling={false}
                style={{
                  flex: 1,
                  fontSize: INPUT_SIZE * contentScale,
                  height: Math.ceil(INPUT_SIZE * INPUT_LINE * contentScale),
                  paddingVertical: 0,
                  color: '#0a0a0a',
                }}
              />
            </View>
            {message ? <FieldLine message={{ text: message, tone: 'error' }} /> : null}
          </View>
        );
      })}
      {general ? <FieldLine message={{ text: general, tone: 'error' }} /> : null}
      <Hint>
        Ils s’affichent sur ta page et sur bento-pop.com. Personne ne vérifie qu’ils sont à toi :
        ne mets que les tiens.
      </Hint>
      <ActionButton
        label={saving ? 'Enregistrement…' : 'Enregistrer tes réseaux'}
        disabled={saving || inputs === null || invalid || !changed}
        busy={saving}
        onPress={() => void save()}
      />
    </View>
  );
}

function TopBar() {
  return (
    <View style={{ height: 44, paddingTop: 8, paddingHorizontal: 16, flexDirection: 'row' }}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))}
        accessibilityRole="button"
        accessibilityLabel="Retour"
        // La pastille fait 36 pt : la cible tactile en fait 44.
        hitSlop={4}
        style={[
          {
            backgroundColor: '#ffffff',
            borderWidth: 2.5,
            borderColor: '#0a0a0a',
            borderRadius: 999,
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
          },
          SHADOWS.stamp,
        ]}
      >
        {/* Un glyphe dans une cible de 36 pt, pas un texte à lire. */}
        <Text allowFontScaling={false} style={{ fontSize: 16, fontWeight: '800' }}>
          ‹
        </Text>
      </Pressable>
    </View>
  );
}

/** Un Popy de la grille : le sien cerclé de rouge, son nom dessous. */
function PopyChoice({
  popy,
  selected,
  disabled,
  onPress,
}: {
  popy: Popy;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { fontScale } = useWindowDimensions();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={popy.name}
      accessibilityState={{ selected, disabled }}
      style={{ width: POPY_SIZE + 16, alignItems: 'center', gap: 8 }}
    >
      <View
        style={[
          {
            width: POPY_SIZE,
            height: POPY_SIZE,
            borderRadius: POPY_SIZE / 2,
            backgroundColor: '#ffffff',
            borderWidth: selected ? 4 : 2.5,
            borderColor: selected ? '#e63946' : '#0a0a0a',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          },
          SHADOWS.stamp,
        ]}
      >
        <Image
          source={popy.source}
          style={{ width: POPY_SIZE - 18, height: POPY_SIZE - 18 }}
          resizeMode="contain"
        />
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        allowFontScaling={false}
        style={{
          fontSize: 12 * fontScaleFor(fontScale, CONTENT_MAX_FONT_MULTIPLIER),
          fontWeight: selected ? '700' : '500',
          color: '#0a0a0a',
        }}
      >
        {popy.name}
      </Text>
    </Pressable>
  );
}

function Hint({ children }: { children: string }) {
  const { fontScale } = useWindowDimensions();
  return (
    <Text
      allowFontScaling={false}
      style={{ ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 12, 16), color: INK_MUTED }}
    >
      {children}
    </Text>
  );
}

/** Ce que l'écran dit d'une saisie : une pastille de couleur, et la phrase à l'encre. */
function FieldLine({ message }: { message: FieldMessage }) {
  const { fontScale } = useWindowDimensions();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TONES[message.tone] }} />
      <Text
        allowFontScaling={false}
        style={{
          ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 13, 18),
          fontWeight: '600',
          color: '#0a0a0a',
          flexShrink: 1,
        }}
      >
        {message.text}
      </Text>
    </View>
  );
}

function ActionButton({
  label,
  disabled,
  busy,
  onPress,
}: {
  label: string;
  disabled: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  const { fontScale } = useWindowDimensions();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      style={[
        {
          marginTop: 4,
          alignSelf: 'flex-start',
          backgroundColor: '#0a0a0a',
          borderRadius: 999,
          paddingVertical: 12,
          paddingHorizontal: 20,
          opacity: disabled ? 0.45 : 1,
        },
        disabled ? null : SHADOWS.stamp,
      ]}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        allowFontScaling={false}
        style={{
          fontFamily: 'Bungee',
          fontSize: 12 * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER),
          letterSpacing: 1,
          color: '#fbbf24',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
