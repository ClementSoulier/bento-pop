import { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSession } from '@/state/session';
import { useBento } from '@/state/bento';
import { deleteOwnAccount, editableBentoId, unpublishBento } from '@/lib/bento-actions';
import { bentoName } from '@/lib/own-bento';
import { exportUserData } from '@/lib/data-export';
import { extendaAccentRoom } from '@/lib/display-title';
import {
  CONTENT_MAX_FONT_MULTIPLIER,
  CONTROL_MAX_FONT_MULTIPLIER,
  TITLE_MAX_FONT_MULTIPLIER,
  fontScaleFor,
  scaledType,
} from '@/components/bento/font-scaling';
import { INK_MUTED, INK_PLACEHOLDER, SHADOWS, YellowBg, useToast } from '@/components/primitives';
import { useBlocked } from '@/state/blocked';
import { userErrorMessage } from '@/lib/user-error-message';
import { NotificationSettings } from '@/components/NotificationSettings';
import { PrivacySettings } from '@/components/PrivacySettings';
import { forgetReadyReminders } from '@/lib/push-runtime';

const PRIVACY_URL = 'https://bento-pop.com/confidentialite';
const TERMS_URL = 'https://bento-pop.com/mentions-legales';

const TITLE = 'Réglages';
const TITLE_SIZE = 30;

/**
 * Les réglages du compte, chantier 21 (D3) : ce que l'onglet Profil portait
 * sous l'identité, repris tel quel, depuis que l'onglet est la page du compte.
 * C'est l'écran à part que D9 du chantier 20 attendait.
 *
 * À propos, Notifications, Confidentialité, Comptes bloqués et Compte, dans
 * cet ordre, celui d'avant. Ouvert par « Réglages », dans la barre du haut de
 * l'onglet.
 *
 * Les textes appliquent eux-mêmes la taille système, plafonnée, cf.
 * `fontScaleFor`, ceux des sections comprises. Laissée à
 * `maxFontSizeMultiplier`, une taille réduite écran ouvert laissait les
 * lignes à leur ancienne hauteur, et le sous-titre d'un réglage rogné, sur
 * iOS : le défaut de l'écran des mêmes goûts au chantier 20 (recette du
 * lot 3 du chantier 21).
 */
