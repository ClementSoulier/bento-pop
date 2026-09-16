import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import logo from '@bento-pop/brand/assets/logo/bento-pop.png';
import { FeedPost, FeedPostSkeleton, feedBoxWidth, feedScale, feedSideInset } from '@/components/feed';
import {
  CONTENT_MAX_FONT_MULTIPLIER,
  CONTROL_MAX_FONT_MULTIPLIER,
  TITLE_MAX_FONT_MULTIPLIER,
  scaledType,
} from '@/components/bento/font-scaling';
import { INK_MUTED, Sticker, YellowBg } from '@/components/primitives';
import {
  FEED_QUERY_KEY,
  PAGE_SIZE,
  loadFeedPage,
  type FeedBento,
  type FeedCursor,
} from '@/lib/feed';
import { useBlocked } from '@/state/blocked';
import { supabase } from '@/supabase/client';

/**
 * Onglet « La table » : le fil des bentos publiés, du plus récent au plus
 * ancien, coups de cœur compris et distingués sur place.
 *
 * Cf. `docs/UX-02-FIL-LA-TABLE.md`.
 *
 * `FlatList` et non `ScrollView` : le défilement infini a besoin
 * d'`onEndReached`, et un post fait environ 614 pt, donc monter les 26
 * bentos publiés d'un coup représenterait près de deux mille vues natives.
 */
