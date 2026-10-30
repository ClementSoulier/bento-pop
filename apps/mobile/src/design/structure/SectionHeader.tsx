import { View } from 'react-native';
import { Button } from '../actions/Button';
import type { IconName } from '../icons';
import { Text } from '../Text';

export type SectionHeaderProps = {
  title: string;
  /** Un lien texte à droite : « Tout voir ». */
  action?: string;
  actionIcon?: IconName;
  onAction?: () => void;
};

/**
 * Le titre d'une section dans un écran qui défile (chantier 30, famille de la
 * structure) : « Pourquoi ces choix », « Succès ». Un titre pour les lecteurs
 * d'écran, qui passent de l'un à l'autre.
 */
export function SectionHeader({ title, action, actionIcon, onAction }: SectionHeaderProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        minHeight: 28,
      }}
    >
      <Text variant="title-3" accessibilityRole="header" style={{ flexShrink: 1 }}>
        {title}
      </Text>
      {action ? (
        <Button variant="tertiary" size="sm" label={action} icon={actionIcon} onPress={onAction} />
      ) : null}
    </View>
  );
}
