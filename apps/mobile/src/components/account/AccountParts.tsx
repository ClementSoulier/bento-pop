import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  PixelRatio,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import {
  CONTENT_MAX_FONT_MULTIPLIER,
  CONTROL_MAX_FONT_MULTIPLIER,
  TITLE_MAX_FONT_MULTIPLIER,
  fontScaleFor,
  scaledType,
} from '@/components/bento/font-scaling';
import { INK_MUTED, INK_PLACEHOLDER, SHADOWS } from '@/components/primitives';
import { CODE_LENGTH, RESEND_DELAY_S, cleanCode } from '@/lib/account';
import { extendaAccentRoom } from '@/lib/display-title';

/**
 * Les pièces des écrans du compte, chantier 28 : garder son compte, « J'ai
 * déjà un compte », « Reconnecte-toi ». Le dessin est celui de « Modifier le
 * profil » (`app/profile/edit.tsx`) : la pastille retour, le titre en
 * Extenda, le champ blanc cerclé, et les textes qui appliquent eux-mêmes la
 * taille système, plafonnée.
 */

const TITLE_SIZE = 30;

/** La taille d'une saisie, et sa hauteur en tailles de police, comme dans `edit.tsx`. */
const INPUT_SIZE = 16;
const INPUT_LINE = 1.3;

const FIELD = {
  backgroundColor: '#ffffff',
  borderWidth: 3,
  borderColor: '#0a0a0a',
  borderRadius: 16,
  paddingVertical: 14,
  paddingHorizontal: 16,
  flexDirection: 'row',
  alignItems: 'center',
} as const;

/** La pastille retour. Sans historique, `fallback`. */
export function AccountTopBar({ fallback = '/(tabs)/profile' }: { fallback?: string }) {
  return (
    <View style={{ height: 44, paddingTop: 8, paddingHorizontal: 16, flexDirection: 'row' }}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as never))}
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

export function AccountTitle({ children }: { children: string }) {
  const { fontScale } = useWindowDimensions();
  const size = TITLE_SIZE * fontScaleFor(fontScale, TITLE_MAX_FONT_MULTIPLIER);
  // « J'AI DÉJÀ UN COMPTE » : le « É » et le « À » d'Extenda montent
  // au-dessus de son ascendante, et iOS les rogne sans cette réserve.
  const accentRoom = extendaAccentRoom(
    children,
    size,
    Platform.OS === 'android' ? PixelRatio.get() : undefined,
  );
  return (
    <Text
      accessibilityRole="header"
      allowFontScaling={false}
      style={{
        // La réserve des accents prise sur la marge : le titre ne bouge pas.
        marginTop: 18 - accentRoom,
        paddingTop: accentRoom,
        fontFamily: 'Extenda',
        fontSize: size,
        lineHeight: size * 1.05,
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </Text>
  );
}

/** Un paragraphe de l'écran. `muted` pour une précision, plus petite. */
export function AccountText({ children, muted }: { children: ReactNode; muted?: boolean }) {
  const { fontScale } = useWindowDimensions();
  return (
    <Text
      allowFontScaling={false}
      style={{
        marginTop: muted ? 10 : 12,
        ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, muted ? 13 : 15, muted ? 18 : 21),
        color: muted ? INK_MUTED : '#0a0a0a',
      }}
    >
      {children}
    </Text>
  );
}

/**
 * Une phrase d'erreur sous un champ. Comme dans « Modifier le profil », la
 * pastille rouge double le texte sans le remplacer : du rouge sur le jaune
 * ne se lirait pas. Elle se dit aussi au lecteur d'écran, puisqu'elle
 * apparaît sans que le focus bouge.
 */
export function AccountError({ message }: { message: string | null }) {
  const { fontScale } = useWindowDimensions();
  useEffect(() => {
    if (message) AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  if (!message) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ marginTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}
    >
      <View
        style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: '#e63946' }}
      />
      <Text
        allowFontScaling={false}
        style={{
          flex: 1,
          ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 14, 19),
          color: '#0a0a0a',
          fontWeight: '600',
        }}
      >
        {message}
      </Text>
    </View>
  );
}

