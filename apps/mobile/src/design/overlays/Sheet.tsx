import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { IconButton } from '../actions/IconButton';
import { Text } from '../Text';
import { useTheme } from '../theme';
import { SheetLayer, type SheetHeight } from './Layer';

export type SheetProps = {
  visible: boolean;
  /** La croix, le voile, la poignée tirée, le retour d'Android : la feuille demande à se fermer. */
  onClose: () => void;
  title?: string;
  eyebrow?: string;
  /** Avant le sur-titre : la puce de la catégorie d'une case, `Tag`, qu'apporte le chantier 32. */
  eyebrowLeading?: ReactNode;
  subtitle?: string;
  /** `auto` par défaut, à la hauteur du contenu ; `large`, 82 % de l'écran ; `full`, jusque sous la barre d'état. */
  height?: SheetHeight;
  /** `icon` par défaut, la croix ; `text`, le libellé écrit ; `none`. */
  close?: 'icon' | 'text' | 'none';
  /** « Fermer » par défaut. */
  closeLabel?: string;
  /** Un lien texte à droite du titre, « Vider ». */
  action?: { label: string; onPress: () => void; tone?: 'danger' };
  grabber?: boolean;
  /** L'action collée en bas : un `SheetFooter`. */
  footer?: ReactNode;
  /** Le contenu ; ce qui défile y pose son propre `ScrollView` ou sa liste. */
  children?: ReactNode;
  /** Pour le catalogue : posée dans son parent, sans `Modal`, comme dans l'aperçu. */
  inline?: boolean;
};

/**
 * La feuille qui monte du bas, pour chercher une case, lire les
 * commentaires, signaler (chantier 30, famille des calques et des retours) :
 * sa poignée, un en-tête au titre en `title-2`, fermé en haut à droite, le
 * contenu à 20 des bords, et l'action collée en bas, `SheetFooter`.
 *
 * Le comportement est celui de `SheetLayer` : le voile et la barre
 * d'onglets dessous, la poignée qu'on tire, le clavier qui la soulève.
 */
export function Sheet({
  visible,
  onClose,
  title,
  eyebrow,
  eyebrowLeading,
  subtitle,
  height = 'auto',
  close = 'icon',
  closeLabel = 'Fermer',
  action,
  grabber = true,
  footer,
  children,
  inline,
}: SheetProps) {
  const head =
    title || close !== 'none' || action ? (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 8,
          paddingTop: 10,
          paddingRight: 8,
          paddingBottom: 6,
          paddingLeft: 20,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, paddingTop: 6, gap: 2 }}>
          {eyebrow ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {eyebrowLeading}
              <Text variant="label-s" color="text-secondary">
                {eyebrow}
              </Text>
            </View>
          ) : null}
          {title ? (
            <Text variant="title-2" accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text variant="subhead" color="text-secondary" style={{ marginTop: 4 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {action ? (
          <TextAction label={action.label} onPress={action.onPress} tone={action.tone} />
        ) : null}
        {close === 'icon' ? (
          <IconButton icon="x" label={closeLabel} variant="tonal" onPress={onClose} />
        ) : close === 'text' ? (
          <TextAction label={closeLabel} onPress={onClose} />
        ) : null}
      </View>
    ) : null;
  return (
    <SheetLayer
      visible={visible}
      onClose={onClose}
      closeLabel={closeLabel}
      height={height}
      grabber={grabber}
      inline={inline}
      head={head}
    >
      {/* Le contenu cède la place quand elle manque ; le pied, jamais. */}
      <View
        style={[
          {
            paddingTop: 6,
            paddingHorizontal: 20,
            paddingBottom: footer && !children ? 0 : 16,
            gap: 16,
            overflow: 'hidden',
          },
          height === 'auto' ? { flexShrink: 1 } : { flex: 1 },
        ]}
      >
        {children}
      </View>
      {footer}
    </SheetLayer>
  );
}

/** Une action écrite dans l'en-tête d'une feuille : 44 de haut, `label-m`. */
function TextAction({
  label,
  onPress,
  tone,
}: {
  label: string;
  onPress: () => void;
  tone?: 'danger';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' }}
    >
      <Text variant="label-m" color={tone === 'danger' ? 'text-danger' : 'text-primary'}>
        {label}
      </Text>
    </Pressable>
  );
}

export type SheetFooterProps = {
  /** Sans le filet du haut. */
  flat?: boolean;
  /** Le bouton, une `PromptCard`, ou le champ d'un commentaire. */
  children: ReactNode;
};

/**
 * La zone d'action collée au bas d'une feuille (chantier 30, famille des
 * calques et des retours) : bord à bord, un filet au-dessus, 12 sur 20 de
 * marge. Elle se pose dans `Sheet footer`, sous le contenu, qui lui cède la
 * place quand elle manque (texte agrandi, clavier ouvert) : elle reste
 * toujours entière, et monte avec la feuille au-dessus du clavier.
 */
export function SheetFooter({ flat, children }: SheetFooterProps) {
  const { colors, border } = useTheme();
  return (
    <View
      style={{
        flexShrink: 0,
        paddingVertical: 12,
        paddingHorizontal: 20,
        gap: 10,
        borderTopWidth: flat ? 0 : border.hairline,
        borderTopColor: colors['border-subtle'],
        backgroundColor: colors['bg-elevated'],
      }}
    >
      {children}
    </View>
  );
}
