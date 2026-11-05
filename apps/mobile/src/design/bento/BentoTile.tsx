import { CATEGORY_META } from '@bento-pop/supabase-mobile/bento';
import { useWindowDimensions, View } from 'react-native';
import type { CategoryKey } from '@/supabase/types';
import { Icon } from '../Icon';
import { PopShadow } from '../PopShadow';
import { Text } from '../Text';
import { useTheme } from '../theme';
import { TILE_RATIO, tilePrompt, tilePromptType, type TileSize } from './bento-rules';

export type BentoTileProps = {
  category: CategoryKey;
  /** `xl` la grande, `l` une moyenne, `s` une petite. */
  size?: TileSize;
  /** Dans un plateau, la hauteur de sa rangée. Seule, la case prend ses proportions. */
  minHeight?: number;
};

/**
 * Une case du bento (chantier 31, D3), dans son seul état vide de composition :
 * des pointillés, un « + » sur son ombre et la catégorie. Elle ne se touche pas
 * encore : c'est une illustration. Le chantier 32 la complète, les cases
 * remplies, en attente, celle à remplir maintenant et les autres densités.
 */
export function BentoTile({ category, size = 'l', minHeight }: BentoTileProps) {
  const { colors, border, radius } = useTheme();
  const { fontScale } = useWindowDimensions();
  const { label } = CATEGORY_META[category];
  const small = size === 's';
  const plus = small ? 30 : 36;
  return (
    <View
      accessible
      accessibilityLabel={`${label} : case vide`}
      style={[
        minHeight === undefined ? { aspectRatio: TILE_RATIO[size] } : { flex: 1, minHeight },
        {
          padding: 10,
          gap: 8,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: small ? radius.md : radius.lg,
          borderWidth: border.ink,
          borderStyle: 'dashed',
          borderColor: colors['border-strong'],
          backgroundColor: colors['bg-surface'],
        },
      ]}
    >
      <PopShadow level="pop-sm" radius={plus / 2}>
        <View
          style={{
            width: plus,
            height: plus,
            borderRadius: plus / 2,
            borderWidth: border.ink,
            borderColor: colors.ink,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="plus" size={small ? 16 : 18} color="on-accent" />
        </View>
      </PopShadow>
      <Text variant="label-s" style={[tilePromptType(size, fontScale), { textAlign: 'center' }]}>
        {tilePrompt(label)}
      </Text>
    </View>
  );
}
