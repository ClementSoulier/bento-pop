import { useCallback, useEffect, useMemo, useState } from 'react';
import { bentoRoute } from '@/lib/bento-address';
import {
  ActivityIndicator,
  FlatList,
  Image,
  PixelRatio,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import logo from '@bento-pop/brand/assets/logo/bento-pop.png';
import {
  FeedEpisodePost,
  FeedPost,
  FeedPostSkeleton,
  feedBoxWidth,
  feedScale,
  feedSideInset,
} from '@/components/feed';
import {
  CONTENT_MAX_FONT_MULTIPLIER,
  CONTROL_MAX_FONT_MULTIPLIER,
  TITLE_MAX_FONT_MULTIPLIER,
  scaledType,
} from '@/components/bento/font-scaling';
import { INK_MUTED, Sticker, YellowBg } from '@/components/primitives';
import { EPISODES_GRACE_MS, episodesQueryOptions, type FeedEpisode } from '@/lib/episodes';
import {
  FEED_QUERY_KEY,
  PAGE_SIZE,
  followingFeedQueryKey,
  loadFeedPage,
  loadFollowingPage,
  type FeedCursor,
} from '@/lib/feed';
import { interleaveFeed, type FeedItem } from '@/lib/feed-merge';
import { extendaAccentRoom } from '@/lib/display-title';
import { LANDING_URL } from '@/lib/landing-url';
import { SegmentPills } from '@/components/follows/SegmentPills';
import { useFollowSummary, useFollowsEnabled, useViewer } from '@/components/follows/use-follows';
import { useBlocked } from '@/state/blocked';
import { useTableFilter, type TableFilter } from '@/state/table-filter';
import { isBlockedAccount } from '@/lib/blocked-accounts';
import { supabase } from '@/supabase/client';

/** Une référence stable tant que la landing n'a rien rendu, pour `useMemo`. */
const NO_EPISODES: FeedEpisode[] = [];

/**
 * Onglet « La table » : le fil des bentos publiés, du plus récent au plus
 * ancien, coups de cœur compris et distingués sur place, et les épisodes de
 * l'émission et du podcast, chacun à sa date parmi eux.
 *
 * Cf. `docs/UX-02-FIL-LA-TABLE.md` et `docs/UX-19-EPISODES-LA-TABLE.md`.
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

  // Chantier 23 (D1, D7) : « Tout le monde » ou « Abonnements », pour qui a
  // un profil ; sans lui, « La table » reste celle d'avant, au pixel près.
  const followsOn = useFollowsEnabled();
  const { viewerId, hasProfile } = useViewer();
  const chosen = useTableFilter((s) => s.filter);
  const setFilter = useTableFilter((s) => s.setFilter);
  const showFilter = followsOn && hasProfile;
  const following = showFilter && chosen === 'following';

  const everyone = useInfiniteQuery({
    queryKey: FEED_QUERY_KEY,
    initialPageParam: null as FeedCursor | null,
    queryFn: ({ pageParam }) => loadFeedPage(supabase, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !following,
  });
  const followed = useInfiniteQuery({
    queryKey: followingFeedQueryKey(viewerId),
    initialPageParam: null as FeedCursor | null,
    queryFn: ({ pageParam }) => loadFollowingPage(supabase, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: following,
  });
  const {
    data,
    isLoading,
    isError,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = following ? followed : everyone;
  // Vide, « Abonnements » dit si l'on ne suit personne ou si les comptes
  // suivis n'ont rien publié.
  const viewerSummary = useFollowSummary(following ? viewerId : null);

  const blocked = useBlocked((s) => s.index);
  const bentos = useMemo(
    () =>
      (data?.pages ?? [])
        .flatMap((page) => page.bentos)
        // Filtre local au device (AsyncStorage), donc inapplicable côté
        // serveur : une page de 8 peut rendre 7 posts. Sans importance sur un
        // défilement continu. Par compte depuis le chantier 21 (D8).
        .filter((bento) => !isBlockedAccount(blocked, bento)),
    [data, blocked],
  );

  // Les épisodes viennent de la landing, d'un bloc. En panne, elle laisse le
  // fil sans épisode et sans message (D9) : l'erreur se lit comme une liste
  // vide, et la prochaine requête les redemandera.
  const episodesQuery = useQuery(episodesQueryOptions(fetch, LANDING_URL));
  const episodes = episodesQuery.data ?? NO_EPISODES;
  const bentosLoaded = data !== undefined;
  // Les épisodes ne sont pas un compte : « Abonnements » ne les attend pas
  // et ne les montre pas (D7).
  const episodesWaitOver = useGrace(
    bentosLoaded,
    following || episodesQuery.status !== 'pending',
    EPISODES_GRACE_MS,
  );
  const waitingForEpisodes = bentosLoaded && !episodesWaitOver;

  // Le fil n'est complet qu'une fois sa dernière page chargée : avant, les
  // épisodes plus anciens que le dernier bento attendent la suivante.
  const items = useMemo(
    () =>
      bentosLoaded && episodesWaitOver
        ? interleaveFeed(bentos, following ? NO_EPISODES : episodes, !hasNextPage)
        : [],
    [bentosLoaded, episodesWaitOver, bentos, episodes, hasNextPage, following],
  );

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) =>
      item.type === 'bento' ? (
        <FeedPost
          bento={item.bento}
          width={boxWidth}
          sideInset={sideInset}
          scale={scale}
          onPress={() =>
            router.push(bentoRoute(item.bento.pseudo, item.bento.slug, item.bento.isPrimary))
          }
        />
      ) : (
        <FeedEpisodePost episode={item.episode} width={boxWidth} sideInset={sideInset} />
      ),
    [boxWidth, sideInset, scale],
  );

  const refetchEpisodes = episodesQuery.refetch;
  const refresh = useCallback(() => {
    void refetch();
    void refetchEpisodes();
  }, [refetch, refetchEpisodes]);

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
          data={items}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          // La barre d'onglets est un frère de l'écran, pas un calque
          // par-dessus : la liste s'arrête déjà au-dessus d'elle. Il ne reste
          // à réserver que de quoi ne pas coller le pied de liste au bord.
          contentContainerStyle={{ paddingBottom: 32 }}
          ListHeaderComponent={
            <Header
              sideInset={sideInset}
              filter={showFilter ? { value: following ? 'following' : 'all', onChange: setFilter } : null}
            />
          }
          ListEmptyComponent={
            isLoading || waitingForEpisodes ? (
              <Loading sideInset={sideInset} scale={scale} />
            ) : isError ? (
              <ErrorState onRetry={() => void refetch()} />
            ) : following ? (
              <FollowingEmpty followsSomeone={(viewerSummary.data?.following ?? 0) > 0} />
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
              onRefresh={refresh}
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
 * Vrai dès que `settled`, ou `ms` après que `armed` l'est devenu.
 *
 * Le fil attend ainsi les épisodes une fois ses bentos arrivés, au plus
 * `EPISODES_GRACE_MS` : arrivés après, ils pousseraient vers le bas un fil
 * déjà affiché, l'épisode le plus récent se plaçant souvent en tête. Une
 * landing lente ou en panne ne retient pas le fil davantage (D9, D14).
 */
function useGrace(armed: boolean, settled: boolean, ms: number): boolean {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!armed || settled || expired) return;
    const timer = setTimeout(() => setExpired(true), ms);
    return () => clearTimeout(timer);
  }, [armed, settled, expired, ms]);
  return settled || expired;
}

