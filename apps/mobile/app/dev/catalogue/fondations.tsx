import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Icon,
  PopShadow,
  Text,
  timingConfig,
  useMotion,
  useTheme,
  type IconName,
  type ShadowLevel,
} from '@/design';
import { icons } from '@/design/icons';
import {
  errorFeedback,
  likeFeedback,
  selectionFeedback,
  successFeedback,
  warningFeedback,
} from '@/lib/haptics';

/**
 * Le catalogue du design system v2 (chantier 30, D12), page des fondations,
 * `bentopop://dev/catalogue/fondations` : les 72 icônes dans leurs deux
 * graisses, les trois ombres, le mouvement et l'haptique (lot 2).
 */
export default function Fondations() {
  return <Foundations />;
}

const NAMES = Object.keys(icons) as IconName[];
/** La planche des icônes : 8 colonnes de 40, qui tiennent sur l'iPhone SE. */
const CELL = 40;
const COLUMNS = 8;
const LEVELS: ShadowLevel[] = ['pop-sm', 'pop', 'pop-lg'];

function Foundations() {
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors['bg-app'] }}
      contentContainerStyle={{
        paddingTop: insets.top + space[4],
        paddingBottom: insets.bottom + space[8],
        paddingHorizontal: space[4],
        gap: space[8],
      }}
    >
      <Text variant="title-1" accessibilityRole="header">
        Fondations
      </Text>
      <Section title="Icônes">
        {(['bold', 'fill'] as const).map((weight) => (
          <View key={weight} style={{ gap: space[2] }}>
            <Text variant="footnote" color="text-secondary">
              {weight}
            </Text>
            <View
              style={{
                width: CELL * COLUMNS,
                flexDirection: 'row',
                flexWrap: 'wrap',
                backgroundColor: colors['bg-surface'],
              }}
            >
              {NAMES.map((name) => (
                <View
                  key={name}
                  style={{
                    width: CELL,
                    height: CELL,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name={name} weight={weight} size={28} label={`${name}, ${weight}`} />
                </View>
              ))}
            </View>
          </View>
        ))}
        {/* Sans libellé, l'icône est décorative : absente de l'arbre d'accessibilité. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Icon name="heart" weight="fill" color="like" />
          <Text variant="footnote" color="text-secondary">
            Décorative, sans libellé
          </Text>
        </View>
      </Section>
      <Section title="Ombres">
        {[false, true].map((outlined) => (
          <View key={String(outlined)} style={{ flexDirection: 'row', gap: space[6] }}>
            {LEVELS.map((level) => (
              <ShadowSample key={level} level={level} outlined={outlined} />
            ))}
          </View>
        ))}
      </Section>
      <Section title="Mouvement">
        <MotionSample />
      </Section>
      <Section title="Haptique">
        <FeedbackButton label="Sélection" onPress={selectionFeedback} />
        <FeedbackButton label="J’aime" onPress={likeFeedback} />
        <FeedbackButton label="Succès" onPress={successFeedback} />
        <FeedbackButton label="Avertissement" onPress={warningFeedback} />
        <FeedbackButton label="Erreur" onPress={errorFeedback} />
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { space } = useTheme();
  return (
    <View style={{ gap: space[4] }}>
      <Text variant="title-3" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Un objet sur son ombre, nu pour la mesurer, ou cerné d'encre comme le bouton principal. */
function ShadowSample({ level, outlined }: { level: ShadowLevel; outlined: boolean }) {
  const { colors, radius, border, space } = useTheme();
  return (
    <View style={{ gap: space[3] }}>
      <PopShadow level={level} radius={radius.md}>
        <View
          style={{
            width: 88,
            height: 56,
            borderRadius: radius.md,
            backgroundColor: colors['bg-surface'],
            borderWidth: outlined ? border.ink : 0,
            borderColor: colors.ink,
          }}
        />
      </PopShadow>
      <Text variant="caption" color="text-secondary">
        {level}
      </Text>
    </View>
  );
}

/** Une case qui apparaît : un pop de 320 ms, ou un fondu de 120 ms en mouvement réduit. */
function MotionSample() {
  const { colors, radius, space } = useTheme();
  const motion = useMotion();
  const enter = motion.enter('slow');
  const progress = useSharedValue(1);
  const moves = enter.kind === 'move';
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: moves ? 0.6 + 0.4 * progress.value : 1 }],
  }));
  const replay = () => {
    progress.value = 0;
    progress.value = withTiming(1, timingConfig(enter));
  };
  return (
    <View style={{ gap: space[4] }}>
      <Text variant="body">
        {`Mouvement réduit : ${motion.reduced ? 'oui' : 'non'}. Apparition : ${enter.kind === 'move' ? 'pop' : 'fondu'}, ${enter.duration} ms.`}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[6] }}>
        <Animated.View
          style={[
            { width: 64, height: 64, borderRadius: radius.lg, backgroundColor: colors.accent },
            style,
          ]}
        />
        <FeedbackButton label="Rejouer" onPress={replay} />
      </View>
    </View>
  );
}

function FeedbackButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, radius, border, space, size } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: size['button-md'],
        justifyContent: 'center',
        paddingHorizontal: space[4],
        borderRadius: radius.full,
        borderWidth: border.control,
        borderColor: colors['border-strong'],
        alignSelf: 'flex-start',
      }}
    >
      <Text variant="label-m">{label}</Text>
    </Pressable>
  );
}
