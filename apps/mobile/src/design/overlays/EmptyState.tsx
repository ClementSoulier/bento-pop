import { View, useWindowDimensions } from 'react-native';
import { Button, type ButtonVariant } from '../actions/Button';
import { Popy } from '../brand/Popy';
import type { Mood } from '../brand/popy-images';
import { Text } from '../Text';
import { textStyle } from '../type';

export type EmptyStateProps = {
  /** `content` par défaut. */
  mood?: Mood;
  title?: string;
  message?: string;
  action?: string;
  onAction?: () => void;
  /** `primary` par défaut. */
  actionVariant?: ButtonVariant;
  /** La taille de Popy, 120 par défaut ; de 88 à 120 dans un parcours ou un état vide. */
  size?: number;
};

/**
 * L'état vide d'une liste : Popy, une phrase, une action (chantier 30,
 * famille des calques et des retours). Centré, Popy qui se dandine, le titre
 * en `title-2`, le message sur 30 caractères de large au plus, comme le
 * `30ch` du CSS (le zéro d'Inter fait 0,62 de la taille du texte).
 */
export function EmptyState({
  mood = 'content',
  title,
  message,
  action,
  onAction,
  actionVariant = 'primary',
  size = 120,
}: EmptyStateProps) {
  const { fontScale } = useWindowDimensions();
  const { fontSize } = textStyle('body', fontScale);
  return (
    <View style={{ alignItems: 'center', gap: 10, padding: 24 }}>
      <Popy mood={mood} size={size} wiggle />
      {title ? (
        <Text
          variant="title-2"
          accessibilityRole="header"
          style={{ marginTop: 6, textAlign: 'center' }}
        >
          {title}
        </Text>
      ) : null}
      {message ? (
        <Text
          variant="body"
          color="text-secondary"
          style={{ textAlign: 'center', maxWidth: 30 * 0.62 * fontSize }}
        >
          {message}
        </Text>
      ) : null}
      {action ? (
        <Button
          variant={actionVariant}
          label={action}
          onPress={onAction}
          style={{ marginTop: 10 }}
        />
      ) : null}
    </View>
  );
}
