import { Image, Text, View, useWindowDimensions } from 'react-native';
import {
  CONTENT_MAX_FONT_MULTIPLIER,
  CONTROL_MAX_FONT_MULTIPLIER,
  fontScaleFor,
  scaledType,
} from '@/components/bento/font-scaling';
import { INK_MUTED, stampShadow } from '@/components/primitives';
import { WHY_SECTION_GAP } from '@/components/whys/WhySection';
import { MEDAL_CIRCLE, MEDAL_GAP, achievementLabel, medalGrid, shownAchievements } from '@/lib/achievements';
import { popyOf } from '@/lib/popy-avatar';
import { useAchievements, useAchievementsEnabled } from './use-achievements';

const INK = '#0a0a0a';
const CREAM = '#fbf3de';

/** Le cadre, du bord aux médailles : le même que celui des pourquoi. */
const CARD_BORDER = 2.5;
const CARD_PADDING_X = 16;

/**
 * « Succès », sous la boîte de la page d'un compte, après les pourquoi,
 * chantier 27 (§3, D2) : une médaille par succès gagné, son Popy dans un
 * cercle à sa couleur, son nom dessous, dans l'ordre du catalogue (D22).
 *
 * Rien sans succès, ni tant que la base n'a pas répondu : la page ne change
 * pas d'un pixel (D11). Le lecteur d'écran lit chaque médaille d'un bloc, son
 * nom et ce qu'elle dit (D12).
 */
export function AchievementSection({ userId, sideInset }: { userId: string | null; sideInset: number }) {
  const { width, fontScale } = useWindowDimensions();
  const enabled = useAchievementsEnabled();
  const { data } = useAchievements(userId);
  const medals = shownAchievements(data);
  if (!enabled || medals.length === 0) return null;

  const textScale = fontScaleFor(fontScale, CONTENT_MAX_FONT_MULTIPLIER);
  const inner = width - sideInset * 2 - (CARD_BORDER + CARD_PADDING_X) * 2;
  const { medalWidth } = medalGrid(inner, textScale);
  const title = scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 12, 15);

  return (
    <View style={{ marginTop: WHY_SECTION_GAP, marginHorizontal: sideInset }}>
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        allowFontScaling={false}
        style={{
          marginBottom: 12,
          fontFamily: 'Bungee',
          fontSize: 10 * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER),
          letterSpacing: 2,
          color: INK_MUTED,
          textTransform: 'uppercase',
        }}
      >
        Succès
      </Text>
      <View
        style={[
          {
            backgroundColor: CREAM,
            borderWidth: CARD_BORDER,
            borderColor: INK,
            borderRadius: 22,
            paddingHorizontal: CARD_PADDING_X,
            paddingTop: 16,
            paddingBottom: 14,
            flexDirection: 'row',
            flexWrap: 'wrap',
            columnGap: MEDAL_GAP,
            rowGap: 14,
          },
          stampShadow(3),
        ]}
      >
        {medals.map((medal) => {
          const popy = popyOf(medal.popy);
          return (
            <View
              key={medal.key}
              accessible
              accessibilityLabel={achievementLabel(medal.key)}
              style={{ width: medalWidth, alignItems: 'center', gap: 8 }}
            >
              {/* Sans `overflow: 'hidden'` : sur iOS, il couperait l'ombre. Le
                  Popy tient dans le cercle sans lui. */}
              <View
                style={[
                  {
                    width: MEDAL_CIRCLE,
                    height: MEDAL_CIRCLE,
                    borderRadius: MEDAL_CIRCLE / 2,
                    backgroundColor: popy.accent,
                    borderWidth: 2.5,
                    borderColor: INK,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  stampShadow(2),
                ]}
              >
                <Image
                  source={popy.source}
                  style={{ width: MEDAL_CIRCLE - 16, height: MEDAL_CIRCLE - 16 }}
                  resizeMode="contain"
                />
              </View>
              <Text
                allowFontScaling={false}
                numberOfLines={2}
                style={{ ...title, color: INK, fontWeight: '800', textAlign: 'center' }}
              >
                {medal.title}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
