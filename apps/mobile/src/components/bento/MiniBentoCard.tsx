import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { BentoItems } from './BentoGrid';
import { PALETTES } from './palettes';
import { SHADOWS } from '@/components/primitives/shadow';

type MiniBentoCardProps = {
  items: BentoItems;
  pseudo: string;
  name?: string;
  accent?: string;
};

/**
 * Mini-card utilisée dans « À la une » et la recherche.
 * Preview compacte du bento (gradients miniatures) + pseudo + featured badge.
 *
 * Cf. design Claude Design — `MiniBentoCard` dans `bento-tiles.jsx`.
 */
export function MiniBentoCard({ items, pseudo, name, accent = '#fbbf24' }: MiniBentoCardProps) {
  const strip = (key: keyof BentoItems): readonly [string, string, ...string[]] => {
    const palKey = items[key]?.paletteKey;
    return PALETTES[palKey ?? 'neutral'].colors;
  };

  return (
    <View
      style={[
        {
          width: 168,
          backgroundColor: '#ffffff',
          borderWidth: 2.5,
          borderColor: '#0a0a0a',
          borderRadius: 16,
          overflow: 'hidden',
          flexShrink: 0,
        },
        SHADOWS.stamp,
      ]}
    >
      {/* Mini-bento preview */}
      <View
        style={{
          backgroundColor: '#0a0a0a',
          padding: 6,
          gap: 3,
        }}
      >
        <MiniStrip colors={strip('film')} height={56} />
        <View style={{ flexDirection: 'row', gap: 3 }}>
          <MiniStrip colors={strip('series')} height={34} flex={1} />
          <MiniStrip colors={strip('artist')} height={34} flex={1} />
        </View>
        <View style={{ flexDirection: 'row', gap: 3 }}>
          <MiniStrip colors={strip('track')} height={24} flex={1} />
          <MiniStrip colors={strip('creator')} height={24} flex={1} />
          <MiniStrip colors={strip('place')} height={24} flex={1} />
        </View>
      </View>

      <View style={{ padding: 12, paddingTop: 10 }}>
        <Text
          style={{
            fontFamily: 'Extenda',
            fontSize: 16,
            lineHeight: 15,
            textTransform: 'uppercase',
          }}
        >
          @{pseudo}
        </Text>
        {name ? (
          <Text style={{ fontSize: 11, color: 'rgba(10,10,10,0.55)', marginTop: 3 }}>
            {name}
          </Text>
        ) : null}
        <View
          style={{
            marginTop: 8,
            alignSelf: 'flex-start',
            backgroundColor: accent,
            paddingHorizontal: 7,
            paddingVertical: 2,
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: '#0a0a0a',
          }}
        >
          <Text
            style={{
              fontSize: 9,
              fontWeight: '700',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: '#0a0a0a',
            }}
          >
            Featured
          </Text>
        </View>
      </View>
    </View>
  );
}

function MiniStrip({
  colors,
  height,
  flex,
}: {
  colors: readonly [string, string, ...string[]];
  height: number;
  flex?: number;
}) {
  return (
    <View style={{ height, borderRadius: 6, overflow: 'hidden', flex }}>
      <LinearGradient
        colors={colors as unknown as readonly [string, string, ...string[]]}
        style={{ flex: 1 }}
      />
    </View>
  );
}