/**
 * Logo seul, puis le titre. Pas de chip « LA TABLE » : la barre d'onglets
 * indique déjà la section active, le doublon avait déjà été écarté sur
 * l'écran précédent.
 *
 * Sous le titre, pour qui a un profil, le filtre du chantier 23 (D1) : sans
 * lui, l'en-tête ne bouge pas d'un point.
 */
function Header({
  sideInset,
  filter,
}: {
  sideInset: number;
  filter: { value: TableFilter; onChange: (value: TableFilter) => void } | null;
}) {
  const { fontScale } = useWindowDimensions();
  return (
    <View style={{ paddingBottom: 18, paddingHorizontal: sideInset }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 8 }}>
        <Image source={logo} style={{ height: 28, width: 130 }} resizeMode="contain" />
      </View>
      <View style={{ paddingTop: 14 }}>
        {/* La police système appliquée par l'écran : Android ne plafonne pas la
            hauteur de ligne, cf. `fontScaleFor`. */}
        <Text
          accessibilityRole="header"
          allowFontScaling={false}
          style={{
            fontFamily: 'Extenda',
            // 1,4 et non le plafond des titres : réglé et recetté ainsi au
            // chantier 2. Hauteur de ligne supérieure à la police : Extenda a
            // des jambages généreux, et l'inverse (présent ailleurs dans
            // l'app) rogne les glyphes dès que la taille système augmente.
            ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 28, 30),
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          {'Tout le monde\nà table.'}
        </Text>
      </View>
      {filter ? (
        <View style={{ paddingTop: 14 }}>
          <SegmentPills
            value={filter.value}
            onChange={filter.onChange}
            options={[
              { value: 'all', label: 'Tout le monde' },
              { value: 'following', label: 'Abonnements' },
            ]}
          />
        </View>
      ) : null}
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
/**
 * « Abonnements » vide (D7) : on ne suit encore personne, et « Trouver » y
 * mène ; ou les comptes suivis n'ont encore rien publié.
 */
function FollowingEmpty({ followsSomeone }: { followsSomeone: boolean }) {
  const { fontScale } = useWindowDimensions();
  const title = followsSomeone
    ? 'Les comptes que tu suis n’ont encore rien publié.'
    : 'Tu ne suis encore personne.';
  const type = scaledType(fontScale, TITLE_MAX_FONT_MULTIPLIER, 22, 24);
  // Le « É » d'Extenda monte au-dessus de son ascendante : sans cette réserve,
  // prise sur la marge, iOS le rogne. Cf. `extendaAccentRoom`.
  const accentRoom = extendaAccentRoom(
    title,
    type.fontSize,
    Platform.OS === 'android' ? PixelRatio.get() : undefined,
  );
  return (
    <View style={{ alignItems: 'center', paddingTop: 48 - accentRoom, paddingHorizontal: 32 }}>
      <Text
        allowFontScaling={false}
        textBreakStrategy="simple"
        style={{
          paddingTop: accentRoom,
          fontFamily: 'Extenda',
          ...type,
          textAlign: 'center',
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </Text>
      {followsSomeone ? null : (
        <Pressable
          onPress={() => router.navigate('/(tabs)/search')}
          accessibilityRole="button"
          accessibilityLabel="Trouver des comptes à suivre"
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
            Trouver des comptes
          </Text>
        </Pressable>
      )}
    </View>
  );
}

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
