import { Text, useWindowDimensions } from 'react-native';
import { CONTROL_MAX_FONT_MULTIPLIER, fontScaleFor } from '@/components/bento/font-scaling';
import { INK_MUTED } from './ink';

/**
 * Le titre d'une section, en petites capitales : les réglages et la
 * modification du profil (chantier 21).
 *
 * Un titre pour VoiceOver et TalkBack, qui passent de l'un à l'autre : ceux
 * de Notifications et de Confidentialité, écrits à part, ne l'étaient pas à
 * la recette du lot 3. La taille système appliquée par l'écran, cf.
 * `fontScaleFor` : laissée à la plateforme, elle ne suivait pas une taille
 * changée écran ouvert, sur iOS.
 */
export function SectionTitle({ children }: { children: string }) {
  const { fontScale } = useWindowDimensions();
  return (
    <Text
      accessibilityRole="header"
      numberOfLines={1}
      allowFontScaling={false}
      style={{
        fontFamily: 'Bungee',
        fontSize: 10 * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER),
        letterSpacing: 2,
        color: INK_MUTED,
        textTransform: 'uppercase',
        marginBottom: 4,
      }}
    >
      {children}
    </Text>
  );
}
