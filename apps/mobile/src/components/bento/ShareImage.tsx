import { forwardRef } from 'react';
import { Image, Text, View } from 'react-native';
import logo from '@bento-pop/brand/assets/logo/bento-pop.png';
import popy from '@bento-pop/brand/assets/mascot/popy-content.png';
import { BentoGrid, type BentoItems } from './BentoGrid';

type ShareImageProps = {
  items: BentoItems;
  pseudo: string;
};

/**
 * Carte 1080×1920 (format Story Instagram / TikTok / Snapchat — 9:16),
 * prête à être capturée en PNG par `react-native-view-shot` puis partagée.
 *
 * Trois sections verticales bien séparées (pas d'overlap possible) :
 *   - Header (top 580pt) : logo Bento Pop · sticker "MON BENTO" · @pseudo
 *   - Bento grid centré (1100pt)
 *   - Footer (top 240pt) : bentopop.com · Popy
 *
 * Le rendu doit être ROBUSTE : tout est en flux normal (flexbox), aucun
 * absolute positioning, pour éviter les surprises de captureRef.
 */
export const ShareImage = forwardRef<View, ShareImageProps>(({ items, pseudo }, ref) => {
  const safePseudo = pseudo?.trim() || 'anonyme';
  return (
    <View
      ref={ref}
      collapsable={false}
      style={{
        width: 1080,
        height: 1920,
        backgroundColor: '#fbbf24',
        overflow: 'hidden',
        paddingHorizontal: 80,
        paddingTop: 80,
        paddingBottom: 60,
      }}
    >
      {/* ━━━ HEADER ━━━ */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 40,
        }}
      >
        <Image source={logo} style={{ height: 70, width: 310 }} resizeMode="contain" />
      </View>

      <View
        style={{
          alignSelf: 'flex-start',
          backgroundColor: '#e63946',
          borderWidth: 3,
          borderColor: '#0a0a0a',
          borderRadius: 8,
          paddingHorizontal: 24,
          paddingVertical: 12,
          marginBottom: 28,
          transform: [{ rotate: '-2deg' }],
        }}
      >
        <Text
          style={{
            color: '#ffffff',
            fontFamily: 'Bungee',
            fontSize: 32,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          Mon bento pop culture
        </Text>
      </View>

      <Text
        style={{
          fontFamily: 'Extenda',
          fontSize: 120,
          lineHeight: 110,
          letterSpacing: 2,
          color: '#0a0a0a',
          textTransform: 'uppercase',
          marginBottom: 40,
        }}
      >
        @{safePseudo}
      </Text>

      {/* ━━━ BENTO GRID centré ━━━ */}
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <BentoGrid items={items} scale={2.6} />
      </View>

      {/* ━━━ FOOTER ━━━ */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 24,
          marginTop: 32,
        }}
      >
        <Image source={popy} style={{ width: 96, height: 96 }} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: 'Bungee',
              fontSize: 28,
              letterSpacing: 1.5,
              color: '#0a0a0a',
              textTransform: 'uppercase',
            }}
          >
            bento-pop.com
          </Text>
          <Text
            style={{
              fontSize: 22,
              color: 'rgba(10,10,10,0.7)',
              marginTop: 4,
            }}
          >
            Compose le tien · 6 cases pop culture
          </Text>
        </View>
      </View>
    </View>
  );
});

ShareImage.displayName = 'ShareImage';
