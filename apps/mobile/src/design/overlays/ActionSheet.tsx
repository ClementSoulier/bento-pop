import { Pressable, ScrollView, View } from 'react-native';
import { usePress } from '../actions/usePress';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { PressedFill } from '../inputs/List';
import { Text } from '../Text';
import { useTheme } from '../theme';
import { SheetLayer } from './Layer';

export type ActionSheetAction = {
  label: string;
  icon?: IconName;
  /** L'option destructive, en dernier, avant « Annuler ». */
  tone?: 'danger';
  onPress: () => void;
};

export type ActionSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Un titre discret, « Options pour @lea.cine ». */
  title?: string;
  actions: readonly ActionSheetAction[];
  /** « Annuler » par défaut. */
  cancelLabel?: string;
  /** Pour le catalogue : posée dans son parent, sans `Modal`, comme dans l'aperçu. */
  inline?: boolean;
};

/**
 * Le menu d'options qui monte du bas (chantier 30, famille des calques et
 * des retours) : un titre discret, des lignes de 56 icône et libellé, la
 * destructive en rouge, puis « Annuler » à part. Une option ferme le menu
 * avant d'agir.
 *
 * Chaque option est un bouton pour le lecteur d'écran : React Native dirait
 * en anglais le rôle « menu item » sur iOS.
 */
export function ActionSheet({
  visible,
  onClose,
  title,
  actions,
  cancelLabel = 'Annuler',
  inline,
}: ActionSheetProps) {
  const { colors, border } = useTheme();
  return (
    <SheetLayer visible={visible} onClose={onClose} closeLabel={cancelLabel} inline={inline}>
      <ScrollView
        style={{ flexGrow: 0 }}
        bounces={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 4 }}
      >
        {title ? (
          <Text
            variant="footnote"
            color="text-secondary"
            accessibilityRole="header"
            style={{ textAlign: 'center', paddingTop: 10, paddingHorizontal: 16, paddingBottom: 8 }}
          >
            {title}
          </Text>
        ) : null}
        {actions.map((action) => (
          <ActionItem
            key={action.label}
            label={action.label}
            icon={action.icon}
            danger={action.tone === 'danger'}
            onPress={() => {
              onClose();
              action.onPress();
            }}
          />
        ))}
        <View
          style={{
            height: border.hairline,
            marginVertical: 6,
            marginHorizontal: 12,
            backgroundColor: colors['border-subtle'],
          }}
        />
        <ActionItem label={cancelLabel} cancel onPress={onClose} />
      </ScrollView>
    </SheetLayer>
  );
}

function ActionItem({
  label,
  icon,
  danger,
  cancel,
  onPress,
}: {
  label: string;
  icon?: IconName;
  danger?: boolean;
  cancel?: boolean;
  onPress: () => void;
}) {
  const { pressed, onPressIn, onPressOut } = usePress();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: cancel ? 'center' : 'flex-start',
        gap: 14,
        minHeight: 56,
        paddingHorizontal: 12,
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <PressedFill pressed={pressed} />
      {icon ? <Icon name={icon} size={24} color={danger ? 'text-danger' : 'text-primary'} /> : null}
      <Text
        variant="body-l"
        weight={danger || cancel ? 600 : 500}
        color={danger ? 'text-danger' : 'text-primary'}
        style={{ flexShrink: 1 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
