import { useEffect, useRef } from 'react';
import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { toastAnnouncement } from '@/lib/announce';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { Text } from '../Text';
import { useTheme } from '../theme';
import { useAnnouncement } from '../useAnnouncement';
import { timingConfig, useMotion } from '../useMotion';

export type ToastProps = {
  /** Ce qui vient de se passer : « Compte gardé ». */
  message: string;
  icon?: IconName;
  /** Une action réversible, « Annuler » : le toast reste alors 6 s au lieu de 4. */
  action?: string;
  onAction?: () => void;
  /** Une fois parti, de lui-même, touché, ou par son action : le parent le retire. */
  onDismiss: () => void;
  /** Au-dessus de la barre d'onglets, par défaut, ou du bas de l'écran. */
  tabBar?: boolean;
  /** La distance au bas de son parent, quand ce n'est pas un écran : le catalogue. */
  offset?: number;
  /** Pour le catalogue : il reste, comme dans l'aperçu, jusqu'à ce qu'on le touche. */
  inline?: boolean;
};

/** Ce qu'un toast reste à l'écran, en millisecondes : 4 s, 6 s avec une action (README du design). */
export const TOAST_DURATION = { plain: 4000, action: 6000 } as const;

/**
 * Le message bref qui confirme une action (chantier 30, famille des calques
 * et des retours) : en bas, jamais en haut, où il couvrirait le titre et le
 * retour ; 8 au-dessus de la barre d'onglets, 12 au-dessus du bas de l'écran
 * sans elle ; encre, texte crème, icône et action jaunes.
 *
 * Il paraît en 200 ms avec un léger rebond, se dit au lecteur d'écran avec
 * son action, reste 4 s ou 6 s, et part quand on le touche. Le parent le
 * monte pour un message et le retire à `onDismiss` ; la file des toasts de
 * l'app se branche au chantier 31.
 */
export function Toast({
  message,
  icon,
  action,
  onAction,
  onDismiss,
  tabBar = true,
  offset,
  inline,
}: ToastProps) {
  const { colors, palette, radius, size } = useTheme();
  const insets = useSafeAreaInsets();
  const motion = useMotion();
  const shown = useSharedValue(0);
  const leaving = useRef(false);
  const latest = useRef({ onDismiss, motion });
  latest.current = { onDismiss, motion };

  const hide = () => {
    if (leaving.current) return;
    leaving.current = true;
    const { onDismiss: done, motion: now } = latest.current;
    shown.value = withTiming(0, timingConfig(now.exit('base')), (finished) => {
      if (finished) scheduleOnRN(done);
    });
  };
  useEffect(() => {
    shown.value = withTiming(1, timingConfig(latest.current.motion.enter('base')));
    if (inline) return;
    const timer = setTimeout(hide, action ? TOAST_DURATION.action : TOAST_DURATION.plain);
    return () => clearTimeout(timer);
    // Un toast par montage : un nouveau message est un nouveau toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useAnnouncement(toastAnnouncement(message, action));

  const moves = !motion.reduced;
  const appear = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, shown.value)),
    transform: [{ translateY: moves ? 16 * (1 - shown.value) : 0 }],
  }));
  return (
    <Animated.View
      onStartShouldSetResponder={() => true}
      onResponderRelease={hide}
      style={[
        {
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: offset ?? insets.bottom + (tabBar ? size.tabbar + 8 : 12),
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          minHeight: 52,
          paddingTop: 8,
          paddingRight: 6,
          paddingBottom: 8,
          paddingLeft: 14,
          borderRadius: radius.md,
          backgroundColor: colors['toast-bg'],
        },
        appear,
      ]}
    >
      {icon ? <Icon name={icon} size={22} weight="fill" tint={palette['yolk-300']} /> : null}
      <Text variant="subhead" weight={500} style={{ flex: 1, color: palette['rice-100'] }}>
        {message}
      </Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action}
          onPress={() => {
            onAction?.();
            hide();
          }}
          style={{
            minHeight: 44,
            paddingHorizontal: 12,
            borderRadius: 10,
            justifyContent: 'center',
          }}
        >
          <Text variant="label-m" style={{ color: palette['yolk-300'] }}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
