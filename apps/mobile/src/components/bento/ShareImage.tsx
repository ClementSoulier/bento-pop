import { forwardRef } from 'react';
import { Image, Text, View } from 'react-native';
import logo from '@bento-pop/brand/assets/logo/bento-pop.png';
import popy from '@bento-pop/brand/assets/mascot/popy-content.png';
import { publicBentoLabel } from '@/lib/share';
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
 *   - Header : logo Bento Pop · sticker "MON BENTO" · @pseudo
 *   - Bento grid centré
 *   - Footer : adresse publique du bento · Popy
 *
 * Le rendu doit être ROBUSTE : tout est en flux normal (flexbox), aucun
 * absolute positioning, pour éviter les surprises de captureRef.
 *
 * **Budget vertical**, à refaire à chaque changement de taille. La grille
 * a une hauteur FIXE (512 × échelle) : elle n'absorbe rien malgré son
 * `flex: 1`, donc tout dépassement du header rogne le pied de page.
 *
 *   hauteur utile      1920 − 80 (haut) − 60 (bas)  = 1780
 *   logo + marge                                       110
 *   sticker + marge                                     96
 *   pseudo (1 ligne) + marge                            140
 *   pied de page + marge                                128
 *   ─────────────────────────────────────────────────────────
 *   reste pour la grille                               1306  →  échelle 2,5 (1280)
 *
 * Avant correction, l'échelle 2,6 et un pseudo sur deux lignes portaient
 * le total à 2053pt : le pied de page était déjà rogné.
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

      {/*
        Une seule ligne, quitte à rétrécir. Extenda est très large : au
        delà d'une dizaine de caractères, `@pseudo` passait à la ligne à
        120pt et poussait le pied de page hors du cadre.
      */}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.55}
        style={{
          fontFamily: 'Extenda',
          fontSize: 104,
          lineHeight: 100,
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
        <BentoGrid items={items} scale={2.5} readOnly />
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
        <View style={{ flex: 1, minWidth: 0 }}>
          {/*
            L'adresse complète du bento, et pas seulement le domaine.
            Une image de partage finit souvent en capture d'écran,
            transmise hors de tout lien cliquable : sans l'adresse en
            clair, personne ne peut retrouver ce bento.

            `adjustsFontSizeToFit` sur une seule ligne : un pseudo peut
            aller jusqu'à 20 caractères, ce qui porte l'adresse à 36
            caractères. Plutôt que de la voir passer à la ligne ou se
            faire rogner, on la laisse rétrécir un peu.
          */}
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={{
              fontFamily: 'Bungee',
              fontSize: 28,
              letterSpacing: 1.5,
              color: '#0a0a0a',
              textTransform: 'lowercase',
            }}
          >
            {publicBentoLabel(safePseudo)}
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
