import { View } from 'react-native';
import { Button } from '../actions/Button';
import { Popy } from '../brand/Popy';
import type { Mood } from '../brand/popy-images';
import { Text } from '../Text';

export type PromptCardProps = {
  /** `content` par défaut. */
  mood?: Mood;
  text: string;
  action?: string;
  onAction?: () => void;
};

/**
 * Une invite avec Popy, à la place d'une action pas encore possible :
 * commenter sans compte gardé (chantier 30, famille des calques et des
 * retours). Popy de 52 et la phrase côte à côte, le bouton principal dessous,
 * sur toute la largeur.
 */
export function PromptCard({ mood = 'content', text, action, onAction }: PromptCardProps) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Popy mood={mood} size={52} />
        <Text variant="subhead" style={{ flex: 1 }}>
          {text}
        </Text>
      </View>
      {action ? <Button variant="primary" block label={action} onPress={onAction} /> : null}
    </View>
  );
}
