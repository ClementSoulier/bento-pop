import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { GRID_GEOMETRY } from './geometry';
import {
  EMPTY_TILE_BORDER,
  EMPTY_TILE_PADDING,
  TILE_LINE,
  emptyTileConf,
  emptyTileLabelScale,
} from './tile-text';
import { emptyTileLabelFit } from './tile-title';
import { INK_PLACEHOLDER } from '@/components/primitives/ink';

type EmptyTileProps = {
  /** Intitulé de la case. Pour une édition, la question posée. */
  prompt: string;
  height: number;
  /** Échelle propagée depuis BentoGrid (cf. Tile.scale). */
  scale?: number;
  rotate?: number;
  /**
   * Consultation : emplacement neutre au lieu de l'invitation à remplir.
   * Cf. le commentaire de `BentoGrid.readOnly`.
   */
  readOnly?: boolean;
  onPress?: () => void;
  /** Cf. `Tile.allowFontScaling`. */
  allowFontScaling?: boolean;
};

/**
 * Placeholder pour une catégorie non encore remplie.
 *
 * Deux variantes :
 *
 * - **composer** (défaut) : bordure pointillée, plus signe central, label
 *   tout-caps, `Pressable` qui ouvre la recherche ;
 * - **consultation** (`readOnly`) : même bordure pointillée, mais sans le
 *   plus ni l'accent jaune, et sans rôle de bouton. On regarde le bento de
 *   quelqu'un d'autre : rien à y remplir.
 *
 * Cf. design Claude Design — `EmptyTile` dans `bento-tiles.jsx`.
 */
export function EmptyTile({
  prompt,
  height,
  scale = 1,
  rotate = 0,
  readOnly = false,
  onPress,
  allowFontScaling = true,
}: EmptyTileProps) {
  const conf = emptyTileConf(scale);
  const labelFit = emptyTileLabelFit(prompt);
  // Le libellé applique lui-même la police système, hauteur de ligne comprise,
  // sans dépasser ce que la case permet : cf. `emptyTileLabelScale`. Figé à 1
  // quand la grille ne suit pas le système.
  const { fontScale } = useWindowDimensions();
  const labelScale = allowFontScaling
    ? emptyTileLabelScale(height, scale, fontScale, {
        lines: labelFit.numberOfLines,
        withCircle: !readOnly,
      })
    : 1;
  const labelStyle = {
    fontFamily: 'Bungee',
    fontSize: conf.label * labelScale,
    lineHeight: conf.label * TILE_LINE.emptyLabel * labelScale,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    // Centré ligne à ligne, sous le « + » centré. Sans lui, un libellé sur deux
    // lignes s'alignait à gauche : « LA SÉRIE QUE TU / CACHES » à la plus
    // grande police, recette du chantier 13, où les questions passent souvent
    // à la ligne.
    textAlign: 'center',
  } as const;

  const frame = {
    height,
    width: '100%',
    // Tint jaune léger pour bien se détacher du cream de la BentoFrame
    backgroundColor: '#fff4d8',
    borderWidth: EMPTY_TILE_BORDER,
    borderStyle: 'dashed',
    borderColor: 'rgba(10,10,10,0.45)',
    borderRadius: GRID_GEOMETRY.TILE_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    gap: conf.gap,
    padding: EMPTY_TILE_PADDING,
    transform: [{ rotate: `${rotate}deg` }],
  } as const;

  if (readOnly) {
    return (
      <View
        accessible
        accessibilityLabel={`${prompt} : case vide`}
        style={{ ...frame, borderColor: 'rgba(10,10,10,0.22)', backgroundColor: '#f6ecd4' }}
      >
        <Text
          numberOfLines={labelFit.numberOfLines}
          adjustsFontSizeToFit={labelFit.adjustsFontSizeToFit}
          allowFontScaling={false}
          style={[labelStyle, { color: INK_PLACEHOLDER }]}
        >
          {prompt}
        </Text>
      </View>
    );
  }

  // Sans action, la case n'est pas un bouton : sur l'écran de mécanique de
  // l'accueil, la grille est un dessin, et VoiceOver y annonçait six boutons
  // « Ajouter film » qui ne faisaient rien.
  const Frame = onPress ? Pressable : View;
  return (
    <Frame
      onPress={onPress}
      accessible
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={
        onPress ? `Ajouter ${prompt.toLowerCase()}` : `${prompt} : case vide`
      }
      accessibilityHint={onPress ? 'Ouvre la recherche pour remplir cette case' : undefined}
      style={frame}
    >
      <View
        style={{
          width: conf.circle,
          height: conf.circle,
          borderRadius: conf.circle / 2,
          backgroundColor: '#fbbf24',
          borderWidth: 2,
          borderColor: '#0a0a0a',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Un glyphe dans un cercle de taille fixe : grossi, il en sortait. */}
        <Text
          allowFontScaling={false}
          style={{
            fontSize: conf.plus,
            fontWeight: '800',
            color: '#0a0a0a',
            lineHeight: conf.plus + 2,
          }}
        >
          +
        </Text>
      </View>
      <Text
        // Deux lignes au plus, qui rétrécissent plutôt que de tronquer un
        // libellé : cf. `emptyTileLabelFit`.
        numberOfLines={labelFit.numberOfLines}
        adjustsFontSizeToFit={labelFit.adjustsFontSizeToFit}
        allowFontScaling={false}
        style={[labelStyle, { color: '#0a0a0a' }]}
      >
        {prompt}
      </Text>
    </Frame>
  );
}
