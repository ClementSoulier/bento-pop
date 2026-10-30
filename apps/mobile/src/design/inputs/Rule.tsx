import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { Text } from '../Text';
import { useTheme } from '../theme';

export type RuleProps = {
  /** `check` par défaut. */
  icon?: IconName;
  /** `no` : un interdit, l'icône sur fond rouge pâle. */
  tone?: 'default' | 'no';
  /** La phrase ; son mot clé dans un `<Text variant="body" weight={600}>`. */
  children: ReactNode;
};

/**
 * Une règle du jeu, à l'accueil (chantier 30, famille des listes et de la
 * saisie) : une icône de 18 dans un carré de 32 aux coins de 10, et une
 * phrase. L'icône ne dit rien que la phrase ne dise : elle est tue.
 */
export function Rule({ icon = 'check', tone = 'default', children }: RuleProps) {
  const { colors, radius } = useTheme();
  const no = tone === 'no';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 32,
          height: 32,
          borderRadius: radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: no ? colors['danger-soft'] : colors['bg-sunken'],
        }}
      >
        <Icon name={icon} size={18} color={no ? 'on-danger-soft' : 'text-primary'} />
      </View>
      <Text variant="body" style={{ flex: 1, paddingTop: 5 }}>
        {children}
      </Text>
    </View>
  );
}
