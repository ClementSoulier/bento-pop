import type { ReactNode } from 'react';
import { Pressable, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { IconButton } from '../actions/IconButton';
import { Logo } from '../brand/Logo';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { Text } from '../Text';
import { useTheme } from '../theme';
import { WRAP_FONT_SCALE } from '../type';

/** Une action de droite : un bouton-icône, une pilule texte, ou un lien texte. */
export type TopBarAction =
  | { icon: IconName; label: string; onPress?: () => void; badge?: number; active?: boolean }
  | { kind: 'pill'; label: string; icon?: IconName; onPress?: () => void }
  | { label: string; onPress?: () => void; tone?: 'danger' };

export type TopBarProps = {
  /** `inline` pour un écran poussé, `large` pour une racine ou un parcours, `brand` pour La table. */
  variant?: 'inline' | 'large' | 'brand';
  title?: string;
  /** Au-dessus du grand titre : le pseudo, par exemple. */
  eyebrow?: string;
  /** Sous le grand titre. */
  subtitle?: string;
  /** Montre le bouton retour. */
  onBack?: () => void;
  backLabel?: string;
  /** Montre le bouton fermer, à la place du retour. */
  onClose?: () => void;
  closeLabel?: string;
  /** Deux au plus ; une troisième passe dans le menu `dots-three`. */
  actions?: TopBarAction[];
  /** Un filet en bas, quand le contenu défile dessous. */
  border?: boolean;
  /** Posés sous la barre. */
  children?: ReactNode;
};

/**
 * La barre du haut (chantier 30, famille de la structure), en trois versions.
 * Le titre en ligne tient sur une ligne et se coupe, et dès 130 % va à la
 * ligne plutôt que d'être coupé ; le grand titre va toujours à la ligne, et
 * dès 130 % ses actions passent sous lui.
 *
 * Le design écrit le sur-titre en 13/18 ; le système n'a pas ce style, il
 * prend `label-s` (13/16).
 */
export function TopBar({
  variant = 'inline',
  title,
  eyebrow,
  subtitle,
  onBack,
  backLabel = 'Retour',
  onClose,
  closeLabel = 'Fermer',
  actions = [],
  border,
  children,
}: TopBarProps) {
  const { colors, size, border: borders } = useTheme();
  const { fontScale } = useWindowDimensions();
  // Dès 130 %, les actions du grand titre passent dessous : à côté, elles lui
  // laissaient si peu de place qu'Android coupait « neuf » en deux à 200 %.
  const stacked = fontScale >= WRAP_FONT_SCALE && actions.length > 0;
  const lead = onBack ? (
    <IconButton icon="caret-left" label={backLabel} onPress={onBack} />
  ) : onClose ? (
    <IconButton icon="x" label={closeLabel} onPress={onClose} />
  ) : null;
  const trail = actions.length ? (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        minWidth: 44,
      }}
    >
      {actions.map((action) => (
        <TopBarActionView key={action.label} action={action} />
      ))}
    </View>
  ) : null;
  const frame: ViewStyle = {
    backgroundColor: colors['bg-app'],
    borderBottomWidth: border ? borders.hairline : 0,
    borderBottomColor: colors['border-subtle'],
  };

  if (variant === 'large') {
    return (
      <View style={frame}>
        {lead ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: 44,
              paddingTop: 4,
              paddingHorizontal: 8,
            }}
          >
            {lead}
          </View>
        ) : null}
        <View
          style={{
            flexDirection: stacked ? 'column' : 'row',
            alignItems: stacked ? 'flex-start' : 'flex-end',
            gap: 8,
            minHeight: size.topbar,
            paddingTop: 6,
            paddingRight: 8,
            paddingBottom: 10,
            paddingLeft: size['screen-margin'],
          }}
        >
          <View style={stacked ? { alignSelf: 'stretch', gap: 2 } : { flex: 1, gap: 2 }}>
            {eyebrow ? (
              <Text variant="label-s" color="text-secondary">
                {eyebrow}
              </Text>
            ) : null}
            <Text variant="title-1" accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? (
              <Text variant="subhead" color="text-secondary" style={{ marginTop: 2 }}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {trail}
        </View>
        {children}
      </View>
    );
  }

  if (variant === 'brand') {
    return (
      <View style={frame}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            minHeight: size.topbar,
            paddingLeft: size['screen-margin'],
            paddingRight: 8,
          }}
        >
          <Logo height={30} />
          <View style={{ flex: 1 }} />
          {trail}
        </View>
        {children}
      </View>
    );
  }

  return (
    <View style={frame}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          minHeight: size.topbar,
          paddingHorizontal: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', minWidth: 44 }}>{lead}</View>
        <Text
          variant="label-l"
          numberOfLines={fontScale >= WRAP_FONT_SCALE ? undefined : 1}
          accessibilityRole="header"
          style={{ flex: 1, textAlign: 'center' }}
        >
          {title}
        </Text>
        {trail ?? <View style={{ minWidth: 44 }} />}
      </View>
      {children}
    </View>
  );
}

function TopBarActionView({ action }: { action: TopBarAction }) {
  const { colors, radius } = useTheme();
  if ('kind' in action) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action.label}
        onPress={action.onPress}
        hitSlop={6}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          minHeight: 32,
          paddingHorizontal: 12,
          marginHorizontal: 6,
          borderRadius: radius.full,
          backgroundColor: colors['bg-sunken'],
        }}
      >
        {action.icon ? <Icon name={action.icon} size={16} /> : null}
        <Text variant="label-s">{action.label}</Text>
      </Pressable>
    );
  }
  if ('icon' in action) {
    return (
      <IconButton
        icon={action.icon}
        label={action.label}
        onPress={action.onPress}
        badge={action.badge}
        active={action.active}
      />
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      onPress={action.onPress}
      style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' }}
    >
      <Text variant="label-m" color={action.tone === 'danger' ? 'text-danger' : 'text-primary'}>
        {action.label}
      </Text>
    </Pressable>
  );
}
