import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Button, type ButtonVariant } from '../actions/Button';
import { Popy } from '../brand/Popy';
import type { Mood } from '../brand/popy-images';
import { PopShadow } from '../PopShadow';
import { Text } from '../Text';
import { useTheme } from '../theme';
import { timingConfig, useMotion } from '../useMotion';
import { LayerHost, Scrim, useLayer } from './Layer';

export type DialogAction = {
  label: string;
  /** `primary` par défaut, `secondary` pour la dernière, « Annuler » ; `danger` pour ce qui détruit. */
  variant?: ButtonVariant;
  onPress: () => void;
};

export type DialogProps = {
  visible: boolean;
  /** La question. */
  title: string;
  /** La conséquence, en une phrase. */
  message?: string;
  /** Popy de 76 au-dessus du titre. */
  mood?: Mood;
  /** L'action qui engage d'abord, « Annuler » en dernier. */
  actions: readonly DialogAction[];
  /** Le retour d'Android et le geste d'échappement de VoiceOver : renoncer, comme « Annuler ». */
  onCancel: () => void;
  /** Pour le catalogue : posée dans son parent, sans `Modal`, comme dans l'aperçu. */
  inline?: boolean;
};

/**
 * La boîte de confirmation, en sticker, avec Popy, réservée aux décisions
 * qui coûtent : supprimer, retirer, bloquer, se déconnecter (chantier 30,
 * famille des calques et des retours). Large de 340 au plus, cernée d'encre
 * sur son ombre franche, les boutons empilés, celui qui engage d'abord.
 *
 * Elle garde le focus : dans sa `Modal`, VoiceOver et TalkBack ne lisent
 * qu'elle, et le voile ne la ferme pas, il faut choisir. Elle paraît en
 * 200 ms avec un léger rebond, en fondu quand le système réduit les
 * animations, et son contenu défile s'il dépasse l'écran (D18). Le retour
 * haptique d'avertissement, à l'ouverture d'une confirmation destructive,
 * revient à l'écran qui l'ouvre (D11).
 */
export function Dialog({ visible, title, message, mood, actions, onCancel, inline }: DialogProps) {
  const { colors, border, radius } = useTheme();
  const motion = useMotion();
  const { mounted, progress } = useLayer(visible, 'base');
  useEffect(() => {
    if (visible) progress.value = withTiming(1, timingConfig(motion.enter('base')));
  }, [visible, motion, progress]);
  const moves = !motion.reduced;
  const appear = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, progress.value)),
    transform: [{ scale: moves ? 0.9 + 0.1 * progress.value : 1 }],
  }));
  return (
    <LayerHost mounted={mounted} inline={inline} onRequestClose={onCancel}>
      <View style={StyleSheet.absoluteFill}>
        <Scrim progress={progress} />
        <View
          pointerEvents="box-none"
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <Animated.View
            accessibilityViewIsModal
            onAccessibilityEscape={onCancel}
            style={[{ width: '100%', maxWidth: 340, maxHeight: '100%' }, appear]}
          >
            <PopShadow level="pop" radius={radius.xl} style={{ flexShrink: 1 }}>
              <View
                style={{
                  flexShrink: 1,
                  borderRadius: radius.xl,
                  borderWidth: border.ink,
                  borderColor: colors.ink,
                  backgroundColor: colors['bg-elevated'],
                  overflow: 'hidden',
                }}
              >
                <ScrollView
                  bounces={false}
                  contentContainerStyle={{
                    alignItems: 'center',
                    gap: 10,
                    paddingTop: 24,
                    paddingHorizontal: 20,
                    paddingBottom: 16,
                  }}
                >
                  {mood ? <Popy mood={mood} size={76} /> : null}
                  <Text
                    variant="title-2"
                    accessibilityRole="header"
                    style={{ textAlign: 'center' }}
                  >
                    {title}
                  </Text>
                  {message ? (
                    <Text variant="subhead" color="text-secondary" style={{ textAlign: 'center' }}>
                      {message}
                    </Text>
                  ) : null}
                  <View style={{ alignSelf: 'stretch', marginTop: 10, gap: 8 }}>
                    {actions.map((action, index) => (
                      <Button
                        key={action.label}
                        size="md"
                        block
                        variant={
                          action.variant ?? (index === actions.length - 1 ? 'secondary' : 'primary')
                        }
                        label={action.label}
                        onPress={action.onPress}
                      />
                    ))}
                  </View>
                </ScrollView>
              </View>
            </PopShadow>
          </Animated.View>
        </View>
      </View>
    </LayerHost>
  );
}
