import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { SHADOWS, YellowBg } from '@/components/primitives';

const PRIVACY_URL = 'https://bento-pop.com/confidentialite';
const TERMS_URL = 'https://bento-pop.com/mentions-legales';
const SITE_URL = 'https://bento-pop.com';

/**
 * Page Crédits / Légal accessible depuis la tab Profil.
 *
 * Couvre :
 *   - attribution Wikimedia/Wikipedia pour les illustrations du catalogue
 *     maison (CC-BY-SA notamment)
 *   - attribution legacy des APIs externes (TMDb, MusicBrainz, OSM,
 *     Wikidata) pour les items historiques créés avant la bascule
 *     catalogue maison (v1.1+) et toujours référencés dans des bentos
 *   - liens Confidentialité + Conditions d'utilisation (Apple guideline
 *     5.1.1(i) — privacy policy obligatoire pour les apps qui collectent
 *     n'importe quelle donnée user)
 *   - version + build de l'app
 *   - lien vers le site officiel
 */
export default function CreditsPage() {
  const version = Constants.expoConfig?.version ?? '?';
  const build: string | undefined = (Constants as unknown as { nativeBuildVersion?: string })
    .nativeBuildVersion;

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => {
      // silent fail — le user peut copier l'url depuis le crédit
    });
  };

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Top bar */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8 }}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))}
            accessibilityRole="button"
            accessibilityLabel="Retour"
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
            <Text style={{ fontSize: 16, fontWeight: '800' }}>‹</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 }}>
          <Text
            style={{
              fontFamily: 'Extenda',
              fontSize: 36,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            Crédits
          </Text>
          <Text style={{ marginTop: 6, fontSize: 13, color: 'rgba(10,10,10,0.65)' }}>
            Mon Bento Pop · v{version}
            {build ? ` (${build})` : ''}
          </Text>

          {/* Légal */}
          <Section title="Légal">
            <Card>
              <CardLink label="Politique de confidentialité" onPress={() => openUrl(PRIVACY_URL)} />
              <Divider />
              <CardLink label="Conditions d'utilisation" onPress={() => openUrl(TERMS_URL)} />
              <Divider />
              <CardLink label="Site officiel · bento-pop.com" onPress={() => openUrl(SITE_URL)} />
            </Card>
          </Section>

          {/* Sources de données — attributions */}
          <Section title="Sources de données">
            <Attribution
              source="Wikimedia"
              text="Les illustrations du catalogue proviennent majoritairement de Wikipedia / Wikimedia Commons (CC-BY-SA pour la plupart). Le crédit photo précis est affiché en mini sous chaque visuel."
              onPress={() => openUrl('https://commons.wikimedia.org/')}
            />
            <Attribution
              source="TMDb (legacy)"
              text="Certains items historiques provenant de The Movie Database (TMDb) restent référencés. Ce produit n'utilise plus l'API TMDb activement mais conserve les attributions par respect des CGU."
              onPress={() => openUrl('https://www.themoviedb.org/')}
            />
            <Attribution
              source="MusicBrainz (legacy)"
              text="Certains artistes / chansons historiques proviennent de MusicBrainz (CC-BY-NC-SA 4.0). Plus utilisé en lecture active depuis le passage au catalogue maison."
              onPress={() => openUrl('https://musicbrainz.org/')}
            />
            <Attribution
              source="OpenStreetMap (legacy)"
              text="Certains lieux historiques proviennent d'OpenStreetMap. © OpenStreetMap contributors. Plus utilisé en lecture active."
              onPress={() => openUrl('https://www.openstreetmap.org/copyright')}
            />
            <Attribution
              source="Wikidata (legacy)"
              text="Certains créateurs sont identifiés via Wikidata (licence CC0). Plus utilisé en lecture active."
              onPress={() => openUrl('https://www.wikidata.org/')}
            />
          </Section>

          {/* Crédits divers */}
          <Section title="Polices">
            <Card>
              <CardLink label="Fredoka" onPress={() => openUrl('https://fonts.google.com/specimen/Fredoka')} />
              <Divider />
              <CardLink label="Bungee" onPress={() => openUrl('https://fonts.google.com/specimen/Bungee')} />
              <Divider />
              <CardLink label="Extenda Yotta · design custom Bento Pop" />
            </Card>
          </Section>

          <Text
            style={{
              marginTop: 32,
              fontSize: 11,
              color: 'rgba(10,10,10,0.55)',
              textAlign: 'center',
              lineHeight: 17,
            }}
          >
            Mon Bento Pop est une app companion de Bento Pop. Production : Liventure SAS.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </YellowBg>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 28 }}>
      <Text
        style={{
          fontFamily: 'Bungee',
          fontSize: 10,
          letterSpacing: 2,
          color: 'rgba(10,10,10,0.55)',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: '#ffffff',
        borderWidth: 2,
        borderColor: '#0a0a0a',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

function CardLink({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'link' : 'text'}
      accessibilityLabel={label}
      style={{
        paddingVertical: 13,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '600', flex: 1 }}>{label}</Text>
      {onPress ? <Text style={{ fontSize: 18, color: 'rgba(10,10,10,0.4)' }}>↗</Text> : null}
    </Pressable>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: 'rgba(10,10,10,0.08)', marginHorizontal: 16 }} />;
}

function Attribution({
  source,
  text,
  onPress,
}: {
  source: string;
  text: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${source} : ${text}`}
      accessibilityHint="Ouvre le site source dans le navigateur"
      style={{
        backgroundColor: '#ffffff',
        borderWidth: 2,
        borderColor: '#0a0a0a',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text
          style={{
            fontFamily: 'Bungee',
            fontSize: 11,
            letterSpacing: 1.5,
            color: '#e63946',
            textTransform: 'uppercase',
          }}
        >
          {source}
        </Text>
        <Text style={{ marginLeft: 'auto', fontSize: 14, color: 'rgba(10,10,10,0.4)' }}>↗</Text>
      </View>
      <Text style={{ marginTop: 6, fontSize: 12, color: 'rgba(10,10,10,0.75)', lineHeight: 17 }}>
        {text}
      </Text>
    </Pressable>
  );
}