export default function SettingsScreen() {
  const userId = useSession((s) => s.user?.id);
  const resetAndReinit = useSession((s) => s.resetAndReinit);
  const publishedAt = useBento((s) => s.publishedAt);
  // Chantier 16 : le bento courant et la liste, pour nommer ce sur quoi les
  // actions de cet écran agissent.
  const own = useBento((s) => s.own);
  const current = useBento((s) => s.current);
  const setPublishedAt = useBento((s) => s.setPublishedAt);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const { fontScale } = useWindowDimensions();
  const blockedEntries = useBlocked((s) => s.entries);
  const unblock = useBlocked((s) => s.unblock);
  const showToast = useToast((s) => s.show);
  // Triés : l'ordre de la liste est celui des blocages, que personne ne connaît.
  const blocked = useMemo(
    () => [...blockedEntries].sort((a, b) => a.pseudo.localeCompare(b.pseudo)),
    [blockedEntries],
  );

  const titleSize = TITLE_SIZE * fontScaleFor(fontScale, TITLE_MAX_FONT_MULTIPLIER);
  // Le « É » d'Extenda monte au-dessus de son ascendante : sans cette réserve,
  // iOS le rogne. Cf. `extendaAccentRoom`.
  const accentRoom = extendaAccentRoom(
    TITLE,
    titleSize,
    Platform.OS === 'android' ? PixelRatio.get() : undefined,
  );

  const onExport = async () => {
    if (!userId) return;
    setExporting(true);
    try {
      await exportUserData(userId);
    } catch (e) {
      console.warn('[réglages] export', e);
      Alert.alert('Export impossible', userErrorMessage('export', e));
    } finally {
      setExporting(false);
    }
  };

  /**
   * Retrait du fil. Avant ce bouton, la seule façon de ne plus être visible
   * était de supprimer son compte, ce qui est sans commune mesure.
   *
   * Confirmation volontairement calme : le geste est réversible d'un tap, et
   * un `style: 'destructive'` le mettrait au même niveau que la suppression
   * de compte, qui est juste en dessous et qui, elle, ne se rattrape pas.
   */
  const confirmUnpublish = () => {
    // Nommer le bento retiré dès qu'un compte en a plusieurs : « mon bento »
    // ne désigne plus rien de précis, et c'est une action qu'on ne veut pas
    // faire sur le mauvais. Chantier 16.
    const nom = own.length > 1 && current && !current.isPrimary ? ` « ${bentoName(current)} »` : '';
    Alert.alert(
      `Retirer mon bento${nom} du fil ?`,
      'Il disparaît de « La table » et de sa page publique. Tes cases restent en place, tu peux le republier quand tu veux.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          onPress: async () => {
            if (!userId) return;
            setUnpublishing(true);
            try {
              const bentoId = await editableBentoId(userId);
              // Cet écran n'est atteignable qu'avec un bento en ligne, donc
              // avec un profil : `null` ne peut pas arriver, et s'il arrivait,
              // ne rien faire vaut mieux que lever.
              if (!bentoId) return;
              await unpublishBento(bentoId);
              setPublishedAt(null);
            } catch (e) {
              console.warn('[réglages] retrait du fil', e);
              Alert.alert('Oups', userErrorMessage('unpublish', e));
            } finally {
              setUnpublishing(false);
            }
          },
        },
      ],
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      'Supprimer mon compte ?',
      'Toutes tes données seront effacées définitivement : pseudo, bento, items sélectionnés. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            if (!userId) return;
            setDeleting(true);
            try {
              await deleteOwnAccount(userId);
              // Chantier 8 : ses rappels de bento prêt partent avec lui.
              await forgetReadyReminders();
              await resetAndReinit();
              // Le `Redirect` dans app/index.tsx renverra vers l'onboarding
              router.replace('/');
            } catch (e) {
              console.warn('[réglages] suppression de compte', e);
              Alert.alert('Oups', userErrorMessage('delete-account', e));
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ height: 44, paddingTop: 8, paddingHorizontal: 16, flexDirection: 'row' }}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))}
            accessibilityRole="button"
            accessibilityLabel="Retour"
            // La pastille fait 36 pt : la cible tactile en fait 44.
            hitSlop={4}
            style={[
              {
                backgroundColor: '#ffffff',
                borderWidth: 2.5,
                borderColor: '#0a0a0a',
                borderRadius: 999,
                width: 36,
                height: 36,
                alignItems: 'center',
                justifyContent: 'center',
              },
              SHADOWS.stamp,
            ]}
          >
            {/* Un glyphe dans une cible de 36 pt, pas un texte à lire. */}
            <Text allowFontScaling={false} style={{ fontSize: 16, fontWeight: '800' }}>
              ‹
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          <Text
            accessibilityRole="header"
            allowFontScaling={false}
            style={{
              // La réserve des accents prise sur la marge : le titre ne bouge pas.
              marginTop: 18 - accentRoom,
              paddingTop: accentRoom,
              fontFamily: 'Extenda',
              fontSize: titleSize,
              lineHeight: titleSize * 1.05,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            {TITLE}
          </Text>

          {/* Section À propos / Légal */}
          <View style={{ marginTop: 24, gap: 8 }}>
            <SectionTitle>À propos</SectionTitle>
            <SettingsLink label="Crédits & attributions" onPress={() => router.push('/credits')} />
            <SettingsLink
              label="Politique de confidentialité"
              role="link"
              onPress={() => Linking.openURL(PRIVACY_URL)}
            />
            <SettingsLink
              label="Conditions d'utilisation"
              role="link"
              onPress={() => Linking.openURL(TERMS_URL)}
            />
            <SettingsLink
              label={exporting ? 'Export en cours…' : 'Exporter mes données'}
              onPress={exporting ? () => {} : onExport}
            />
          </View>

          {/* Chantier 17, lot 4 : les deux types de notification, sur ce
              téléphone. Entre « À propos » et « Compte ». */}
          <NotificationSettings />

          {/* Chantiers 8 et 20 : « Afficher mes visites » et « Apparaître dans
              la recherche », entre « Notifications » et « Compte ». */}
          <PrivacySettings />

          {/* Comptes bloqués. Sans cette liste, bloquer était une porte à sens
              unique : le menu qui débloque vit sur la page du compte bloqué,
              que le fil et la recherche ne montrent plus. */}
          {blocked.length > 0 ? (
            <View style={{ marginTop: 24, gap: 8 }}>
              <SectionTitle>Comptes bloqués</SectionTitle>
              {blocked.map((entry) => (
                <BlockedRow
                  key={entry.userId ?? entry.pseudo}
                  pseudo={entry.pseudo}
                  onUnblock={() => {
                    void unblock(entry);
                    showToast(`@${entry.pseudo} débloqué`, { variant: 'neutral' });
                  }}
                />
              ))}
              <Text
                allowFontScaling={false}
                style={{
                  ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 11, 16),
                  color: INK_MUTED,
                }}
              >
                Leurs bentos ne s&apos;affichent ni dans « La table » ni dans la recherche.
              </Text>
            </View>
          ) : null}

          {/* Section Compte */}
          <View style={{ marginTop: 24, gap: 8 }}>
            <SectionTitle>Compte</SectionTitle>

            {/* Neutre, et non encadré de rouge : retirer son bento se
                rattrape d'un tap, supprimer son compte non. Les habiller
                pareil serait fabriquer l'erreur. */}
            {publishedAt ? (
              <View style={{ marginBottom: 8 }}>
                <SettingsLink
                  label={unpublishing ? 'Retrait en cours…' : 'Retirer mon bento du fil'}
                  onPress={unpublishing ? () => {} : confirmUnpublish}
                />
              </View>
            ) : null}

            <Pressable
              onPress={confirmDelete}
              disabled={deleting}
              accessibilityRole="button"
              accessibilityLabel={deleting ? 'Suppression en cours' : 'Supprimer mon compte'}
              accessibilityHint="Cette action est irréversible"
              accessibilityState={{ disabled: deleting, busy: deleting }}
              style={{
                paddingVertical: 14,
                paddingHorizontal: 18,
                borderRadius: 14,
                borderWidth: 2,
                borderColor: '#e63946',
                backgroundColor: 'rgba(230,57,70,0.06)',
                alignItems: 'center',
              }}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                allowFontScaling={false}
                style={{
                  fontFamily: 'Bungee',
                  fontSize: 12 * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER),
                  letterSpacing: 1,
                  // À l'encre : en rouge sur son propre voile, 2,36 : 1. Le
                  // cadre et le fond rouges disent déjà que l'action est grave.
                  color: '#0a0a0a',
                  textTransform: 'uppercase',
                }}
              >
                {deleting ? 'Suppression…' : 'Supprimer mon compte'}
              </Text>
            </Pressable>
            <Text
              allowFontScaling={false}
              style={{
                ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 11, 16),
                color: INK_MUTED,
                textAlign: 'center',
                marginTop: 4,
              }}
            >
              Efface définitivement ton pseudo, ton bento et tes choix. Cette action est irréversible.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </YellowBg>
  );
}

