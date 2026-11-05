import { StatusBar } from 'expo-status-bar';
import { ScrollView, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Display, Popy, Screen, Text, ThemeProvider, type Mood } from '@/design';
import { openStore } from '@/lib/open-store';

/**
 * Écrans bloquants au boot de l'app : maintenance (volontaire, switch BO) et
 * force update (version trop ancienne par rapport à `ios_min_version`), soit
 * `m03-maintenance` et `m02-maj-obligatoire` (chantier 31).
 *
 * Ils n'apparaissent qu'avant le Stack expo-router → l'utilisateur ne peut
 * RIEN faire dans l'app tant qu'ils sont affichés. Pas de bouton "Continuer
 * quand même" : c'est le point. Rendus hors de l'arbre de l'app, ils portent
 * eux-mêmes le thème et la zone sûre dont le design a besoin (D10).
 */

type MaintenanceScreenProps = {
  title: string;
  message: string;
};

/** La maintenance garde les textes du back-office, ceux de la maquette par défaut. */
export function MaintenanceScreen({ title, message }: MaintenanceScreenProps) {
  return <BlockerLayout mood="malade" title={title} message={message} />;
}

export function ForceUpdateScreen() {
  return (
    <BlockerLayout
      mood="surpris"
      title={'Mise à jour requise'}
      message="Une nouvelle version de Mon Bento Pop est disponible. Mets l’app à jour pour continuer."
      cta={{ label: 'Mettre à jour', onPress: openStore }}
    />
  );
}

type BlockerLayoutProps = {
  mood: Mood;
  title: string;
  message: string;
  cta?: { label: string; onPress: () => void };
};

function BlockerLayout(props: BlockerLayoutProps) {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Blocker {...props} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** La hauteur du bouton : sans lui, la maintenance garde le même centre que la mise à jour. */
const CTA_HEIGHT = 52;
/** Les 30 caractères de la maquette, en points : `max-width: 30ch` à 17 points. */
const MESSAGE_MAX_WIDTH = 322;

function Blocker({ mood, title, message, cta }: BlockerLayoutProps) {
  const insets = useSafeAreaInsets();
  return (
    <Screen tone="brand">
      <StatusBar style="dark" />
      {/* Défile quand la police système ou un long message du back-office ne
          laisse plus tout tenir : le bouton de mise à jour est la seule issue
          de cet écran, il reste en bas. */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 28,
          paddingVertical: 16,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
      >
        <Popy mood={mood} size={184} wiggle />
        <View style={{ alignSelf: 'stretch' }}>
          <Display text={title} size="l" align="center" />
        </View>
        <Text variant="body-l" style={{ maxWidth: MESSAGE_MAX_WIDTH, textAlign: 'center' }}>
          {message}
        </Text>
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 12 }}>
        {cta ? (
          <Button variant="on-brand" block label={cta.label} onPress={cta.onPress} />
        ) : (
          <View style={{ height: CTA_HEIGHT }} />
        )}
      </View>
    </Screen>
  );
}
