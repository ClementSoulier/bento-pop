import { Image, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import popyContent from '@bento-pop/brand/assets/mascot/popy-content.png';
import popyMalade from '@bento-pop/brand/assets/mascot/popy-malade.png';
import { StampButton, YellowBg } from '@/components/primitives';

/**
 * Écrans bloquants au boot de l'app : maintenance (volontaire, switch BO)
 * et force update (version trop ancienne par rapport à `ios_min_version`).
 *
 * Ils n'apparaissent qu'avant le Stack expo-router → l'utilisateur ne peut
 * RIEN faire dans l'app tant qu'ils sont affichés. Pas de bouton "Continuer
 * quand même" : c'est le point.
 */

const IOS_APP_ID = '6768764158';
const ANDROID_PACKAGE = 'com.bentopop.mobile';

function openStore() {
  if (Platform.OS === 'ios') {
    // Schéma natif iOS : ouvre directement l'App Store app sur la fiche.
    // Fallback HTTPS si pour une raison X le schéma n'est pas géré.
    const deepLink = `itms-apps://apps.apple.com/app/id${IOS_APP_ID}`;
    const webLink = `https://apps.apple.com/app/id${IOS_APP_ID}`;
    Linking.openURL(deepLink).catch(() => Linking.openURL(webLink));
    return;
  }
  const deepLink = `market://details?id=${ANDROID_PACKAGE}`;
  const webLink = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
  Linking.openURL(deepLink).catch(() => Linking.openURL(webLink));
}

type MaintenanceScreenProps = {
  title: string;
  message: string;
};

export function MaintenanceScreen({ title, message }: MaintenanceScreenProps) {
  return (
    <BlockerLayout
      mascot={popyMalade}
      title={title}
      message={message}
    />
  );
}

export function ForceUpdateScreen() {
  return (
    <BlockerLayout
      mascot={popyContent}
      title="Mise à jour requise"
      message="Une nouvelle version de Mon Bento Pop est disponible. Mets l'app à jour pour continuer."
      cta={{ label: 'Mettre à jour', onPress: openStore }}
    />
  );
}

type BlockerLayoutProps = {
  mascot: number;
  title: string;
  message: string;
  cta?: { label: string; onPress: () => void };
};

function BlockerLayout({ mascot, title, message, cta }: BlockerLayoutProps) {
  return (
    <YellowBg>
      <View style={styles.container}>
        <Image source={mascot} style={styles.mascot} resizeMode="contain" />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        {cta ? (
          <View style={styles.ctaWrap}>
            <StampButton onPress={cta.onPress} wide>
              {cta.label}
            </StampButton>
          </View>
        ) : null}
      </View>
    </YellowBg>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 20,
  },
  mascot: {
    width: 180,
    height: 180,
  },
  title: {
    fontFamily: 'Bungee',
    fontSize: 28,
    color: '#0a0a0a',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  message: {
    fontFamily: 'Fredoka',
    fontSize: 17,
    color: '#0a0a0a',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 360,
  },
  ctaWrap: {
    marginTop: 12,
    alignSelf: 'stretch',
    paddingHorizontal: 16,
  },
});