/** Le titre d'une section, en petites capitales. */
function SectionTitle({ children }: { children: string }) {
  const { fontScale } = useWindowDimensions();
  return (
    <Text
      accessibilityRole="header"
      numberOfLines={1}
      allowFontScaling={false}
      style={{
        fontFamily: 'Bungee',
        fontSize: 10 * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER),
        letterSpacing: 2,
        color: INK_MUTED,
        textTransform: 'uppercase',
        marginBottom: 4,
      }}
    >
      {children}
    </Text>
  );
}

/** Une ligne de la liste des comptes bloqués : le pseudo, et de quoi le débloquer. */
function BlockedRow({ pseudo, onUnblock }: { pseudo: string; onUnblock: () => void }) {
  const { fontScale } = useWindowDimensions();
  return (
    <View
      style={{
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        borderWidth: 2,
        borderColor: '#0a0a0a',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <Text
        numberOfLines={1}
        allowFontScaling={false}
        style={{
          fontSize: 14 * fontScaleFor(fontScale, CONTENT_MAX_FONT_MULTIPLIER),
          fontWeight: '600',
          flexShrink: 1,
        }}
      >
        @{pseudo}
      </Text>
      <Pressable
        onPress={onUnblock}
        accessibilityRole="button"
        accessibilityLabel={`Débloquer @${pseudo}`}
        // Le libellé fait 24 pt de haut : la cible tactile en fait 44.
        hitSlop={{ top: 10, bottom: 10 }}
        style={{
          backgroundColor: '#0a0a0a',
          borderRadius: 999,
          paddingHorizontal: 14,
          paddingVertical: 6,
        }}
      >
        <Text
          numberOfLines={1}
          allowFontScaling={false}
          style={{
            fontFamily: 'Bungee',
            fontSize: 10 * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER),
            letterSpacing: 1,
            color: '#fbbf24',
            textTransform: 'uppercase',
          }}
        >
          Débloquer
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Ligne de la liste des réglages. Bouton par défaut, lien seulement quand elle
 * ouvre une adresse hors de l'app : « Crédits », « Exporter mes données » et
 * « Retirer mon bento du fil » s'annonçaient comme des liens alors qu'elles
 * agissent dans l'app.
 */
function SettingsLink({
  label,
  role = 'button',
  onPress,
}: {
  label: string;
  role?: 'button' | 'link';
  onPress: () => void;
}) {
  const { fontScale } = useWindowDimensions();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={label}
      style={{
        paddingVertical: 13,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        borderWidth: 2,
        borderColor: '#0a0a0a',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Text
        allowFontScaling={false}
        style={{
          fontSize: 14 * fontScaleFor(fontScale, CONTENT_MAX_FONT_MULTIPLIER),
          fontWeight: '600',
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
      {/* Un chevron, pas un texte à lire. */}
      <Text allowFontScaling={false} style={{ fontSize: 18, color: INK_PLACEHOLDER }}>
        ›
      </Text>
    </Pressable>
  );
}
