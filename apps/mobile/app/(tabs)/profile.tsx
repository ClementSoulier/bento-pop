import { useMemo, useState } from 'react';
import { bentoRoute } from '@/lib/bento-address';
import {
  Alert,
  Image,
  Linking,
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
import { popyForPseudo } from '@/lib/popy-avatar';
import { deleteOwnAccount, editableBentoId, unpublishBento } from '@/lib/bento-actions';
import { bentoName } from '@/lib/own-bento';
import { relativeDate } from '@/lib/relative-date';
import { exportUserData } from '@/lib/data-export';
import {
  CONTENT_MAX_FONT_MULTIPLIER,
  CONTROL_MAX_FONT_MULTIPLIER,
  TITLE_MAX_FONT_MULTIPLIER,
  scaledType,
} from '@/components/bento/font-scaling';
import { INK_MUTED, INK_PLACEHOLDER, SHADOWS, StampButton, YellowBg, useToast } from '@/components/primitives';
import { useBlocked } from '@/state/blocked';
import { userErrorMessage } from '@/lib/user-error-message';

const PRIVACY_URL = 'https://bento-pop.com/confidentialite';
const TERMS_URL = 'https://bento-pop.com/mentions-legales';

export default function ProfileTab() {
  const profile = useSession((s) => s.profile);
  const userId = useSession((s) => s.user?.id);
  const resetAndReinit = useSession((s) => s.resetAndReinit);
  const pseudo = profile?.pseudo ?? '';
  const popy = popyForPseudo(pseudo);
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
  const blockedPseudos = useBlocked((s) => s.pseudos);
  const unblock = useBlocked((s) => s.unblock);
  const showToast = useToast((s) => s.show);
  // Triés : l'ordre d'un `Set` est celui des blocages, que personne ne connaît.
  const blocked = useMemo(() => [...blockedPseudos].sort(), [blockedPseudos]);

  const onExport = async () => {
    if (!userId) return;
    setExporting(true);
    try {
      await exportUserData(userId);
    } catch (e) {
      console.warn('[profil] export', e);
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
              console.warn('[profil] retrait du fil', e);
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
              await resetAndReinit();
              // Le `Redirect` dans app/index.tsx renverra vers l'onboarding
              router.replace('/');
            } catch (e) {
              console.warn('[profil] suppression de compte', e);
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
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          <View style={{ alignItems: 'center', paddingTop: 32 }}>
            {/* Avatar Popy */}
            <View
              style={[
                {
                  width: 130,
                  height: 130,
                  borderRadius: 65,
                  backgroundColor: '#ffffff',
                  borderWidth: 4,
                  borderColor: '#0a0a0a',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                },
                SHADOWS.stampLg,
              ]}
            >
              <Image source={popy.source} style={{ width: 110, height: 110 }} resizeMode="contain" />
            </View>

            {/* Une ligne, qui rétrécit : sur toute la largeur, en Extenda 36, le
                pseudo se coupait au milieu dès qu'il dépassait la ligne, et dès la
                taille par défaut, « @BENTO_CULTUR / E ». 8 des 59 pseudos de la
                production débordent sur un 17 Pro, 16 à 360 dp. */}
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              adjustsFontSizeToFit
              maxFontSizeMultiplier={TITLE_MAX_FONT_MULTIPLIER}
              style={{
                fontFamily: 'Extenda',
                fontSize: 36,
                letterSpacing: 1,
                marginTop: 20,
                textTransform: 'uppercase',
              }}
            >
              @{pseudo || '…'}
            </Text>
            {profile?.display_name ? (
              <Text
                maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
                style={{ fontSize: 14, color: 'rgba(10,10,10,0.65)', marginTop: 4 }}
              >
                {profile.display_name}
              </Text>
            ) : null}

            {/* La date existait en base depuis toujours et personne ne la
                voyait. C'est elle qui donne la certitude que le bento est
                bien parti, et sa disparition confirme le retrait. */}
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
              style={{
                fontFamily: 'Bungee',
                fontSize: 9,
                letterSpacing: 1,
                marginTop: 10,
                color: INK_MUTED,
                textTransform: 'uppercase',
              }}
            >
              {publishedAt ? `En ligne · publié ${relativeDate(publishedAt)}` : 'Pas encore publié'}
            </Text>

            <View style={{ marginTop: 32, width: '100%', gap: 12 }}>
              {/* Uniquement quand le bento est en ligne. Depuis qu'on peut le
                  retirer du fil, laisser ce bouton mènerait à « Bento
                  introuvable » : un cul-de-sac que l'app propose elle-même,
                  juste après un geste volontaire de l'utilisateur. */}
              {publishedAt ? (
              <Pressable
                // L'adresse du bento courant, et non celle du compte : le
                // principal la garde, un secondaire a la sienne. Chantier 16.
                onPress={() => router.push(bentoRoute(pseudo, current?.slug, current?.isPrimary))}
                accessibilityRole="button"
                accessibilityLabel="Voir mon bento public"
                style={[
                  {
                    backgroundColor: '#ffffff',
                    borderWidth: 3,
                    borderColor: '#0a0a0a',
                    borderRadius: 999,
                    paddingVertical: 14,
                    alignItems: 'center',
                  },
                  SHADOWS.stamp,
                ]}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
                  style={{
                    fontFamily: 'Bungee',
                    fontSize: 14,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                  }}
                >
                  Voir mon bento public
                </Text>
              </Pressable>
              ) : null}
              <StampButton
                wide
                variant={publishedAt ? 'cream' : 'primary'}
                onPress={() => router.push('/(tabs)/compose')}
              >
                {publishedAt ? 'Éditer mon bento' : 'Reprendre mon bento'}
              </StampButton>
            </View>
          </View>

          {/* Section À propos / Légal */}
          <View style={{ marginTop: 36, gap: 8 }}>
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
              style={{
                fontFamily: 'Bungee',
                fontSize: 10,
                letterSpacing: 2,
                color: INK_MUTED,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              À propos
            </Text>
            <ProfileLink label="Crédits & attributions" onPress={() => router.push('/credits')} />
            <ProfileLink
              label="Politique de confidentialité"
              role="link"
              onPress={() => Linking.openURL(PRIVACY_URL)}
            />
            <ProfileLink
              label="Conditions d'utilisation"
              role="link"
              onPress={() => Linking.openURL(TERMS_URL)}
            />
            <ProfileLink
              label={exporting ? 'Export en cours…' : 'Exporter mes données'}
              onPress={exporting ? () => {} : onExport}
            />
          </View>

          {/* Comptes bloqués. Sans cette liste, bloquer était une porte à sens
              unique : le menu qui débloque vit sur la page du compte bloqué,
              que le fil et la recherche ne montrent plus. */}
          {blocked.length > 0 ? (
            <View style={{ marginTop: 24, gap: 8 }}>
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
                style={{
                  fontFamily: 'Bungee',
                  fontSize: 10,
                  letterSpacing: 2,
                  color: INK_MUTED,
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                Comptes bloqués
              </Text>
              {blocked.map((blockedPseudo) => (
                <BlockedRow
                  key={blockedPseudo}
                  pseudo={blockedPseudo}
                  onUnblock={() => {
                    void unblock(blockedPseudo);
                    showToast(`@${blockedPseudo} débloqué`, { variant: 'neutral' });
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
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
              style={{
                fontFamily: 'Bungee',
                fontSize: 10,
                letterSpacing: 2,
                color: INK_MUTED,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              Compte
            </Text>

            {/* Neutre, et non encadré de rouge : retirer son bento se
                rattrape d'un tap, supprimer son compte non. Les habiller
                pareil serait fabriquer l'erreur. */}
            {publishedAt ? (
              <View style={{ marginBottom: 8 }}>
                <ProfileLink
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
                maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
                style={{
                  fontFamily: 'Bungee',
                  fontSize: 12,
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

/**
 * Ligne de la liste du profil. Bouton par défaut, lien seulement quand elle
 * ouvre une adresse hors de l'app : « Crédits », « Exporter mes données » et
 * « Retirer mon bento du fil » s'annonçaient comme des liens alors qu'elles
 * agissent dans l'app.
 */
/** Une ligne de la liste des comptes bloqués : le pseudo, et de quoi le débloquer. */
function BlockedRow({ pseudo, onUnblock }: { pseudo: string; onUnblock: () => void }) {
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
        maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
        style={{ fontSize: 14, fontWeight: '600', flexShrink: 1 }}
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
          maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
          style={{
            fontFamily: 'Bungee',
            fontSize: 10,
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

function ProfileLink({
  label,
  role = 'button',
  onPress,
}: {
  label: string;
  role?: 'button' | 'link';
  onPress: () => void;
}) {
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
        maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
        style={{ fontSize: 14, fontWeight: '600', flexShrink: 1 }}
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
