import { View, useWindowDimensions } from 'react-native';
import { Button } from '../actions/Button';
import { IconButton } from '../actions/IconButton';
import { Popy } from '../brand/Popy';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { useTheme } from '../theme';
import { reachesWrapScale } from '../type';

export type BannerProps = {
  /** `offline` par défaut, la bande d'encre ; `update` avec Popy, et `info`, la carte jaune pâle. */
  tone?: 'offline' | 'update' | 'info';
  /** « Pas de connexion » par défaut hors connexion. */
  title?: string;
  message?: string;
  action?: string;
  onAction?: () => void;
  /** Une croix pour la fermer. */
  onClose?: () => void;
};

/**
 * La bannière posée dans le flux de l'écran, qu'elle pousse au lieu de le
 * recouvrir : hors connexion, nouvelle version (chantier 30, famille des
 * calques et des retours).
 *
 * Hors connexion, une bande d'encre bord à bord, l'icône et le texte
 * centrés ; sinon une carte jaune pâle à 16 des bords, Popy « nani » pour
 * une nouvelle version, l'action en petit bouton principal et la croix.
 * Dès 130 %, l'action passe sous le texte (D18). Elle ne se dit pas
 * elle-même : l'écran annonce la perte de connexion, comme aujourd'hui
 * (`connectionAnnouncement`).
 */
export function Banner({
  tone = 'offline',
  title,
  message,
  action,
  onAction,
  onClose,
}: BannerProps) {
  const { colors, palette, border, radius, size } = useTheme();
  const { fontScale } = useWindowDimensions();
  if (tone === 'offline') {
    const text = title ?? 'Pas de connexion';
    return (
      <View
        accessible
        accessibilityLabel={text}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          minHeight: 36,
          paddingVertical: 6,
          paddingHorizontal: 16,
          backgroundColor: colors['toast-bg'],
        }}
      >
        <Icon name="wifi-slash" size={18} tint={palette['yolk-300']} />
        <Text variant="subhead" weight={500} style={{ color: palette['rice-100'], flexShrink: 1 }}>
          {text}
        </Text>
      </View>
    );
  }
  const stacked = reachesWrapScale(fontScale);
  const button = action ? (
    <Button variant="primary" size="sm" label={action} onPress={onAction} />
  ) : null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 4,
        marginHorizontal: size['screen-margin'],
        marginBottom: 8,
        paddingTop: 10,
        paddingRight: 6,
        paddingBottom: 10,
        paddingLeft: 12,
        borderRadius: radius.lg,
        borderWidth: border.hairline,
        borderColor: colors['border-subtle'],
        backgroundColor: colors['accent-soft'],
      }}
    >
      {tone === 'update' ? <Popy mood="nani" size={40} /> : null}
      <View style={{ flex: 1, minWidth: 0, gap: stacked ? 8 : 0, alignItems: 'flex-start' }}>
        <View accessible style={{ alignSelf: 'stretch' }}>
          {title ? (
            <Text variant="label-m" color="on-accent-soft">
              {title}
            </Text>
          ) : null}
          {message ? (
            <Text variant="footnote" color="on-accent-soft" style={{ opacity: 0.85 }}>
              {message}
            </Text>
          ) : null}
        </View>
        {stacked ? button : null}
      </View>
      {stacked ? null : button}
      {onClose ? <IconButton icon="x" label="Fermer" size="sm" onPress={onClose} /> : null}
    </View>
  );
}