export function EmailField({
  value,
  onChangeText,
  onSubmit,
  editable = true,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  editable?: boolean;
}) {
  const { fontScale } = useWindowDimensions();
  const scale = fontScaleFor(fontScale, CONTENT_MAX_FONT_MULTIPLIER);
  return (
    <View style={[FIELD, SHADOWS.stamp, { marginTop: 24 }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        placeholder="ton@adresse.fr"
        placeholderTextColor={INK_PLACEHOLDER}
        accessibilityLabel="Adresse email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={onSubmit}
        allowFontScaling={false}
        style={{
          flex: 1,
          fontSize: INPUT_SIZE * scale,
          height: Math.ceil(INPUT_SIZE * INPUT_LINE * scale),
          paddingVertical: 0,
          color: '#0a0a0a',
        }}
      />
    </View>
  );
}

/**
 * Le code à 6 chiffres. Le remplissage automatique des codes à usage unique
 * est demandé aux deux systèmes : iOS le propose depuis Mail, Android depuis
 * ce que son gestionnaire reconnaît.
 */
export function CodeField({
  value,
  onChangeText,
  editable = true,
}: {
  value: string;
  onChangeText: (value: string) => void;
  editable?: boolean;
}) {
  const { fontScale } = useWindowDimensions();
  const scale = fontScaleFor(fontScale, CONTENT_MAX_FONT_MULTIPLIER);
  const size = 28;
  // `autoFocus` ne suffit pas sur Android : monté au moment où le champ
  // d'adresse rendait le focus, le champ du code ne le prenait pas, relevé à
  // l'émulateur Pixel 8 au lot 5. Le focus est redemandé une fois monté.
  const input = useRef<TextInput>(null);
  useEffect(() => {
    const t = setTimeout(() => input.current?.focus(), 150);
    return () => clearTimeout(t);
  }, []);
  return (
    <View style={[FIELD, SHADOWS.stamp, { marginTop: 24, justifyContent: 'center' }]}>
      <TextInput
        ref={input}
        value={value}
        onChangeText={(raw) => onChangeText(cleanCode(raw))}
        editable={editable}
        autoFocus
        placeholder={'0'.repeat(CODE_LENGTH)}
        placeholderTextColor={INK_PLACEHOLDER}
        accessibilityLabel="Code reçu par mail"
        accessibilityHint={`${CODE_LENGTH} chiffres`}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={CODE_LENGTH}
        allowFontScaling={false}
        // Pas d'espacement des lettres : Fabric recycle les champs de saisie
        // sans remettre leurs attributs à zéro, et l'espacement survivait dans
        // l'exemple du champ suivant, « t o n @ a d r e s s e . f r », relevé à
        // la recette du lot 3. `accessibilite.test.ts` le refuse partout.
        // La police système, grasse, et non Bungee : sur Android, Bungee
        // montait au-dessus du champ et rognait le haut des chiffres, relevé
        // à l'émulateur Pixel 8 au lot 5.
        style={{
          flex: 1,
          textAlign: 'center',
          fontWeight: '800',
          fontSize: size * scale,
          height: Math.ceil(size * INPUT_LINE * scale),
          paddingVertical: 0,
          color: '#0a0a0a',
        }}
      />
    </View>
  );
}

/** Un bouton secondaire, souligné, sous le bouton principal. */
export function TextButton({
  label,
  onPress,
  disabled,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
}) {
  const { fontScale } = useWindowDimensions();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled) }}
      // Le texte fait une vingtaine de points : la cible en fait 44.
      hitSlop={{ top: 12, bottom: 12 }}
      style={{ alignSelf: 'center', marginTop: 16, paddingHorizontal: 8 }}
    >
      <Text
        allowFontScaling={false}
        style={{
          ...scaledType(fontScale, CONTROL_MAX_FONT_MULTIPLIER, 14, 20),
          fontWeight: '700',
          textDecorationLine: 'underline',
          textAlign: 'center',
          color: disabled ? INK_PLACEHOLDER : '#0a0a0a',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Les secondes avant de pouvoir redemander un code, depuis `startedAt`. Le
 * délai est celui de la configuration (D7) : avant, GoTrue refuserait.
 */
export function useResendCountdown(startedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (startedAt === null) return;
    setNow(Date.now());
    timer.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [startedAt]);
  if (startedAt === null) return 0;
  return Math.max(0, RESEND_DELAY_S - Math.floor((now - startedAt) / 1000));
}
