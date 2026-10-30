import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import type { Duration } from '../motion';
import { useTheme } from '../theme';
import { timingConfig, useMotion } from '../useMotion';

/**
 * Ce que partagent les calques posés sur l'écran (chantier 30, famille des
 * calques et des retours) : la `Modal`, qui couvre aussi la barre d'onglets,
 * le voile, l'entrée et la sortie, le retour d'Android et le geste
 * d'échappement de VoiceOver.
 */

/**
 * L'entrée et la sortie d'un calque : `mounted` le garde rendu le temps de sa
 * sortie, `progress` va de 0, caché, à 1, posé. Le calque lance lui-même son
 * entrée, quand il est prêt (une feuille attend de connaître sa hauteur).
 */
export function useLayer(
  visible: boolean,
  exit: Duration,
): { mounted: boolean; progress: SharedValue<number> } {
  const motion = useMotion();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);
  if (visible && !mounted) setMounted(true);
  useEffect(() => {
    if (visible || !mounted) return;
    progress.value = withTiming(0, timingConfig(motion.exit(exit)), (finished) => {
      if (finished) scheduleOnRN(setMounted, false);
    });
  }, [visible, mounted, exit, motion, progress]);
  return { mounted, progress };
}

/** Le clavier est-il ouvert ? Une feuille rend alors la marge du bas d'écran qu'il recouvre. */
function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () =>
      setShown(true),
    );
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setShown(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return shown;
}

/**
 * Les marges d'écran d'un calque : celles du téléphone dans une `Modal`,
 * celles du design (62 et 34) quand il est posé dans le catalogue, comme
 * dans ses aperçus.
 */
export function useLayerInsets(inline: boolean | undefined): { top: number; bottom: number } {
  const insets = useSafeAreaInsets();
  const { size } = useTheme();
  if (inline) return { top: size['safe-top'], bottom: size['safe-bottom'] };
  return { top: insets.top, bottom: insets.bottom };
}

/**
 * Le calque lui-même : dans une `Modal` transparente, ou, pour le catalogue,
 * posé dans son parent comme dans l'aperçu (`inline`).
 */
export function LayerHost({
  mounted,
  inline,
  onRequestClose,
  children,
}: {
  mounted: boolean;
  inline?: boolean;
  onRequestClose: () => void;
  children: ReactNode;
}) {
  if (!mounted) return null;
  if (inline) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {children}
      </View>
    );
  }
  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onRequestClose}
    >
      {children}
    </Modal>
  );
}

/** Le voile sous une feuille ou une boîte de dialogue, `scrim`, qui suit l'entrée. */
export function Scrim({
  progress,
  closeLabel,
  onPress,
}: {
  progress: SharedValue<number>;
  /** Le voile d'une feuille la ferme ; celui d'une boîte de dialogue ne fait rien. */
  closeLabel?: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const shown = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, progress.value)),
  }));
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, shown]}
      accessibilityElementsHidden={!onPress}
      importantForAccessibility={onPress ? 'auto' : 'no-hide-descendants'}
    >
      {onPress && closeLabel ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={onPress}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </Animated.View>
  );
}

export type SheetHeight = 'auto' | 'large' | 'full';

/**
 * Une feuille qui monte du bas (`Sheet`, `AskSheet`, `ActionSheet`) : le
 * voile, qui la ferme quand on le touche, le panneau aux coins du haut de
 * 28, sa poignée, et la marge du bas d'écran.
 *
 * Elle monte de sa hauteur en 320 ms et redescend sur la courbe de sortie ;
 * un fondu de 120 ms quand le système réduit les animations. Tirée vers le
 * bas par la poignée ou l'en-tête, elle suit le doigt, et se ferme au-delà
 * du tiers de sa hauteur (120 au plus) ou d'un geste vif. Le clavier la
 * soulève ; elle ne passe jamais sous la barre d'état.
 *
 * Le voile et le panneau sont frères, et le panneau est modal pour
 * VoiceOver : un fond qui l'enveloppait ne laissait au lecteur d'écran
 * qu'un bouton, « Fermer » (relevé au chantier 22, `social/ActionSheet`).
 */
