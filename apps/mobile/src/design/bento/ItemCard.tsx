import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import {
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { busyA11y } from '@/lib/a11y-states';
import { itemImageUrl } from '@/lib/item-image';
import type { CategoryKey } from '@/supabase/types';
import { SkeletonBar, useSkeletonPulse } from '../overlays/Skeleton';
import { Text } from '../Text';
import { useTheme } from '../theme';
import { displayFit, textStyle } from '../type';
import { tileInitial } from './bento-rules';
import { CATEGORY_STYLES } from './categories';
import {
  ITEM_CARD_GAP,
  ITEM_GRID,
  ITEM_SUBTITLE_GAP,
  itemCardAccessibilityLabel,
  itemColumnWidth,
  itemGridRows,
} from './item-grid-rules';

export type ItemCardItem = {
  title: string;
  /** L'année d'un film, le métier d'une personne. */
  subtitle?: string | null;
  imageUrl?: string | null;
};

export type ItemCardProps = {
  item: ItemCardItem;
  /** La case cherchée : la couleur d'une affiche absente. `null`, un type sans couleur. */
  category: CategoryKey | null;
  /** La largeur de la colonne, pour demander une affiche à sa taille. */
  width?: number;
  /** « Choisir Inception, 2010 » par défaut. */
  accessibilityLabel?: string;
  onPress?: () => void;
};

/**
 * Le liseré d'une affiche, `inset 0 0 0 1px rgba(14, 14, 14, .08)` du dossier :
 * il détache une image claire du fond de la feuille.
 */
const POSTER_EDGE = 'rgba(14,14,14,0.08)';

/**
 * Un item du catalogue en résultat de recherche (chantier 32, lot 3) :
 * l'affiche en 2/3, ou la couleur de la case et son initiale géante ; le titre
 * sur deux lignes au plus, le sous-titre sur une. Toujours dans une `ItemGrid`.
 *
 * Le titre prend `footnote` en 600, 13 sur 18, le plus proche des 14 sur 18 du
 * dossier (D17 du 30) : la hauteur de ses lignes est celle de la maquette.
 */
export function ItemCard({ item, category, width, accessibilityLabel, onPress }: ItemCardProps) {
  const { colors, palette, radius } = useTheme();
  // La densité d'un écran ne change pas : lue une fois, pas à chaque affiche.
  const pixelRatio = useMemo(() => PixelRatio.get(), []);
  const style = category ? CATEGORY_STYLES[category] : null;
  const uri = item.imageUrl
    ? width
      ? itemImageUrl(item.imageUrl, width, pixelRatio)
      : item.imageUrl
    : null;
  const label = accessibilityLabel ?? itemCardAccessibilityLabel(item.title, item.subtitle);
  // Un mot ne se coupe pas au milieu (D7, et le chantier 11 avant lui) : au-delà de
  // 200 % au SE, « Interstellar » et « Inception » sortaient en deux morceaux dans
  // leur colonne de 105. Le plus long mot se mesure dans une copie invisible ; s'il
  // dépasse, le titre rapetisse juste assez, comme une affiche (`displayFit`).
  const { fontScale } = useWindowDimensions();
  const [titleWidth, setTitleWidth] = useState(0);
  const [widest, setWidest] = useState(0);
  const words = item.title.trim().split(/\s+/);
  const fit = displayFit(titleWidth, widest);
  const base = textStyle('footnote', fontScale, 600);
  const fitted =
    fit < 1 ? { fontSize: base.fontSize * fit, lineHeight: base.lineHeight * fit } : null;
  const content = (
    <>
      <View
        style={{
          aspectRatio: 2 / 3,
          overflow: 'hidden',
          borderRadius: radius.sm,
          backgroundColor: style ? colors[style.color] : colors['bg-sunken'],
        }}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            // Les propositions reviennent d'une ouverture à l'autre : le disque
            // les garde, ce qui rend le bloc « Au menu » tenable côté egress.
            cachePolicy="memory-disk"
            transition={120}
            // Une affiche recyclée ne montre pas celle du résultat d'avant.
            recyclingKey={uri}
          />
        ) : (
          <Text
            variant="display-m"
            importantForAccessibility="no"
            accessibilityElementsHidden
            style={{
              position: 'absolute',
              right: '-10%',
              top: '-6%',
              fontSize: 120,
              lineHeight: 120,
              letterSpacing: 0,
              opacity: 0.16,
              color: style ? colors[style.deep] : palette['nori-900'],
            }}
          >
            {tileInitial(item.title)}
          </Text>
        )}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: radius.sm, borderWidth: 1, borderColor: POSTER_EDGE },
          ]}
        />
      </View>
      <View onLayout={(event) => setTitleWidth(event.nativeEvent.layout.width)}>
        {/* Chaque mot du titre sur sa ligne, invisible : la largeur du plus long. */}
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ position: 'absolute', top: 0, left: 0, width: 2000, opacity: 0 }}
        >
          <Text
            variant="footnote"
            weight={600}
            onTextLayout={(event) =>
              setWidest(Math.max(0, ...event.nativeEvent.lines.map((line) => line.width)))
            }
          >
            {words.join('\n')}
          </Text>
        </View>
        <Text
          variant="footnote"
          weight={600}
          numberOfLines={2}
          // Android coupe au milieu d'un mot avec ses réglages par défaut (chantier 7).
          textBreakStrategy="simple"
          android_hyphenationFrequency="normal"
          style={fitted}
        >
          {item.title}
        </Text>
      </View>
      {item.subtitle ? (
        <Text
          variant="caption"
          weight={400}
          color="text-secondary"
          numberOfLines={1}
          style={{ marginTop: ITEM_SUBTITLE_GAP - ITEM_CARD_GAP }}
        >
          {item.subtitle}
        </Text>
      ) : null}
    </>
  );
  const frame = { gap: ITEM_CARD_GAP, minWidth: 0 } as const;
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} style={frame}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={frame}
    >
      {content}
    </Pressable>
  );
}

