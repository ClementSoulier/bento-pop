import {
  ActivityIndicator,
  Image,
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  CONTENT_MAX_FONT_MULTIPLIER,
  CONTROL_MAX_FONT_MULTIPLIER,
  TITLE_MAX_FONT_MULTIPLIER,
  fontScaleFor,
  scaledType,
} from '@/components/bento/font-scaling';
import { INK_MUTED, INK_PLACEHOLDER, SHADOWS, YellowBg } from '@/components/primitives';
import { extendaAccentRoom } from '@/lib/display-title';
import {
  bentoMatchesQueryOptions,
  matchAccessibilityLabel,
  matchReasonLabel,
  matchRoute,
  withoutBlocked,
  type BentoMatch,
} from '@/lib/matches';
import { popyFor } from '@/lib/popy-avatar';
import { useBlocked } from '@/state/blocked';
import { publicSupabase } from '@/supabase/client';

const TITLE = 'Ils ont les mêmes goûts';
const TITLE_SIZE = 30;
const AVATAR = 44;

/**
 * « Ils ont les mêmes goûts », chantier 20 (D11) : les bentos qui ressemblent
 * le plus à un bento publié, chacun avec ce qu'ils ont en commun.
 *
 * Même requête que la pastille de la page du bento, `bentoMatchesQueryOptions`,
 * donc déjà en cache quand on arrive par elle. Une liste de vingt lignes au
 * plus : un `ScrollView` suffit, et ses vues ne se recyclent pas d'une ligne à
 * l'autre, ce qui a déjà coûté la fiabilité des rôles dans « La table ».
 *
 * Les textes appliquent eux-mêmes la taille système, plafonnée, cf.
 * `fontScaleFor`. Laissée à `maxFontSizeMultiplier`, la recette du lot 5 a
 * relevé deux défauts : à la taille 2,0 d'Android, des lignes écartées, sa
 * hauteur de ligne n'étant pas plafonnée ; sur iOS, une taille changée écran
 * ouvert, des textes grandis dans des boîtes restées à leur ancienne hauteur,
 * donc rognés, jusqu'à ce qu'on rouvre l'écran.
 *
 * `pseudo` et `own` viennent de la pastille : ils disent à qui l'on compare,
 * « que toi » sur son propre bento (D12).
 */
export default function MatchesScreen() {
  const {
    bentoId = '',
    pseudo = '',
    own,
  } = useLocalSearchParams<{
    bentoId: string;
    pseudo?: string;
    own?: string;
  }>();
  const isOwn = own === '1';
  const { fontScale } = useWindowDimensions();

  const { data, isError, isPending, refetch } = useQuery({
    ...bentoMatchesQueryOptions(publicSupabase, bentoId),
    enabled: bentoId !== '',
  });
  const blocked = useBlocked((s) => s.index);
  const matches = data ? withoutBlocked(data, blocked) : [];

  const titleSize = TITLE_SIZE * fontScaleFor(fontScale, TITLE_MAX_FONT_MULTIPLIER);
  const contentScale = fontScaleFor(fontScale, CONTENT_MAX_FONT_MULTIPLIER);
  // Le « Ê » et le « Û » d'Extenda montent au-dessus de son ascendante : sans
  // cette réserve, iOS les rogne. Cf. `extendaAccentRoom`.
  const accentRoom = extendaAccentRoom(
    TITLE,
    titleSize,
    Platform.OS === 'android' ? PixelRatio.get() : undefined,
  );

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ height: 44, paddingTop: 8, paddingHorizontal: 16, flexDirection: 'row' }}>
          <Pressable
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace(pseudo ? (`/u/${pseudo}` as const) : '/(tabs)/table')
            }
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
          <Text
            allowFontScaling={false}
            style={{ marginTop: 6, marginBottom: 22, fontSize: 15 * contentScale, color: INK_MUTED }}
          >
            {isOwn ? 'que toi' : pseudo ? `que @${pseudo}` : 'que ce bento'}
          </Text>

          {isPending && bentoId !== '' ? (
            <ActivityIndicator size="small" color="#0a0a0a" style={{ marginTop: 24 }} />
          ) : isError ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : matches.length === 0 ? (
            <Text
              allowFontScaling={false}
              style={{ ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 15, 21), color: INK_MUTED }}
            >
              Personne n&apos;a encore ces goûts-là. Reviens quand d&apos;autres bentos seront en
              ligne.
            </Text>
          ) : (
            matches.map((match) => <MatchRow key={match.bentoId} match={match} />)
          )}
        </ScrollView>
      </SafeAreaView>
    </YellowBg>
  );
}