export function SheetLayer({
  visible,
  onClose,
  closeLabel = 'Fermer',
  height = 'auto',
  grabber = true,
  inline,
  head,
  overlay,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  closeLabel?: string;
  height?: SheetHeight;
  grabber?: boolean;
  inline?: boolean;
  /** L'en-tête, qu'on peut tirer avec la poignée. */
  head?: ReactNode;
  /** Ce qui se pose au-dessus de la feuille : les confettis d'une `AskSheet`. */
  overlay?: ReactNode;
  children: ReactNode;
}) {
  const { colors, radius } = useTheme();
  const motion = useMotion();
  const window = useWindowDimensions();
  const insets = useLayerInsets(inline);
  const keyboard = useKeyboardShown();
  const { mounted, progress } = useLayer(visible, 'slow');
  const [layerHeight, setLayerHeight] = useState(window.height);
  const distance = useSharedValue(window.height);
  const drag = useSharedValue(0);
  const measured = useRef(false);

  const latest = useRef({ visible, onClose, motion });
  latest.current = { visible, onClose, motion };
  const enter = () => {
    drag.value = 0;
    progress.value = withTiming(1, timingConfig(latest.current.motion.enter('slow', 'standard')));
  };
  useEffect(() => {
    if (visible && measured.current) enter();
    // `enter` lit ses valeurs dans `latest` : seule la visibilité compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  useEffect(() => {
    if (!mounted) measured.current = false;
  }, [mounted]);

  const onPanelLayout = (event: LayoutChangeEvent) => {
    distance.value = event.nativeEvent.layout.height;
    if (measured.current) return;
    measured.current = true;
    if (latest.current.visible) enter();
  };

  const settle = () => {
    drag.value = withTiming(0, timingConfig(latest.current.motion.move('base')));
  };
  // La poignée et l'en-tête prennent le toucher dès le contact : React Native
  // 0.86 ne leur proposait jamais le glissé ensuite (`onMoveShouldSet…` muet,
  // relevé au Pixel 8 et à l'iPhone au lot 4). Les boutons de l'en-tête,
  // plus profonds, le prennent avant eux.
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        drag.value = Math.max(0, gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > Math.min(120, distance.value / 3) || gesture.vy > 1) {
          latest.current.onClose();
        } else settle();
      },
      onPanResponderTerminate: settle,
    }),
  ).current;

  const moves = !motion.reduced;
  const slide = useAnimatedStyle(() =>
    moves
      ? { transform: [{ translateY: (1 - progress.value) * distance.value + drag.value }] }
      : { opacity: progress.value, transform: [{ translateY: drag.value }] },
  );

  const sizing =
    height === 'full'
      ? { flex: 1 }
      : height === 'large'
        ? { height: layerHeight * 0.82, flexShrink: 1 }
        : { flexShrink: 1 };
  return (
    <LayerHost mounted={mounted} inline={inline} onRequestClose={onClose}>
      <View
        style={StyleSheet.absoluteFill}
        onLayout={(event) => setLayerHeight(event.nativeEvent.layout.height)}
      >
        <Scrim progress={progress} closeLabel={closeLabel} onPress={onClose} />
        <KeyboardAvoidingView
          behavior="padding"
          enabled={!inline}
          pointerEvents="box-none"
          style={{ flex: 1, justifyContent: 'flex-end', paddingTop: insets.top + 10 }}
        >
          <Animated.View
            accessibilityViewIsModal
            onAccessibilityEscape={onClose}
            onLayout={onPanelLayout}
            style={[
              sizing,
              {
                backgroundColor: colors['bg-elevated'],
                borderTopLeftRadius: radius.xl,
                borderTopRightRadius: radius.xl,
                paddingBottom: keyboard && !inline ? 0 : insets.bottom,
              },
              slide,
            ]}
          >
            {/* Sous le panneau, son fond prolongé : rien ne se découvre quand la courbe de sortie le soulève. */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: '100%',
                height: 200,
                backgroundColor: colors['bg-elevated'],
              }}
            />
            <View {...pan.panHandlers}>
              {grabber ? (
                <View
                  style={{
                    alignSelf: 'center',
                    width: 40,
                    height: 5,
                    marginTop: 8,
                    borderRadius: 3,
                    backgroundColor: colors['border-default'],
                  }}
                />
              ) : null}
              {head}
            </View>
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
        {overlay}
      </View>
    </LayerHost>
  );
}
