import {
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
import Constants from 'expo-constants';
import { router } from 'expo-router';
import {
  CONTENT_MAX_FONT_MULTIPLIER,
  CONTROL_MAX_FONT_MULTIPLIER,
  TITLE_MAX_FONT_MULTIPLIER,
  scaledType,
} from '@/components/bento/font-scaling';
import { INK_MUTED, INK_PLACEHOLDER, SHADOWS, YellowBg } from '@/components/primitives';
import { extendaAccentRoom } from '@/lib/display-title';

const PRIVACY_URL = 'https://bento-pop.com/confidentialite';
const TERMS_URL = 'https://bento-pop.com/mentions-legales';
const SITE_URL = 'https://bento-pop.com';

const TITLE = 'Crédits';
const TITLE_FONT_SIZE = 36;

/**
 * Page Crédits / Légal accessible depuis la tab Profil.
 *
 * Couvre :
 *   - attribution Wikimedia/Wikipedia pour les illustrations du catalogue
 *     maison (CC-BY-SA notamment)
 *   - attribution TMDb, source active des affiches de films et de séries :
 *     Wikimedia Commons n'en héberge aucune de réutilisable
 *   - attribution legacy des autres APIs externes (MusicBrainz, OSM,
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

  const { fontScale } = useWindowDimensions();
  // La place de l'accent de « CRÉDITS », rogné de 2,9 pt sur 5,2 à la recette
  // du 26 septembre 2026 : sans hauteur de ligne posée, iOS commence la ligne
  // d'Extenda à son ascendante, sous les accents. Un quart d'em couvre aussi le
  // titre agrandi par la police système. Cf. `display-title.ts`.
  const titleAccentRoom = extendaAccentRoom(
    TITLE,
    TITLE_FONT_SIZE,
    Platform.OS === 'android' ? PixelRatio.get() : undefined,
  );

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
            {/* Un glyphe dans une cible de 36 pt, pas un texte à lire : grossi, il
                sortait de sa pastille, comme sur la page publique. */}
            <Text allowFontScaling={false} style={{ fontSize: 16, fontWeight: '800' }}>
              ‹
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 }}>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            adjustsFontSizeToFit
            maxFontSizeMultiplier={TITLE_MAX_FONT_MULTIPLIER}
            style={{
              fontFamily: 'Extenda',
              fontSize: TITLE_FONT_SIZE,
              letterSpacing: 1,
              textTransform: 'uppercase',
              paddingTop: titleAccentRoom,
              marginTop: -titleAccentRoom,
            }}
          >
            {TITLE}
          </Text>
          <Text
            maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
            style={{ marginTop: 6, fontSize: 13, color: 'rgba(10,10,10,0.65)' }}
          >
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
              source="TMDb"
              text="Les affiches de films et de séries proviennent de The Movie Database (TMDb). Ce produit utilise l'API TMDb mais n'est ni approuvé ni certifié par TMDb."
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
            allowFontScaling={false}
            style={{
              marginTop: 32,
              ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 11, 17),
              color: INK_MUTED,
              textAlign: 'center',
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
        numberOfLines={1}
        maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
        style={{
          fontFamily: 'Bungee',
          fontSize: 10,
          letterSpacing: 2,
          color: INK_MUTED,
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
      accessibilityState={{ disabled: !onPress }}
      style={{
        paddingVertical: 13,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Text
        maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
        style={{ fontSize: 14, fontWeight: '600', flex: 1 }}
      >
        {label}
      </Text>
      {/* Une flèche, pas un texte à lire. */}
      {onPress ? (
        <Text allowFontScaling={false} style={{ fontSize: 18, color: INK_PLACEHOLDER }}>
          ↗
        </Text>
      ) : null}
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
  const { fontScale } = useWindowDimensions();
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
          maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
          style={{
            fontFamily: 'Bungee',
            fontSize: 11,
            letterSpacing: 1.5,
            color: '#e63946',
            textTransform: 'uppercase',
            flexShrink: 1,
          }}
        >
          {source}
        </Text>
        <Text
          allowFontScaling={false}
          style={{ marginLeft: 'auto', fontSize: 14, color: INK_PLACEHOLDER }}
        >
          ↗
        </Text>
      </View>
      <Text
        allowFontScaling={false}
        style={{
          marginTop: 6,
          ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 12, 17),
          color: 'rgba(10,10,10,0.75)',
        }}
      >
        {text}
      </Text>
    </Pressable>
  );
}
