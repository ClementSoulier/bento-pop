import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CONTROL_MAX_FONT_MULTIPLIER,
  TILE_MAX_FONT_MULTIPLIER,
  scaledType,
} from '@/components/bento/font-scaling';
import { PALETTES, paletteKeyForItem } from '@/components/bento/palettes';
import { displayTitleScale } from '@/lib/display-title';
import { SHADOWS } from '@/components/primitives/shadow';
import { itemImageUrl } from '@/lib/item-image';
import { cleanTitle } from '@/lib/text';
import { TILE_ASPECT } from './layout';

/**
 * Tuile d'un item dans la modale de recherche.
 *
 * Extraite du `renderItem` de l'écran pour que les propositions du bloc
 * « Au menu » et les résultats de recherche soient **le même objet**. Les
 * dupliquer les aurait fait diverger à la première retouche, et la
 * proposition doit montrer exactement ce que la recherche montrera.
 *
 * La palette est dérivée de l'identifiant, donc elle est celle que la case
 * aura une fois choisie : l'utilisateur voit dans la grille ce qu'il obtiendra
 * dans son bento.
 *
 * Pas d'état « sélectionné ». Un tap remplit la case et ferme la modale, donc
 * l'état n'aurait le temps de s'afficher sur aucune frame.
 */

/** Le minimum commun à un résultat de recherche et à une proposition. */
export type ItemTileData = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
};

/**
 * Micro-rotations, pour le côté « collé à la main » de la DA. Six valeurs
 * plutôt qu'un aléatoire : un `Math.random()` changerait à chaque rendu et
 * ferait vibrer la grille pendant la frappe.
 */
const ROTATIONS = [-0.6, 0.3, -0.4, 0.5, -0.3, 0.4] as const;

type ItemTileProps = {
  item: ItemTileData;
  /** Rang dans la grille, pour choisir la rotation. */
  index: number;
  width: number;
  pixelRatio: number;
  accessibilityLabel: string;
  onPress: () => void;
};

export function ItemTile({
  item,
  index,
  width,
  pixelRatio,
  accessibilityLabel,
  onPress,
}: ItemTileProps) {
  const palette = PALETTES[paletteKeyForItem(item.id)];
  const title = cleanTitle(item.title);
  // Le titre grossit jusqu'au plafond des cases, et rétrécit si un de ses mots ne
  // tient pas sur la ligne : à la plus grande police, « INTE / RS… », « DUN / E ».
  const { fontScale } = useWindowDimensions();
  const capped = scaledType(fontScale, TILE_MAX_FONT_MULTIPLIER, TITLE_SIZE, TITLE_SIZE);
  const shrink = displayTitleScale(
    title,
    width - TILE_BORDER * 2 - TITLE_INSET * 2,
    capped.fontSize,
    0,
    Platform.OS === 'android' ? pixelRatio : undefined,
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.tile,
        { width, transform: [{ rotate: `${ROTATIONS[index % ROTATIONS.length] ?? 0}deg` }] },
        SHADOWS.stamp,
      ]}
    >
      <View style={{ aspectRatio: 1 / TILE_ASPECT, backgroundColor: palette.colors[0] }}>
        {item.imageUrl ? (
          <Image
            source={{ uri: itemImageUrl(item.imageUrl, width, pixelRatio) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            // `Image` de react-native ne persistait rien sur disque : rouvrir
            // une case retéléchargeait toute la grille. Les propositions étant
            // par nature les mêmes d'une fois sur l'autre, c'est ce cache qui
            // rend le bloc « Au menu » tenable côté egress.
            cachePolicy="memory-disk"
            transition={120}
            // Sans lui, une cellule recyclée montre brièvement l'affiche du
            // résultat précédent pendant la frappe.
            recyclingKey={item.id}
          />
        ) : (
          <>
            <LinearGradient
              colors={palette.colors}
              start={palette.start}
              end={palette.end}
              style={StyleSheet.absoluteFill}
            />
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { alignItems: 'center', justifyContent: 'center', paddingBottom: 12 },
              ]}
            >
              {/* Une initiale en filigrane, dimensionnée sur la tuile. */}
              <Text allowFontScaling={false} style={[styles.initial, { color: palette.ink }]}>
                {initialOf(title)}
              </Text>
            </View>
          </>
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
          start={{ x: 0.5, y: 0.4 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Text
          numberOfLines={2}
          allowFontScaling={false}
          // Android : passer à la ligne entre deux mots, jamais au milieu.
          textBreakStrategy="simple"
          style={[
            styles.title,
            { fontSize: capped.fontSize * shrink, lineHeight: capped.lineHeight * shrink },
          ]}
        >
          {title}
        </Text>
      </View>
      {item.subtitle ? (
        <View style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
          <Text
            numberOfLines={1}
            maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
            style={styles.subtitle}
          >
            {item.subtitle}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Première lettre ou chiffre du titre, pour la tuile sans image. */
export function initialOf(s: string): string {
  const match = s.trim().match(/[A-Za-zÀ-ÿ0-9]/);
  return (match?.[0] ?? '?').toUpperCase();
}

/** Titre en Extenda 11 sur 11, posé à 6 pt des bords. */
const TITLE_SIZE = 11;
const TITLE_INSET = 6;
/** Bordure de la tuile, cf. `styles.tile`. */
const TILE_BORDER = 2.5;

const styles = StyleSheet.create({
  tile: {
    // La largeur est posée au rendu, cf. `searchTileWidth`.
    backgroundColor: '#ffffff',
    borderWidth: TILE_BORDER,
    borderColor: '#0a0a0a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  initial: {
    fontFamily: 'Extenda',
    fontSize: 64,
    lineHeight: 60,
    opacity: 0.22,
    letterSpacing: -2,
    textTransform: 'uppercase',
  },
  title: {
    position: 'absolute',
    bottom: TITLE_INSET,
    left: TITLE_INSET,
    right: TITLE_INSET,
    fontFamily: 'Extenda',
    color: '#ffffff',
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 2,
  },
  subtitle: {
    fontSize: 9,
    color: 'rgba(10,10,10,0.6)',
    fontFamily: 'Bungee',
    letterSpacing: 0.6,
  },
});
