import { Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { busyA11y } from '@/lib/a11y-states';
import { usePress } from '../actions/usePress';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { Spinner } from '../overlays/Spinner';
import { Text } from '../Text';
import { reachesWrapScale } from '../type';
import { PressedFill, ROW, RowRule, useInList } from './List';
import { SwitchTrack } from './Switch';

export type ListRowTrailing = 'chevron' | 'external' | 'switch' | 'spinner' | 'none';

export type ListRowProps = {
  icon?: IconName;
  title: string;
  subtitle?: string;
  /** Une conséquence, en gras sous la description. */
  note?: string;
  /** Une valeur à droite : l'adresse qui garde le compte. */
  detail?: string;
  /**
   * `chevron` par défaut ; `external` pour un lien qui sort de l'app ;
   * `switch`, la ligne règle un interrupteur ; `spinner`, une attente ;
   * `none`, rien.
   */
  trailing?: ListRowTrailing;
  /** L'état de l'interrupteur, avec `trailing="switch"`. */
  checked?: boolean;
  onPress?: () => void;
  /** Avec `trailing="switch"` : la ligne entière bascule l'interrupteur. */
  onValueChange?: (next: boolean) => void;
  /** `danger` : la ligne destructive, seule dans son groupe. */
  tone?: 'default' | 'danger';
  /** Le titre en gras. */
  strong?: boolean;
  disabled?: boolean;
};

/**
 * Une ligne de liste (chantier 30, famille des listes et de la saisie) :
 * icône de 24, titre, description et note, et à droite une valeur, un
 * chevron, une flèche sortante, un interrupteur ou une attente.
 *
 * Le lecteur d'écran n'y trouve qu'un élément. Avec un interrupteur, c'est la
 * ligne qui a le rôle `switch` et le bascule, comme `SettingSwitch` depuis le
 * chantier 17 ; la description et la note se lisent en indication. Une ligne
 * sans action se lit comme un texte.
 *
 * Dès 130 %, la valeur passe sous le titre au lieu de le serrer (D18).
 */
export function ListRow({
  icon,
  title,
  subtitle,
  note,
  detail,
  trailing = 'chevron',
  checked = false,
  onPress,
  onValueChange,
  tone = 'default',
  strong,
  disabled,
}: ListRowProps) {
  const inList = useInList();
  const { fontScale } = useWindowDimensions();
  const { pressed, onPressIn, onPressOut } = usePress();
  const danger = tone === 'danger';
  const stacked = reachesWrapScale(fontScale);
  const hint = [subtitle, note].filter(Boolean).join(' ') || undefined;

  const content = (
    <>
      <PressedFill pressed={pressed} />
      {icon ? <Icon name={icon} size={24} color={danger ? 'text-danger' : 'text-primary'} /> : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          variant={strong || danger ? 'body-strong' : 'body'}
          color={danger ? 'text-danger' : 'text-primary'}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" color="text-secondary">
            {subtitle}
          </Text>
        ) : null}
        {note ? (
          <Text variant="footnote" weight={600} style={{ marginTop: 2 }}>
            {note}
          </Text>
        ) : null}
        {detail && stacked ? (
          <Text variant="subhead" color="text-secondary">
            {detail}
          </Text>
        ) : null}
      </View>
      {detail && !stacked ? (
        <Text variant="subhead" color="text-secondary" numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
      {trailing === 'chevron' ? <Icon name="caret-right" size={20} color="text-tertiary" /> : null}
      {trailing === 'external' ? (
        <Icon name="arrow-up-right" size={20} color="text-tertiary" />
      ) : null}
      {trailing === 'switch' ? <SwitchTrack checked={checked} disabled={disabled} /> : null}
      {trailing === 'spinner' ? <Spinner size={18} /> : null}
      {inList ? <RowRule inset={icon ? 52 : 16} /> : null}
    </>
  );

  if (trailing === 'switch') {
    return (
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={title}
        accessibilityHint={hint}
        accessibilityState={{ checked, disabled: Boolean(disabled) }}
        disabled={disabled}
        onPress={() => onValueChange?.(!checked)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={ROW}
      >
        {content}
      </Pressable>
    );
  }

  const busy = busyA11y({ disabled: Boolean(disabled), busy: trailing === 'spinner' }, Platform.OS);
  const label = detail ? `${title}, ${detail}` : title;
  if (onPress) {
    return (
      <Pressable
        accessibilityRole={trailing === 'external' ? 'link' : 'button'}
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityState={busy.state}
        accessibilityValue={busy.value}
        disabled={disabled}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={ROW}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View
      accessible
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      accessibilityState={busy.state}
      accessibilityValue={busy.value}
      style={ROW}
    >
      {content}
    </View>
  );
}
