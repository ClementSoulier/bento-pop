import { useEffect, useRef } from 'react';
import { PanResponder, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { AppIcon } from '../brand/AppIcon';
import { PopShadow } from '../PopShadow';
import { Text } from '../Text';
import { useTheme } from '../theme';
import { reachesWrapScale } from '../type';
import { useAnnouncement } from '../useAnnouncement';
import { timingConfig, useMotion } from '../useMotion';

export type InAppNoticeProps = {
  title: string;
  message: string;
  /** « maintenant » par défaut. */
  time?: string;
  /** La toucher ouvre ce dont elle parle. */
  onPress: () => void;
  /** Une fois partie, d'elle-même, glissée vers le haut ou ouverte : le parent la retire. */
  onDismiss: () => void;
  /** La distance au haut de son parent, quand ce n'est pas un écran : le catalogue. */
  top?: number;
  /** Pour le catalogue : elle reste, comme dans l'aperçu, jusqu'à ce qu'on la glisse. */
  inline?: boolean;
};

/** Ce qu'une notification reçue app ouverte reste à l'écran, en millisecondes. */
export const NOTICE_DURATION = 4000;

/**
 * La notification reçue pendant que l'app est ouverte (chantier 30, famille
 * des calques et des retours) : en haut, à 4 sous la barre d'état et à 10
 * des bords, l'icône de l'app, le titre, l'heure et le message, cernée
 * d'encre sur son ombre franche.
 *
 * Elle descend en 200 ms avec un léger rebond, se dit au lecteur d'écran,
 * reste 4 s ; la toucher ouvre ce dont elle parle, la glisser vers le haut
 * la ferme. Au lecteur d'écran, elle est un bouton qui l'ouvre, et
 * « Fermer » une action à part, le glissé lui étant hors de portée.
 *
 * Dès 130 %, l'heure passe sous le titre : à côté, sur un iPhone SE à 200 %,
 * elle coupait « Proposition » en deux (D18).
 */
export function InAppNotice({
  title,
  message,
  time = 'maintenant',
  onPress,
  onDismiss,
  top,
  inline,
}: InAppNoticeProps) {
  const { colors, border } = useTheme();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const stacked = reachesWrapScale(fontScale);
  const motion = useMotion();
  const shown = useSharedValue(0);
  const drag = useSharedValue(0);
  const leaving = useRef(false);
  const latest = useRef({ onDismiss, onPress, motion });
  latest.current = { onDismiss, onPress, motion };

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
    const timer = setTimeout(hide, NOTICE_DURATION);
    return () => clearTimeout(timer);
    // Une notification par montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useAnnouncement(`${title}. ${message}`);

  const open = () => {
    latest.current.onPress();
    hide();
  };
  const settle = () => {
    drag.value = withTiming(0, timingConfig(latest.current.motion.move('base')));
  };
  // Elle prend le toucher dès le contact et décide au relâché : un toucher
  // l'ouvre, un glissé vers le haut la ferme. React Native 0.86 ne propose
  // pas le glissé à qui ne l'a pas pris au contact (cf. `SheetLayer`).
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        drag.value = Math.min(0, gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -24 || gesture.vy < -0.5) hide();
        else if (Math.abs(gesture.dx) < 10 && Math.abs(gesture.dy) < 10) open();
        else settle();
      },
      onPanResponderTerminate: settle,
    }),
  ).current;

  const moves = !motion.reduced;
  const appear = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, shown.value)),
    transform: [{ translateY: (moves ? -24 * (1 - shown.value) : 0) + drag.value }],
  }));
  return (
    <Animated.View
      {...pan.panHandlers}
      style={[{ position: 'absolute', left: 10, right: 10, top: top ?? insets.top + 4 }, appear]}
    >
      <PopShadow level="pop" radius={22}>
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${title}, ${time}. ${message}`}
          // Chaque action devient une action de VoiceOver, nommée par son
          // libellé, à défaut par son nom anglais.
          accessibilityActions={[
            { name: 'activate', label: 'Ouvrir' },
            { name: 'dismiss', label: 'Fermer' },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'activate') open();
            if (event.nativeEvent.actionName === 'dismiss') hide();
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 22,
            borderWidth: border.ink,
            borderColor: colors.ink,
            backgroundColor: colors['bg-elevated'],
          }}
        >
          <AppIcon size={40} />
          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <View
              style={
                stacked
                  ? { gap: 1 }
                  : { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }
              }
            >
              <Text variant="label-m" style={{ flexShrink: 1 }}>
                {title}
              </Text>
              <Text
                variant="footnote"
                color="text-tertiary"
                numberOfLines={stacked ? undefined : 1}
              >
                {time}
              </Text>
            </View>
            <Text variant="subhead">{message}</Text>
          </View>
        </View>
      </PopShadow>
    </Animated.View>
  );
}
