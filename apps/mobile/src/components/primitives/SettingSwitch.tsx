import { Pressable, Switch, Text, View } from 'react-native';
import { CONTENT_MAX_FONT_MULTIPLIER } from '@/components/bento/font-scaling';
import { INK_MUTED } from './ink';

/**
 * La piste d'un interrupteur éteint : 3,7 : 1 sur le blanc de la ligne, au-dessus
 * des 3 : 1 que demande un composant d'interface. Le gris à 20 % qu'on voit
 * partout n'en fait que 1,6 (calculés sur les luminances relatives).
 */
const TRACK_OFF = 'rgba(10,10,10,0.5)';

/**
 * Le premier interrupteur de l'app. Chantier 17, lot 4, §5.4.
 *
 * Toute la ligne est la cible, jamais moins de 44 points, et un lecteur
 * d'écran n'y trouve qu'un élément : le rôle `switch`, l'état, le libellé,
 * et ce qu'il règle en indication. L'interrupteur natif ne fait que montrer
 * l'état : il ne reçoit ni le toucher ni le focus, sinon la ligne serait lue
 * deux fois. Les textes passent à la ligne à la plus grande police.
 */
export function SettingSwitch({
  label,
  description,
  value,
  onChange,
  note,
  disabled = false,
}: {
  label: string;
  /** Ce que l'interrupteur règle, lu après le libellé. */
  description: string;
  value: boolean;
  onChange: (next: boolean) => void;
  /** Une précision sous la description, par exemple un canal coupé par le système. */
  note?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={note ? `${description} ${note}` : description}
      accessibilityState={{ checked: value, disabled }}
      style={{
        minHeight: 56,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        borderWidth: 2,
        borderColor: '#0a0a0a',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
          style={{ fontSize: 14, fontWeight: '600', color: '#0a0a0a' }}
        >
          {label}
        </Text>
        <Text maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER} style={{ fontSize: 12, color: INK_MUTED }}>
          {description}
        </Text>
        {note ? (
          <Text
            maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
            style={{ fontSize: 12, fontWeight: '600', color: '#0a0a0a' }}
          >
            {note}
          </Text>
        ) : null}
      </View>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Switch
          value={value}
          disabled={disabled}
          trackColor={{ false: TRACK_OFF, true: '#0a0a0a' }}
          ios_backgroundColor={TRACK_OFF}
          thumbColor="#ffffff"
        />
      </View>
    </Pressable>
  );
}
