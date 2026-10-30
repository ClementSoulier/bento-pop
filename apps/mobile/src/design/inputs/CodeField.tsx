import { useEffect, useState, type Ref } from 'react';
import { TextInput, View, useWindowDimensions } from 'react-native';
import Animated, {
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { PopShadow } from '../PopShadow';
import { Text } from '../Text';
import { useTheme } from '../theme';
import { textStyle } from '../type';
import { useMotion } from '../useMotion';
import { FieldError, FocusHalo } from './TextField';

export type CodeFieldProps = {
  value: string;
  /** Reçoit les seuls chiffres, à la longueur du code. */
  onChangeText: (code: string) => void;
  /** 6 par défaut. */
  length?: number;
  /** Ce que lisent VoiceOver et TalkBack, « Code à 6 chiffres » par défaut. */
  label?: string;
  /** Un code refusé : dit sous les cases, avec une icône. */
  error?: string;
  /** L'apparence du champ actif, que le focus lui donne de lui-même : pour le catalogue. */
  focused?: boolean;
  autoFocus?: boolean;
  editable?: boolean;
  ref?: Ref<TextInput>;
};

/**
 * Les cases du code reçu par mail (chantier 30, famille des listes et de la
 * saisie) : six cases de 60 de haut ; la case à remplir cernée d'encre dans
 * son halo, avec un curseur qui clignote ; une case remplie posée sur son
 * ombre franche.
 *
 * Un seul champ, transparent, couvre les cases : il reçoit le clavier
 * numérique, le collage et le code proposé par le système, comme le champ du
 * code actuel (`AccountParts`) ; les cases ne font que le montrer, et le
 * lecteur d'écran ne lit que lui.
 *
 * Les chiffres sont en `title-2`, 22 sur 28, quand le CSS écrit 26 sur 26 :
 * entre `title-2` et `title-1`, à 4 points chacun, la hauteur de ligne
 * départage, comme au lot 3 (D17).
 */
export function CodeField({
  value,
  onChangeText,
  length = 6,
  label = `Code à ${length} chiffres`,
  error,
  focused,
  autoFocus,
  editable,
  ref,
}: CodeFieldProps) {
  const theme = useTheme();
  const { colors, border, radius } = theme;
  const [hasFocus, setHasFocus] = useState(false);
  const active = focused ?? hasFocus;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {Array.from({ length }, (_, index) => {
          const digit = value[index];
          const current = active && index === value.length;
          const cell = (
            <View
              style={{
                minHeight: 60,
                borderRadius: radius.md,
                borderWidth: digit || current ? 2 : border.control,
                borderColor: current
                  ? colors['focus-ring']
                  : digit
                    ? colors.ink
                    : colors['border-strong'],
                backgroundColor: colors['bg-surface'],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {digit ? (
                <Text variant="title-2" style={{ fontVariant: ['tabular-nums'] }}>
                  {digit}
                </Text>
              ) : current ? (
                <Caret />
              ) : null}
            </View>
          );
          return (
            <View
              key={index}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{ flex: 1 }}
            >
              {current ? <FocusHalo radius={radius.md} theme={theme} /> : null}
              {digit ? (
                <PopShadow level="pop-sm" radius={radius.md}>
                  {cell}
                </PopShadow>
              ) : (
                cell
              )}
            </View>
          );
        })}
        <TextInput
          ref={ref}
          value={value}
          onChangeText={(raw) => onChangeText(raw.replace(/\D/g, '').slice(0, length))}
          maxLength={length}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          autoFocus={autoFocus}
          editable={editable}
          accessibilityLabel={label}
          accessibilityHint={error}
          allowFontScaling={false}
          caretHidden
          selectionColor={INVISIBLE}
          onFocus={() => setHasFocus(true)}
          onBlur={() => setHasFocus(false)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            color: INVISIBLE,
            fontSize: 17,
          }}
        />
      </View>
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}

/**
 * La couleur du texte du champ caché : un blanc d'opacité nulle, et non
 * `transparent`, le noir d'opacité nulle, qu'Android lit comme une couleur
 * absente : il écrivait le code en noir sur la première case, relevé au
 * Pixel 8 au lot 4.
 */
const INVISIBLE = 'rgba(255, 255, 255, 0)';

/**
 * Le curseur de la case à remplir : 2 de large, de la hauteur des chiffres,
 * une seconde allumé puis éteint par moitiés ; fixe quand le système réduit
 * les animations.
 */
function Caret() {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const motion = useMotion();
  const shown = useSharedValue(1);
  useEffect(() => {
    if (motion.reduced) {
      cancelAnimation(shown);
      shown.value = 1;
      return;
    }
    const step = (to: number) =>
      withDelay(
        500,
        withTiming(to, { duration: 0, reduceMotion: ReduceMotion.Never }),
        ReduceMotion.Never,
      );
    shown.value = withRepeat(
      withSequence(step(0), step(1)),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
    return () => cancelAnimation(shown);
  }, [motion.reduced, shown]);
  const blink = useAnimatedStyle(() => ({ opacity: shown.value }));
  return (
    <Animated.View
      style={[
        {
          width: 2,
          height: textStyle('title-2', fontScale).fontSize,
          backgroundColor: colors['text-primary'],
        },
        blink,
      ]}
    />
  );
}