export default function TableTab() {
  const { width } = useWindowDimensions();
  const boxWidth = feedBoxWidth(width);
  const sideInset = feedSideInset(width);
  const scale = feedScale(width);

  const {
    data,
    isLoading,
    isError,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: FEED_QUERY_KEY,
    initialPageParam: null as FeedCursor | null,
    queryFn: ({ pageParam }) => loadFeedPage(supabase, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const blocked = useBlocked((s) => s.pseudos);
  const bentos = useMemo(
    () =>
      (data?.pages ?? [])
        .flatMap((page) => page.bentos)
        // Filtre local au device (AsyncStorage), donc inapplicable côté
        // serveur : une page de 8 peut rendre 7 posts. Sans importance sur un
        // défilement continu.
        .filter((bento) => !blocked.has(bento.pseudo.toLowerCase())),
    [data, blocked],
  );

  const renderItem = useCallback(
    ({ item }: { item: FeedBento }) => (
      <FeedPost
        bento={item}
        width={boxWidth}
        sideInset={sideInset}
        scale={scale}
        onPress={() => router.push(`/u/${item.pseudo}` as const)}
      />
    ),
    [boxWidth, sideInset, scale],
  );

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <YellowBg>
      {/* `edges={['top']}` : la barre d'onglets occupe déjà la zone sûre du
          bas. Sans cette restriction, la marge de sécurité s'ajoute par
          dessus et laisse une bande jaune morte entre le dernier post et la
          barre. Même réglage que le composer. */}
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <FlatList
          data={bentos}
          keyExtractor={(bento) => bento.bentoId}
          renderItem={renderItem}
          // La barre d'onglets est un frère de l'écran, pas un calque
          // par-dessus : la liste s'arrête déjà au-dessus d'elle. Il ne reste
          // à réserver que de quoi ne pas coller le pied de liste au bord.
          contentContainerStyle={{ paddingBottom: 32 }}
          ListHeaderComponent={<Header sideInset={sideInset} />}
          ListEmptyComponent={
            isLoading ? (
              <Loading sideInset={sideInset} scale={scale} />
            ) : isError ? (
              <ErrorState onRetry={() => void refetch()} />
            ) : (
              <EmptyState />
            )
          }
          ListFooterComponent={
            <Footer
              loadingMore={isFetchingNextPage}
              exhausted={!hasNextPage && bentos.length > PAGE_SIZE}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.6}
          refreshControl={
            <RefreshControl
              // `isFetching` couvre aussi le chargement de page suivante :
              // sans l'exclure, l'indicateur de rafraîchissement apparaîtrait
              // en haut à chaque fois qu'on atteint le bas.
              refreshing={isFetching && !isLoading && !isFetchingNextPage}
              onRefresh={() => void refetch()}
              tintColor="#0a0a0a"
            />
          }
          // Un post occupe presque un écran : en monter deux d'avance suffit,
          // et `windowSize` à 3 borne à environ quatre posts vivants.
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          // Android seulement : sur iOS, cette option laisse des cellules
          // blanches sur les listes à cellules hautes, ce qui est exactement
          // notre cas.
          removeClippedSubviews={Platform.OS === 'android'}
        />
      </SafeAreaView>
    </YellowBg>
  );
}

/**
 * Logo seul, puis le titre. Pas de chip « LA TABLE » : la barre d'onglets
 * indique déjà la section active, le doublon avait déjà été écarté sur
 * l'écran précédent.
 */
function Header({ sideInset }: { sideInset: number }) {
  return (
    <View style={{ paddingBottom: 18, paddingHorizontal: sideInset }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 8 }}>
        <Image source={logo} style={{ height: 28, width: 130 }} resizeMode="contain" />
      </View>
      <View style={{ paddingTop: 14 }}>
        <Text
          accessibilityRole="header"
          // 1,4 et non le plafond des titres : réglé et recetté ainsi au chantier 2.
          maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
          style={{
            fontFamily: 'Extenda',
            fontSize: 28,
            // `lineHeight` supérieur au `fontSize` : Extenda a des jambages
            // généreux, et l'inverse (présent ailleurs dans l'app) rogne les
            // glyphes dès que la taille système augmente.
            lineHeight: 30,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          {'Tout le monde\nà table.'}
        </Text>
      </View>
    </View>
  );
}

/**
 * Deux squelettes de post plutôt qu'un indicateur centré : la hauteur de
 * l'écran ne saute pas à l'arrivée des données, et l'utilisateur voit la
 * forme de ce qui arrive.
 */
function Loading({ sideInset, scale }: { sideInset: number; scale: number }) {
  return (
    <View>
      <FeedPostSkeleton sideInset={sideInset} scale={scale} />
      <FeedPostSkeleton sideInset={sideInset} scale={scale} />
    </View>
  );
}

/**
 * Seul vrai état vide : aucun bento publié en base. N'arrive que sur une
 * base fraîche, l'ancien écran l'affichait dès qu'aucun bento n'était curé.
 */
function EmptyState() {
  const { fontScale } = useWindowDimensions();
  return (
    <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 }}>
      <Sticker color="#0a0a0a" textColor="#fbbf24" rotation={4} size={12}>
        La table est vide
      </Sticker>
      <Text
        allowFontScaling={false}
        // Android : passer à la ligne entre deux mots, jamais au milieu.
        textBreakStrategy="simple"
        style={{
          marginTop: 16,
          fontFamily: 'Extenda',
          ...scaledType(fontScale, TITLE_MAX_FONT_MULTIPLIER, 24, 26),
          textAlign: 'center',
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        {'Sois le premier\nà dresser la tienne'}
      </Text>
      <Pressable
        onPress={() => router.replace('/(tabs)/compose')}
        accessibilityRole="button"
        accessibilityLabel="Composer mon bento"
        style={{
          marginTop: 20,
          backgroundColor: '#0a0a0a',
          borderRadius: 999,
          paddingVertical: 12,
          paddingHorizontal: 24,
        }}
      >
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
          style={{
            fontFamily: 'Bungee',
            fontSize: 12,
            letterSpacing: 1,
            color: '#fbbf24',
            textTransform: 'uppercase',
          }}
        >
          Composer mon bento
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Un défilement qui s'arrête sans rien dire laisse croire à un chargement
 * bloqué. Le message final n'apparaît qu'au-delà d'une page, sinon il
 * s'afficherait sous les deux ou trois premiers bentos d'une base neuve.
 */
function Footer({ loadingMore, exhausted }: { loadingMore: boolean; exhausted: boolean }) {
  const { fontScale } = useWindowDimensions();
  if (loadingMore) {
    return (
      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
        <ActivityIndicator size="small" color="#0a0a0a" />
      </View>
    );
  }
  if (!exhausted) return null;
  return (
    <View style={{ paddingVertical: 8, paddingHorizontal: 32 }}>
      <Text
        allowFontScaling={false}
        style={{
          ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 13, 19),
          color: INK_MUTED,
          textAlign: 'center',
        }}
      >
        C&apos;est tout pour l&apos;instant. À toi de jouer.
      </Text>
    </View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { fontScale } = useWindowDimensions();
  return (
    <View style={{ alignItems: 'center', paddingTop: 48, paddingHorizontal: 32 }}>
      <Text
        allowFontScaling={false}
        textBreakStrategy="simple"
        style={{
          fontFamily: 'Extenda',
          ...scaledType(fontScale, TITLE_MAX_FONT_MULTIPLIER, 22, 24),
          textAlign: 'center',
          letterSpacing: 1,
        }}
      >
        Oups, ça coince
      </Text>
      <Text
        allowFontScaling={false}
        style={{
          marginTop: 8,
          ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 13, 19),
          color: 'rgba(10,10,10,0.65)',
          textAlign: 'center',
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
          numberOfLines={1}
          maxFontSizeMultiplier={CONTROL_MAX_FONT_MULTIPLIER}
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
