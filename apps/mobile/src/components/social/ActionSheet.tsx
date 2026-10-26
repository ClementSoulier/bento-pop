import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CONTROL_MAX_FONT_MULTIPLIER, scaledType } from '@/components/bento/font-scaling';
import { stampShadow } from '@/components/primitives';

export type SheetAction = { label: string; destructive?: boolean; onPress: () => void };

/**
 * Les actions d'un commentaire, chantier 22 (§5.2) : signaler, bloquer,
 * supprimer. Une alerte système ne suffit pas : Android n'y affiche que trois
 * boutons, et le propriétaire d'un bento en a quatre devant le commentaire
 * d'un autre, « Annuler » compris.
 *
 * Une `Modal` transparente : le bouton retour d'Android la ferme
 * (`onRequestClose`), et le fond touché aussi.
 *
 * **Le fond et le panneau sont frères**, pas l'un dans l'autre : un élément
 * accessible masque ses enfants sur iOS, et un fond qui enveloppait le
 * panneau ne laissait au lecteur d'écran qu'un bouton, « Fermer ». Relevé par
 * `idb` à la recette du lot 3.
 */
export function ActionSheet({
  visible,
  title,
  actions,
  onClose,
}: {
  visible: boolean;
  title?: string;
  actions: readonly SheetAction[];
  onClose: () => void;
}) {
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const label = scaledType(fontScale, CONTROL_MAX_FONT_MULTIPLIER, 16, 21);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,10,10,0.45)' }]}
        />
        <View
          accessibilityViewIsModal
          style={[
            {
              margin: 12,
              marginBottom: 12 + insets.bottom,
              backgroundColor: '#fbf3de',
              borderWidth: 3,
              borderColor: '#0a0a0a',
              borderRadius: 24,
              padding: 8,
              gap: 4,
            },
            stampShadow(4),
          ]}
        >
          {title ? (
            <Text
              accessibilityRole="header"
              allowFontScaling={false}
              numberOfLines={2}
              style={{
                ...scaledType(fontScale, CONTROL_MAX_FONT_MULTIPLIER, 13, 18),
                color: 'rgba(10,10,10,0.6)',
                fontWeight: '600',
                textAlign: 'center',
                paddingVertical: 8,
                paddingHorizontal: 12,
              }}
            >
              {title}
            </Text>
          ) : null}
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={() => {
                onClose();
                action.onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              style={{
                minHeight: 48,
                justifyContent: 'center',
                paddingHorizontal: 16,
                borderRadius: 16,
              }}
            >
              <Text
                allowFontScaling={false}
                style={{
                  ...label,
                  fontWeight: '700',
                  color: action.destructive ? '#c1121f' : '#0a0a0a',
                }}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
          <View
            style={{ height: 1, backgroundColor: 'rgba(10,10,10,0.15)', marginHorizontal: 12 }}
          />
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Annuler"
            style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 }}
          >
            <Text
              allowFontScaling={false}
              style={{ ...label, fontWeight: '600', color: '#0a0a0a' }}
            >
              Annuler
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
