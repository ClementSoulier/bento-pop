import { forwardRef } from 'react';
import { Image, Text, View } from 'react-native';
import logo from '@bento-pop/brand/assets/logo/bento-pop.png';
import { BentoGrid, type BentoItems } from './BentoGrid';

type ShareImageProps = {
  items: BentoItems;
  pseudo: string;
};

/**
 * Carte 600×800 (proportion story Instagram-friendly) prête à être
 * capturée en PNG par `react-native-view-shot`.
 *
 * Rendue OFF-SCREEN (via `collapsable={false}` + positionnement
 * pointer-events:none par le parent). Le contenu est tout en absolu pour
 * ne pas être influencé par le layout parent.
 *
 * Cf. design Claude Design — `ShareImage` dans `screens.jsx`.
 */
export const ShareImage = forwardRef<View, ShareImageProps>(({ items, pseudo }, ref) => {
  return (
    <View
      ref={ref}
      collapsable={false}
      style={{
        width: 600,
        height: 800,
        backgroundColor: '#fbbf24',
        position: 'relative',
        overflow: 'hidden',
        padding: 36,
        paddingHorizontal: 40,
      }}
    >
      {/* Stickers d'angle */}
      <View
        style={{
          position: 'absolute',
          top: 28,
          right: 36,
          backgroundColor: '#0a0a0a',
          borderWidth: 2,
          borderColor: '#0a0a0a',
          borderRadius: 4,
          paddingHorizontal: 10,
          paddingVertical: 5,
          transform: [{ rotate: '6deg' }],
        }}
      >
        <Text
          style={{
            color: '#fbbf24',
            fontFamily: 'Bungee',
            fontSize: 11,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          }}
        >
          bentopop.com
        </Text>
      </View>

      <View
        style={{
          alignSelf: 'flex-start',
          backgroundColor: '#e63946',
          borderWidth: 2,
          borderColor: '#0a0a0a',
          borderRadius: 4,
          paddingHorizontal: 10,
          paddingVertical: 5,
          transform: [{ rotate: '-3deg' }],
        }}
      >
        <Text
          style={{
            color: '#ffffff',
            fontFamily: 'Bungee',
            fontSize: 14,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          }}
        >
          Mon bento pop culture
        </Text>
      </View>

      <Text
        style={{
          fontFamily: 'Extenda',
          fontSize: 56,
          lineHeight: 56 * 0.9,
          letterSpacing: 1.5,
          color: '#0a0a0a',
          marginTop: 14,
          textTransform: 'uppercase',
        }}
      >
        @{pseudo}
      </Text>

      <View style={{ flex: 1, marginTop: 24, justifyContent: 'center' }}>
        <BentoGrid items={items} scale={1.45} />
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 22,
        }}
      >
        <Image source={logo} style={{ height: 36, width: 160 }} resizeMode="contain" />
        <Text
          style={{
            flex: 1,
            textAlign: 'right',
            fontSize: 13,
            fontWeight: '600',
            color: 'rgba(10,10,10,0.7)',
          }}
        >
          Composé sur Bento Pop · 6/6 cases
        </Text>
      </View>
    </View>
  );
});

ShareImage.displayName = 'ShareImage';
