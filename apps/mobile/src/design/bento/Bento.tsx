import { useEffect, useState, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { CategoryKey } from '@/supabase/types';
import { PopShadow } from '../PopShadow';
import { useTheme } from '../theme';
import { timingConfig, useMotion } from '../useMotion';
import {
  BENTO_ROWS,
  PLATE,
  emptyBentoLabel,
  plateRows,
  tileMinHeights,
  tileWidth,
  type BentoDensity,
} from './bento-rules';
import { BentoTile, type BentoTileItem } from './BentoTile';

/** Une case du plateau, telle qu'un écran la donne. */
export type BentoSlot = {
  key: string;
  /** `null` : un type sans couleur, cf. `caseCategory`. */
  category: CategoryKey | null;
  /** « Film », ou la question d'une édition. */
  label: string;
  /** `label` est la question d'une édition. */
  question?: boolean;
  /** Le tampon, « FILM ». */
  stamp: string;
  item?: BentoTileItem | null;
  /** La case à remplir maintenant. */
  next?: boolean;
};

export type BentoProps = {
  /** De 2 à 6 cases. Sans elles, le plateau vide d'illustration, qui se lit d'un seul libellé. */
  slots?: readonly BentoSlot[];
  density?: BentoDensity;
  /** `edit` montre le « + » des cases vides ; `view`, des cases vides sans rien. */
  mode?: 'edit' | 'view';
  /** Une case touchée, par sa clé. Sans lui, rien ne se touche. */
  onSlotPress?: (key: string) => void;
  /** La case qui vient d'arriver, et un jeton qui rejoue sa chute. */
  dropped?: { caseKey: string; seq: number } | null;
  /** La hauteur que le composer rend à ce qui l'entoure sur un écran court (D8). */
  heightScale?: number;
  /** La largeur du plateau quand l'écran la connaît : sur l'image partagée. */
  width?: number;
  /** Ce que lit le lecteur d'écran à la place des cases, sur le plateau d'illustration. */
  label?: string;
};

/**
 * Le plateau de 2 à 6 cases (chantiers 31 et 32) : le seul objet de l'écran qui
 * porte le contour encre et l'ombre franche. Il prend la largeur que son parent
 * lui laisse ; avant sa première mesure, il compte sur la largeur de l'écran
 * moins ses marges, ce qui évite un saut de hauteur à l'arrivée.
 */
export function Bento({
  slots,
  density = 'compose',
  mode = 'edit',
  onSlotPress,
  dropped = null,
  heightScale = 1,
  width: givenWidth,
  label = emptyBentoLabel(),
}: BentoProps) {
  const { colors, palette, radius, size } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [laidWidth, setLaidWidth] = useState<number>();
  const width = givenWidth ?? laidWidth ?? windowWidth - 2 * size['screen-margin'];
  const plate = PLATE[density];
  const share = density === 'share';
  const plateStyle = {
    gap: plate.gap,
    padding: plate.padding,
    borderRadius: plate.radius,
    borderWidth: plate.border,
    borderColor: share ? palette['nori-900'] : colors['plate-outline'],
    backgroundColor: share ? palette['rice-100'] : colors['bg-plate'],
  };

  if (!slots) {
    const heights = tileMinHeights(width);
    return (
      <PopShadow
        level="pop-lg"
        radius={radius.xl}
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        onLayout={(event) => setLaidWidth(event.nativeEvent.layout.width)}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={plateStyle}
        >
          {BENTO_ROWS.map((row) => (
            <View key={row[0]?.category} style={{ flexDirection: 'row', gap: plate.gap }}>
              {row.map((tile) => (
                <BentoTile
                  key={tile.category}
                  category={tile.category}
                  size={tile.size}
                  minHeight={heights[tile.size]}
                />
              ))}
            </View>
          ))}
        </View>
      </PopShadow>
    );
  }

  const rows = plateRows(slots.length, width, density, heightScale);
  let index = 0;
  return (
    <PopShadow
      level="pop-lg"
      offset={share ? plate.shadow : undefined}
      radius={plate.radius}
      onLayout={givenWidth ? undefined : (event) => setLaidWidth(event.nativeEvent.layout.width)}
    >
      <View style={plateStyle}>
        {rows.map((row, rowIndex) => {
          const cases = slots.slice(index, index + row.cases);
          index += row.cases;
          const caseWidth = tileWidth(width, row.cases, density);
          return (
            <View key={rowIndex} style={{ flexDirection: 'row', gap: plate.gap }}>
              {cases.map((slot) => (
                <TileDrop
                  key={slot.key}
                  trigger={dropped?.caseKey === slot.key ? dropped.seq : null}
                >
                  <BentoTile
                    category={slot.category}
                    size={row.size}
                    density={density}
                    mode={mode}
                    item={slot.item}
                    label={slot.label}
                    question={slot.question}
                    stamp={slot.stamp}
                    next={slot.next}
                    minHeight={row.height}
                    width={caseWidth}
                    onPress={onSlotPress ? () => onSlotPress(slot.key) : undefined}
                  />
                </TileDrop>
              ))}
            </View>
          );
        })}
      </View>
    </PopShadow>
  );
}

/**
 * Une case qui arrive tombe dans le plateau : 320 ms avec un léger rebond, ou un
 * fondu de 120 ms quand le système réduit les animations. `trigger` plutôt qu'un
 * booléen : remplacer deux fois de suite l'item d'une même case rejoue la chute.
 */
function TileDrop({ trigger, children }: { trigger: number | null; children: ReactNode }) {
  const motion = useMotion();
  const progress = useSharedValue(1);
  const moves = !motion.reduced;
  useEffect(() => {
    if (trigger === null) return;
    progress.value = 0;
    progress.value = withTiming(1, timingConfig(motion.enter('slow')));
    // La chute se joue à chaque jeton, pas quand le réglage du système change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
  const fall = useAnimatedStyle(() =>
    moves ? { transform: [{ scale: 0.88 + 0.12 * progress.value }] } : { opacity: progress.value },
  );
  return <Animated.View style={[{ flex: 1 }, fall]}>{children}</Animated.View>;
}