/**
 * Une ligne : le Popy et le pseudo, l'édition ou le nom affiché, puis ce
 * qu'ils ont en commun. Un seul élément pour VoiceOver et TalkBack, qui
 * entendent tous les items, et ses descendants masqués.
 */
function MatchRow({ match }: { match: BentoMatch }) {
  const { fontScale } = useWindowDimensions();
  const scale = fontScaleFor(fontScale, CONTENT_MAX_FONT_MULTIPLIER);
  const popy = popyFor(match.pseudo, match.avatar);
  const subtitle = match.editionTitle ? `« ${match.editionTitle} »` : match.displayName;

  return (
    <Pressable
      onPress={() => router.push(matchRoute(match))}
      accessible
      accessibilityRole="button"
      accessibilityLabel={matchAccessibilityLabel(match)}
      accessibilityHint="Ouvre son bento"
      style={{ marginBottom: 14 }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: '#ffffff',
            borderWidth: 2.5,
            borderColor: '#0a0a0a',
            borderRadius: 16,
            paddingVertical: 12,
            paddingLeft: 12,
            paddingRight: 14,
          },
          SHADOWS.stamp,
        ]}
      >
        <View
          style={{
            width: AVATAR,
            height: AVATAR,
            borderRadius: AVATAR / 2,
            backgroundColor: popy.accent,
            borderWidth: 2.5,
            borderColor: '#0a0a0a',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <Image
            source={popy.source}
            style={{ width: AVATAR - 10, height: AVATAR - 10 }}
            resizeMode="contain"
          />
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          {/* Le pseudo reste entier sur sa ligne, quitte à rétrécir, comme
              dans l'en-tête de la page du bento. Tronqué, son ellipse perdait
              la moitié de son dernier point sur Android, qui la mesure plus
              étroite qu'Extenda ne la dessine (recette du lot 5). */}
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            allowFontScaling={false}
            style={{
              fontFamily: 'Extenda',
              ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 17, 19),
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            @{match.pseudo}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              allowFontScaling={false}
              style={{ fontSize: 12 * scale, color: INK_MUTED }}
            >
              {subtitle}
            </Text>
          ) : null}
          <Text
            numberOfLines={2}
            allowFontScaling={false}
            style={{
              fontFamily: 'Fredoka-Medium',
              ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 14, 19),
              color: '#0a0a0a',
            }}
          >
            {matchReasonLabel(match)}
          </Text>
        </View>

        {/* Où mène la ligne : 60 % d'encre, le minimum des flèches. */}
        <Text
          allowFontScaling={false}
          style={{ fontSize: 22, fontWeight: '700', color: INK_PLACEHOLDER }}
        >
          ›
        </Text>
      </View>
    </Pressable>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { fontScale } = useWindowDimensions();
  return (
    <View style={{ alignItems: 'flex-start', gap: 12 }}>
      <Text
        allowFontScaling={false}
        style={{ ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 15, 21), color: INK_MUTED }}
      >
        On n&apos;arrive pas à charger les bentos qui lui ressemblent. Vérifie ta connexion et
        réessaie.
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Réessayer le chargement"
        style={{
          backgroundColor: '#0a0a0a',
          borderRadius: 999,
          paddingVertical: 10,
          paddingHorizontal: 22,
        }}
      >
        <Text
          numberOfLines={1}
          allowFontScaling={false}
          style={{
            fontFamily: 'Bungee',
            fontSize: 12 * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER),
            letterSpacing: 1,
            color: '#fbbf24',
            textTransform: 'uppercase',
          }}
        >
          Réessayer
        </Text>
      </Pressable>
    </View>
  );
}
