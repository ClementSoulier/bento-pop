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
  /** Une fois la feuille sortie de l'écran, sa sortie jouée. */
  onHidden?: () => void;
  title?: string;
  /** Ce que lit le lecteur d'écran à la place du titre : « Case Artiste ». */
  titleAccessibilityLabel?: string;
  eyebrow?: string;
  /** Avant le sur-titre : la puce de la catégorie d'une case, `Tag`, qu'apporte le chantier 32. */
  eyebrowLeading?: ReactNode;
  /**
   * Ce que lit le lecteur d'écran du sur-titre et de sa puce, lus ensemble ; le
   * sur-titre par défaut ; `null` les tait, quand le titre dit déjà tout.
   */
  eyebrowAccessibilityLabel?: string | null;
  subtitle?: string;
  /** `auto` par défaut, à la hauteur du contenu ; `large`, 82 % de l'écran ; `full`, jusque sous la barre d'état. */
  height?: SheetHeight;
  /** `icon` par défaut, la croix ; `text`, le libellé écrit ; `none`. */
  close?: 'icon' | 'text' | 'none';
  /** « Fermer » par défaut. */
  closeLabel?: string;
  /** Un lien texte à droite du titre, « Vider ». */
  action?: {
    label: string;
    onPress: () => void;
    tone?: 'danger';
    /** Ce que lit le lecteur d'écran, « Vider cette case ». */
    accessibilityLabel?: string;
    disabled?: boolean;
  };
  grabber?: boolean;
  /** L'action collée en bas : un `SheetFooter`. */
  footer?: ReactNode;
  /** Le contenu ; ce qui défile y pose son propre `ScrollView` ou sa liste. */
  children?: ReactNode;
  /** Pour le catalogue : posée dans son parent, sans `Modal`, comme dans l'aperçu. */
  inline?: boolean;
  /** Seule dans sa route, en `transparentModal` : la recherche d'une case (D9 du 32). */
  inScreen?: boolean;
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
  onHidden,
  title,
  titleAccessibilityLabel,
  eyebrow,
  eyebrowLeading,
  eyebrowAccessibilityLabel,
  subtitle,
  height = 'auto',
  close = 'icon',
  closeLabel = 'Fermer',
  action,
  grabber = true,
  footer,
  children,
  inline,
  inScreen,
}: SheetProps) {
  const silentEyebrow = eyebrowAccessibilityLabel === null;
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
            <View
              accessible={!silentEyebrow}
              // Du texte, pas un bouton : l'en-tête, qu'on tire, prend le toucher, et
              // VoiceOver en déduisait un bouton.
              accessibilityRole={silentEyebrow ? undefined : 'text'}
              accessibilityLabel={
                silentEyebrow ? undefined : (eyebrowAccessibilityLabel ?? eyebrow)
              }
              accessibilityElementsHidden={silentEyebrow}
              importantForAccessibility={silentEyebrow ? 'no-hide-descendants' : 'auto'}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              {eyebrowLeading}
              <Text variant="label-s" color="text-secondary">
                {eyebrow}
              </Text>
            </View>
          ) : null}
          {title ? (
            <Text
              variant="title-2"
              accessibilityRole="header"
              accessibilityLabel={titleAccessibilityLabel}
            >
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
          <TextAction
            label={action.label}
            onPress={action.onPress}
            tone={action.tone}
            accessibilityLabel={action.accessibilityLabel}
            disabled={action.disabled}
          />
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
      onHidden={onHidden}
      closeLabel={closeLabel}
      height={height}
      grabber={grabber}
      inline={inline}
      inScreen={inScreen}
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
  accessibilityLabel,
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: 'danger';
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={disabled ? { disabled } : undefined}
      disabled={disabled}
      onPress={onPress}
      style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' }}
    >
      <Text
        variant="label-m"
        color={disabled ? 'text-tertiary' : tone === 'danger' ? 'text-danger' : 'text-primary'}
      >
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