export type ItemGridEntry = ItemCardItem & {
  id: string;
  /** Ce que dit le lecteur d'écran, quand l'écran en sait plus que l'item. */
  accessibilityLabel?: string;
};

export type ItemGridProps<T extends ItemGridEntry = ItemGridEntry> = {
  items: readonly T[];
  /** La case cherchée. */
  category: CategoryKey | null;
  onItemPress?: (item: T, index: number) => void;
};

/**
 * La grille des résultats d'une case (chantier 32, lot 3) : trois colonnes, 10
 * entre elles, 16 entre les rangées ; « Au menu » ou « 1 résultat » au-dessus,
 * que l'écran pose. Au plus vingt résultats ou douze propositions : elle ne
 * virtualise rien, elle se pose dans le défilement de la feuille.
 */
export function ItemGrid<T extends ItemGridEntry>({
  items,
  category,
  onItemPress,
}: ItemGridProps<T>) {
  const { size } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [laid, setLaid] = useState<number>();
  // Avant sa mise en page, la largeur d'une feuille ; ensuite, la sienne.
  const column = itemColumnWidth(laid ?? windowWidth - 2 * size['screen-margin']);
  return (
    <View
      style={{ gap: ITEM_GRID.rowGap }}
      onLayout={(event) => setLaid(event.nativeEvent.layout.width)}
    >
      {itemGridRows(items).map((row, rowIndex) => (
        <View
          key={rowIndex}
          // En haut, et non étirées : un item sans sous-titre garde sa hauteur.
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ITEM_GRID.columnGap }}
        >
          {row.map((item, columnIndex) =>
            item ? (
              <View key={item.id} style={{ flex: 1, minWidth: 0 }}>
                <ItemCard
                  item={item}
                  category={category}
                  width={column}
                  accessibilityLabel={item.accessibilityLabel}
                  onPress={
                    onItemPress
                      ? () => onItemPress(item, rowIndex * ITEM_GRID.columns + columnIndex)
                      : undefined
                  }
                />
              </View>
            ) : (
              <View key={`vide-${columnIndex}`} style={{ flex: 1 }} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

/**
 * Une rangée de la grille qui charge : trois affiches, un titre, un
 * sous-titre. Une seule rangée, ce que le clavier laisse voir : remplir l'écran
 * pour un chargement d'environ 50 ms ressemblerait plus à une panne qu'à une
 * attente. Le lecteur d'écran n'y lit qu'un élément, « Chargement », occupé.
 */
export function ItemGridSkeleton() {
  const { radius } = useTheme();
  const pulse = useSkeletonPulse();
  const a11y = busyA11y({ busy: true }, Platform.OS);
  return (
    <View
      accessible
      accessibilityLabel="Chargement"
      accessibilityState={a11y.state}
      accessibilityValue={a11y.value}
      style={{ flexDirection: 'row', gap: ITEM_GRID.columnGap }}
    >
      {Array.from({ length: ITEM_GRID.columns }, (_, index) => (
        <View key={index} style={{ flex: 1, gap: 8 }}>
          <SkeletonBar
            pulse={pulse}
            style={{ alignSelf: 'stretch', aspectRatio: 2 / 3, borderRadius: radius.sm }}
          />
          <SkeletonBar pulse={pulse} style={{ width: '80%', height: 12, borderRadius: 6 }} />
          <SkeletonBar pulse={pulse} style={{ width: '50%', height: 10, borderRadius: 5 }} />
        </View>
      ))}
    </View>
  );
}
