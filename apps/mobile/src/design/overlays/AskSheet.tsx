import { ScrollView, View, useWindowDimensions } from 'react-native';
import { Button, type ButtonVariant } from '../actions/Button';
import { Popy } from '../brand/Popy';
import type { Mood } from '../brand/popy-images';
import { Text } from '../Text';
import { textStyle } from '../type';
import { Confetti } from './Confetti';
import { SheetLayer } from './Layer';

export type AskSheetProps = {
  visible: boolean;
  /** Le voile, la poignée tirée, le retour d'Android, et par défaut l'action secondaire. */
  onClose: () => void;
  /** `content` par défaut. */
  mood?: Mood;
  /** La question. */
  title: string;
  /** Une phrase. */
  message?: string;
  primary: string;
  onPrimary: () => void;
  /** « Plus tard », « Non merci ». */
  secondary?: string;
  /** Ferme la feuille par défaut, sans reproche. */
  onSecondary?: () => void;
  /** `tertiary` par défaut. */
  secondaryVariant?: ButtonVariant;
  /** Une célébration : les confettis tombent sur la feuille. */
  confetti?: boolean;
  /** Pour le catalogue : posée dans son parent, sans `Modal`, comme dans l'aperçu. */
  inline?: boolean;
};

/**
 * La demande bienveillante avec Popy, avant une autorisation du système ou
 * un engagement : les notifications, garder son bento, les éditions
 * (chantier 30, famille des calques et des retours). Popy de 112 qui se
 * dandine, la question en `title-2`, une phrase, et deux boutons, le second
 * qui ferme sans reproche.
 *
 * Le message tient sur 32 caractères de large, comme le `32ch` du CSS : le
 * zéro d'Inter, qui fait l'unité, mesure 0,62 de la taille du texte. Le
 * contenu défile s'il dépasse l'écran, à 200 % sur un petit téléphone (D18).
 */
export function AskSheet({
  visible,
  onClose,
  mood = 'content',
  title,
  message,
  primary,
  onPrimary,
  secondary,
  onSecondary,
  secondaryVariant = 'tertiary',
  confetti,
  inline,
}: AskSheetProps) {
  const { fontScale } = useWindowDimensions();
  const { fontSize } = textStyle('body', fontScale);
  return (
    <SheetLayer
      visible={visible}
      onClose={onClose}
      inline={inline}
      overlay={confetti && visible ? <Confetti /> : null}
    >
      <ScrollView
        style={{ flexGrow: 0 }}
        bounces={false}
        contentContainerStyle={{
          alignItems: 'center',
          gap: 12,
          paddingTop: 8,
          paddingHorizontal: 24,
          paddingBottom: 8,
        }}
      >
        <Popy mood={mood} size={112} wiggle />
        <Text
          variant="title-2"
          accessibilityRole="header"
          style={{ marginTop: 4, textAlign: 'center' }}
        >
          {title}
        </Text>
        {message ? (
          <Text
            variant="body"
            color="text-secondary"
            style={{ textAlign: 'center', maxWidth: 32 * 0.62 * fontSize }}
          >
            {message}
          </Text>
        ) : null}
        <View style={{ alignSelf: 'stretch', marginTop: 12, gap: 8 }}>
          <Button variant="primary" block label={primary} onPress={onPrimary} />
          {secondary ? (
            <Button
              variant={secondaryVariant}
              block={secondaryVariant !== 'tertiary'}
              label={secondary}
              onPress={onSecondary ?? onClose}
            />
          ) : null}
        </View>
      </ScrollView>
    </SheetLayer>
  );
}
