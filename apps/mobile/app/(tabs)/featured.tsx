import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import logo from '@bento-pop/brand/assets/logo/bento-pop.png';
import { MiniBentoCard } from '@/components/bento';
import { Sticker, YellowBg } from '@/components/primitives';
import { loadFeaturedBentos } from '@/lib/featured';
import { useBlocked } from '@/state/blocked';

/**
 * Tab « À la une » : bentos mis en avant par l'équipe Bento Pop.
 * Cf. design Claude Design — `FeaturedScreen` dans `screens.jsx`.
 *
 * Cache : staleTime 60s — un featured ajouté côté BO est visible quasi-
 * instantanément (au prochain pull-to-refresh ou changement d'écran).
 */
export default function FeaturedTab() {
  const {
    data: bentos = [],
    isLoading: loading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['featured-bentos'],
    queryFn: () => loadFeaturedBentos(12),
  });

  const refreshing = isFetching && !loading;
  const blocked = useBlocked((s) => s.pseudos);
  const visibleBentos = bentos.filter((b) => !blocked.has(b.pseudo.toLowerCase()));

  // Split : 4 premiers en « équipe », le reste en « coups de cœur »
  const team = visibleBentos.slice(0, 4);
  const others = visibleBentos.slice(4);

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor="#0a0a0a" />
          }
        >
          {/* Top bar logo seul — la tab bar du bas indique déjà la section
              active, on évite le doublon visuel du chip "À LA UNE". */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingTop: 8,
            }}
          >
            <Image source={logo} style={{ height: 28, width: 130 }} resizeMode="contain" />
          </View>

          <View style={{ paddingTop: 14, paddingHorizontal: 20 }}>
            <Sticker rotation={-3} style={{ marginBottom: 10 }}>
              L'ÉQUIPE BENTO POP
            </Sticker>
            <Text
              style={{
                fontFamily: 'Extenda',
                fontSize: 28,
                lineHeight: 26,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              {'Les bentos\ndu plateau.'}
            </Text>
          </View>

          {loading ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <ActivityIndicator size="large" color="#0a0a0a" />
            </View>
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : visibleBentos.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 }}>
              <Sticker color="#0a0a0a" textColor="#fbbf24" rotation={4} size={12}>
                Bientôt
              </Sticker>
              <Text
                style={{
                  marginTop: 16,
                  fontFamily: 'Extenda',
                  fontSize: 24,
                  textAlign: 'center',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                {'Pas encore\nde featured'}
              </Text>
              <Text
                style={{
                  marginTop: 12,
                  fontSize: 14,
                  color: 'rgba(10,10,10,0.65)',
                  textAlign: 'center',
                  lineHeight: 21,
                  maxWidth: 280,
                }}
              >
                L'équipe Bento Pop met en avant les bentos les plus inspirants chaque semaine. Reviens dans quelques jours !
              </Text>
            </View>
          ) : (
            <>
              {/* Carrousel équipe — single card centrée si une seule entrée
                  (sinon ça flotte à gauche sur un grand écran vide). */}
              {team.length === 1 && team[0] ? (
                <View style={{ alignItems: 'center', paddingTop: 16 }}>
                  <Pressable
                    onPress={() => router.push(`/u/${team[0]!.pseudo}` as const)}
                    accessibilityRole="button"
                    accessibilityLabel={`Voir le bento de @${team[0]!.pseudo}`}
                    style={{ transform: [{ rotate: '-1deg' }] }}
                  >
                    <MiniBentoCard
                      items={team[0]!.slots}
                      pseudo={team[0]!.pseudo}
                      name={team[0]!.displayName ?? undefined}
                    />
                  </Pressable>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, gap: 12 }}
                >
                  {team.map((b, i) => (
                    <Pressable
                      key={b.bentoId}
                      onPress={() => router.push(`/u/${b.pseudo}` as const)}
                      accessibilityRole="button"
                      accessibilityLabel={`Voir le bento de @${b.pseudo}`}
                      style={{ transform: [{ rotate: `${[-1, 0.6, -0.5, 0.8][i] ?? 0}deg` }] }}
                    >
                      <MiniBentoCard
                        items={b.slots}
                        pseudo={b.pseudo}
                        name={b.displayName ?? undefined}
                      />
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              {/* Coups de cœur */}
              {others.length > 0 ? (
                <>
                  <View style={{ paddingHorizontal: 20, paddingTop: 6 }}>
                    <Text
                      style={{
                        fontFamily: 'Bungee',
                        fontSize: 10,
                        letterSpacing: 2,
                        color: 'rgba(10,10,10,0.55)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Featured
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Extenda',
                        fontSize: 20,
                        lineHeight: 20,
                        letterSpacing: 0.8,
                        textTransform: 'uppercase',
                      }}
                    >
                      Coups de cœur de la semaine
                    </Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 12 }}
                  >
                    {others.map((b, i) => (
                      <Pressable
                        key={b.bentoId}
                        onPress={() => router.push(`/u/${b.pseudo}` as const)}
                        accessibilityRole="button"
                        accessibilityLabel={`Voir le bento de @${b.pseudo}`}
                        style={{ transform: [{ rotate: `${[0.5, -0.7, 0.4, -0.4][i % 4] ?? 0}deg` }] }}
                      >
                        <MiniBentoCard
                          items={b.slots}
                          pseudo={b.pseudo}
                          name={b.displayName ?? undefined}
                        />
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </YellowBg>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 48, paddingHorizontal: 32 }}>
      <Text
        style={{
          fontFamily: 'Extenda',
          fontSize: 22,
          textAlign: 'center',
          letterSpacing: 1,
        }}
      >
        Oups, ça coince
      </Text>
      <Text
        style={{
          marginTop: 8,
          fontSize: 13,
          color: 'rgba(10,10,10,0.65)',
          textAlign: 'center',
          lineHeight: 19,
        }}
      >
        On n&apos;arrive pas à charger les bentos. Vérifie ta connexion et réessaie.
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Réessayer le chargement"
        style={{
          marginTop: 16,
          backgroundColor: '#0a0a0a',
          borderRadius: 999,
          paddingVertical: 10,
          paddingHorizontal: 22,
        }}
      >
        <Text
          style={{
            fontFamily: 'Bungee',
            fontSize: 12,
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
