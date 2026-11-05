import { CATEGORY_META } from '@bento-pop/supabase-mobile/bento';
import { useWindowDimensions, View } from 'react-native';
import type { CategoryKey } from '@/supabase/types';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { useTheme } from '../theme';
import { tagType } from './bento-rules';
import { CATEGORY_STYLES } from './categories';

export type TagProps = {
  /** `null` : un type sans couleur, qui garde l'encre et le jaune. */
  category: CategoryKey | null;
  /** `media` encre sur une case, `surface` en couleur sur fond clair, `plain` en point coloré. */
  variant?: 'media' | 'surface' | 'plain';
  /** Remplace le libellé court : le tampon d'une case, ou la question d'une édition. */
  label?: string;
  /** Ajoute l'icône de la catégorie. */
  icon?: boolean;
  /** Deux lignes au plus, pour une question : la taille vient de `tagQuestionFit`. */
  fontSize?: number;
  /** La taille du système, 1 sur l'image partagée. */
  fontScale?: number;
};

/**
 * La puce de catégorie (chantier 32) : FILM, SÉRIE, ARTISTE, SON, CRÉA, LIEU. La
 * couleur ne parle jamais seule, la puce écrit toujours ce qu'elle est. Sur une
 * case d'édition remplie, elle grandit et porte la question (D2).
 */
export function Tag({ category, variant = 'media', label, icon, fontSize, fontScale }: TagProps) {
  const { colors, palette, radius } = useTheme();
  const window = useWindowDimensions();
  const style = category ? CATEGORY_STYLES[category] : null;
  const tint = style ? colors[style.color] : palette['yolk-300'];
  const text = label ?? (category ? CATEGORY_META[category].stamp : '');
  const type = tagType(fontScale ?? window.fontScale);
  const size = fontSize ?? type.fontSize;
  const ratio = size / type.fontSize;
  const textStyle = {
    fontSize: size,
    lineHeight: type.lineHeight * ratio,
    letterSpacing: Math.round(type.letterSpacing * ratio * 100) / 100,
  };
  if (variant === 'plain') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: tint,
            borderWidth: 1.5,
            borderColor: palette['nori-900'],
          }}
        />
        <Text variant="eyebrow" color="text-secondary" style={textStyle}>
          {text}
        </Text>
      </View>
    );
  }
  const surface = variant === 'surface';
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        minHeight: type.height,
        paddingHorizontal: type.paddingHorizontal,
        paddingVertical: type.paddingVertical,
        borderRadius: radius.xs,
        backgroundColor: surface ? tint : palette['nori-900'],
      }}
    >
      {icon && style ? (
        <Icon name={style.icon} size={12} color={surface ? 'text-primary' : style.color} />
      ) : null}
      <Text
        variant="eyebrow"
        numberOfLines={fontSize === undefined ? 1 : 2}
        // Un demi-point plus haut, comme sur la maquette : mesuré à l'iPhone 17 Pro
        // et au Pixel 8, le texte se pose un peu bas dans sa ligne de 14.
        style={[
          textStyle,
          { color: surface ? palette['nori-900'] : tint, transform: [{ translateY: -0.5 }] },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}
