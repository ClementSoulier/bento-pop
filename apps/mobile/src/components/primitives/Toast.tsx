import { create } from 'zustand';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CONTENT_MAX_FONT_MULTIPLIER, CONTROL_MAX_FONT_MULTIPLIER } from '@/components/bento/font-scaling';
import { toastAnnouncement } from '@/lib/announce';
import { SHADOWS } from './shadow';

/**
 * Toast / Snackbar primitif global. Zustand-piloté pour pouvoir l'invoquer
 * depuis n'importe où (`toast.show(...)`) sans drilling de props.
 *
 * - Affiché en haut de l'écran (au-dessus du contenu), animé fade+slide.
 * - Durée par défaut 3s. Auto-dismiss.
 * - Action optionnelle : un bouton à droite avec un callback (utilisé
 *   pour l'undo de "vider case").
 * - Variant "success" (jaune Bento) / "neutral" (cream) / "danger" (rouge).
 *
 * Le composant `<ToastHost />` doit être monté UNE fois dans le root layout.
 */

export type ToastVariant = 'success' | 'neutral' | 'danger';

type ToastState = {
  message: string | null;
  variant: ToastVariant;
  action: { label: string; onPress: () => void } | null;
  durationMs: number;
  /** Tick incrémenté à chaque show — re-déclenche l'animation côté Host. */
  seq: number;
  show: (
    message: string,
    opts?: {
      variant?: ToastVariant;
      action?: { label: string; onPress: () => void };
      durationMs?: number;
    },
  ) => void;
  hide: () => void;
};

export const useToast = create<ToastState>((set, get) => ({
  message: null,
  variant: 'neutral',
  action: null,
  durationMs: 3000,
  seq: 0,
  show: (message, opts) =>
    set({
      message,
      variant: opts?.variant ?? 'neutral',
      action: opts?.action ?? null,
      durationMs: opts?.durationMs ?? 3000,
      seq: get().seq + 1,
    }),
  hide: () => set({ message: null, action: null }),
}));

/**
 * L'action d'un toast porte la couleur du texte, soulignée, et non un rouge ou
 * un jaune de marque : le rouge sur le jaune d'un toast de succès ne donnait que
 * 2,50 : 1, le jaune sur le rouge d'un toast d'erreur 2,50 aussi. À l'encre,
 * 11,86 sur le jaune et 17,89 sur le crème ; en blanc, 4,17 sur le rouge. Cf.
 * §4.8 du chantier 11.
 */
const PALETTES: Record<ToastVariant, { bg: string; fg: string; actionFg: string }> = {
  success: { bg: '#fbbf24', fg: '#0a0a0a', actionFg: '#0a0a0a' },
  neutral: { bg: '#fbf3de', fg: '#0a0a0a', actionFg: '#0a0a0a' },
  danger: { bg: '#e63946', fg: '#ffffff', actionFg: '#ffffff' },
};

export function ToastHost() {
  const message = useToast((s) => s.message);
  const variant = useToast((s) => s.variant);
  const action = useToast((s) => s.action);
  const durationMs = useToast((s) => s.durationMs);
  const seq = useToast((s) => s.seq);
  const hide = useToast((s) => s.hide);
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    if (!message) return;
    // Un toast apparaît sans que rien ne le touche : sans annonce, un lecteur
    // d'écran ne dit ni le message ni l'action qui l'accompagne.
    AccessibilityInfo.announceForAccessibility(toastAnnouncement(message, action?.label));
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slide, { toValue: -12, duration: 200, useNativeDriver: true }),
      ]).start(() => hide());
    }, durationMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq, message]);

  if (!message) return null;
  const palette = PALETTES[variant];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 16,
        right: 16,
        opacity: fade,
        transform: [{ translateY: slide }],
        zIndex: 9999,
      }}
    >
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: palette.bg,
            borderWidth: 2.5,
            borderColor: '#0a0a0a',
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 12,
          },
          SHADOWS.stamp,
        ]}
      >
        <Text
          maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
          style={{
            flex: 1,
            color: palette.fg,
            fontFamily: 'Bungee',
            fontSize: 12,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
        >
          {message}
        </Text>
        {action ? (
          <Pressable
            onPress={() => {
              action.onPress();
              hide();
            }}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            // Le libellé fait 15 pt de haut : la cible tactile en fait 44.
            hitSlop={{ top: 15, bottom: 15, left: 8, right: 8 }}
          >
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
              style={{
                color: palette.actionFg,
                fontFamily: 'Bungee',
                fontSize: 11,
                letterSpacing: 1,
                textTransform: 'uppercase',
                textDecorationLine: 'underline',
              }}
            >
              {action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}
