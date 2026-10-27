import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  PixelRatio,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  CONTENT_MAX_FONT_MULTIPLIER,
  CONTROL_MAX_FONT_MULTIPLIER,
  TITLE_MAX_FONT_MULTIPLIER,
  fontScaleFor,
  scaledType,
} from '@/components/bento/font-scaling';
import { lineFitScale } from '@/components/bento/tile-title';
import { SegmentPills } from '@/components/follows/SegmentPills';
import {
  useFollowSummary,
  useFollowsEnabled,
  useFollowsRefresh,
  useViewer,
} from '@/components/follows/use-follows';
import { INK_MUTED, INK_PLACEHOLDER, SHADOWS, YellowBg, useToast } from '@/components/primitives';
import { isBlockedAccount, type BlockedAccounts } from '@/lib/blocked-accounts';
import {
  answerFollow,
  fetchFollowList,
  followListKey,
  removeFollower,
} from '@/lib/follow-actions';
import {
  followCursor,
  followErrorMessage,
  toFollowEntry,
  type FollowCursor,
  type FollowEntry,
} from '@/lib/follows';
import { popyFor } from '@/lib/popy-avatar';
import { useBlocked } from '@/state/blocked';
import { supabase } from '@/supabase/client';

type Tab = 'followers' | 'following';

const AVATAR = 44;
/** Le pseudo d'une ligne, Extenda 17, comme celui des matchs. */
const PSEUDO_SIZE = 17;
const PSEUDO_SPACING = 0.6;

/**
 * Les abonnés et les abonnements d'un compte, chantier 23 (D8) : deux
 * onglets, ouverts par la ligne de date de sa page. Chaque ligne mène au
 * profil. Sur sa propre liste, les demandes en tête des abonnés, avec
 * « Accepter » et « Refuser » (D3), et « Retirer » sur chaque abonné.
 *
 * Les listes sont publiques (D2), sans les comptes que l'on a bloqués : la
 * base retire ceux de son blocage en base, l'écran ceux qui ne sont bloqués
 * que sur ce téléphone (D21).
 *
 * `pseudo` vient de la page : le titre n'attend pas la base.
 */
export default function FollowsScreen() {
  const {
    userId = '',
    pseudo = '',
    tab,
  } = useLocalSearchParams<{ userId: string; pseudo?: string; tab?: string }>();
  const { fontScale } = useWindowDimensions();
  const { viewerId } = useViewer();
  const enabled = useFollowsEnabled();
  const isOwn = viewerId !== null && viewerId === userId;
  const [active, setActive] = useState<Tab>(tab === 'following' ? 'following' : 'followers');
  const { data: summary } = useFollowSummary(userId);
  const blocked = useBlocked((s) => s.index);

  const list = useInfiniteQuery({
    queryKey: followListKey(userId, active, viewerId),
    initialPageParam: null as FollowCursor | null,
    queryFn: ({ pageParam }) => fetchFollowList(supabase, userId, active, pageParam),
    getNextPageParam: (last) => followCursor(last),
    enabled: enabled && userId !== '',
  });
  const requests = useQuery({
    queryKey: followListKey(userId, 'requests', viewerId),
    queryFn: () => fetchFollowList(supabase, userId, 'requests'),
    enabled: enabled && isOwn && active === 'followers',
  });

  const entries = useMemo(
    () => withoutBlocked((list.data?.pages ?? []).flat().map(toFollowEntry), blocked),
    [list.data, blocked],
  );
  const pending = useMemo(
    () => withoutBlocked((requests.data ?? []).map(toFollowEntry), blocked),
    [requests.data, blocked],
  );

  const titleSize = 30 * fontScaleFor(fontScale, TITLE_MAX_FONT_MULTIPLIER);
  const followers = summary?.followers;
  const following = summary?.following;

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ height: 44, paddingTop: 8, paddingHorizontal: 16, flexDirection: 'row' }}>
          <BackButton fallback={pseudo ? (`/u/${pseudo}` as const) : '/(tabs)/table'} />
        </View>
        <FlatList
          data={entries}
          keyExtractor={(e) => e.userId}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          ListHeaderComponent={
            <View>
              <Text
                accessibilityRole="header"
                numberOfLines={1}
                adjustsFontSizeToFit
                allowFontScaling={false}
                style={{
                  marginTop: 18,
                  fontFamily: 'Extenda',
                  fontSize: titleSize,
                  lineHeight: titleSize * 1.15,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                @{pseudo}
              </Text>
              <View style={{ marginTop: 14, marginBottom: 22 }}>
                <SegmentPills
                  value={active}
                  onChange={setActive}
                  options={[
                    {
                      value: 'followers',
                      label: followers === undefined ? 'Abonnés' : `Abonnés · ${followers}`,
                      accessibilityLabel:
                        followers === undefined ? 'Abonnés' : `Abonnés, ${followers}`,
                    },
                    {
                      value: 'following',
                      label: following === undefined ? 'Abonnements' : `Abonnements · ${following}`,
                      accessibilityLabel:
                        following === undefined ? 'Abonnements' : `Abonnements, ${following}`,
                    },
                  ]}
                />
              </View>
              {isOwn && active === 'followers' && pending.length > 0 ? (
                <Requests entries={pending} />
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <FollowRow entry={item} removable={isOwn && active === 'followers'} />
          )}
          ListEmptyComponent={
            list.isPending && enabled ? (
              <ActivityIndicator size="small" color="#0a0a0a" style={{ marginTop: 24 }} />
            ) : list.isError ? (
              <ErrorState onRetry={() => void list.refetch()} />
            ) : (
              <Text
                allowFontScaling={false}
                style={{ ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 15, 21), color: INK_MUTED }}
              >
                {emptyLine(active, isOwn, pseudo)}
              </Text>
            )
          }
          ListFooterComponent={
            list.isFetchingNextPage ? (
              <ActivityIndicator size="small" color="#0a0a0a" style={{ marginTop: 12 }} />
            ) : null
          }
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
          }}
          onEndReachedThreshold={0.6}
        />
      </SafeAreaView>
    </YellowBg>
  );
}

/** Sans les comptes bloqués sur ce téléphone (D21). */
function withoutBlocked(entries: FollowEntry[], blocked: BlockedAccounts): FollowEntry[] {
  return entries.filter((e) => !isBlockedAccount(blocked, { userId: e.userId, pseudo: e.pseudo }));
}

function emptyLine(tab: Tab, isOwn: boolean, pseudo: string): string {
  if (tab === 'followers') return isOwn ? 'Personne ne te suit encore.' : `Personne ne suit encore @${pseudo}.`;
  return isOwn ? 'Tu ne suis encore personne.' : `@${pseudo} ne suit encore personne.`;
}

function BackButton({ fallback }: { fallback: `/u/${string}` | '/(tabs)/table' }) {
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
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
  );
}

/**
 * Les demandes reçues, en tête de ses abonnés (D3, D9). Une réponse retire la
 * ligne tout de suite ; la base dit ensuite les nombres.
 */
function Requests({ entries }: { entries: readonly FollowEntry[] }) {
  const { fontScale } = useWindowDimensions();
  const refresh = useFollowsRefresh();
  const showToast = useToast((s) => s.show);
  const [answered, setAnswered] = useState<ReadonlySet<string>>(new Set());
  const shown = entries.filter((e) => !answered.has(e.userId));
  if (shown.length === 0) return null;

  const answer = async (entry: FollowEntry, accept: boolean) => {
    setAnswered((s) => new Set(s).add(entry.userId));
    try {
      await answerFollow(supabase, entry.userId, accept);
    } catch (e) {
      console.warn('[abonnements] répondre', e);
      setAnswered((s) => {
        const next = new Set(s);
        next.delete(entry.userId);
        return next;
      });
      showToast(followErrorMessage(e), { variant: 'danger' });
    } finally {
      refresh();
    }
  };

  return (
    <View style={{ marginBottom: 24, gap: 10 }}>
      <Text
        accessibilityRole="header"
        allowFontScaling={false}
        style={{
          fontFamily: 'Bungee',
          fontSize: 11 * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER),
          letterSpacing: 1.5,
          color: INK_MUTED,
          textTransform: 'uppercase',
        }}
      >
        {shown.length > 1 ? `${shown.length} demandes` : '1 demande'}
      </Text>
      {shown.map((entry) => (
        <View key={entry.userId} style={{ gap: 8 }}>
          <FollowRow entry={entry} removable={false} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: -6, marginBottom: 6 }}>
            <SmallButton
              label="Accepter"
              accessibilityLabel={`Accepter @${entry.pseudo}`}
              dark
              onPress={() => void answer(entry, true)}
            />
            <SmallButton
              label="Refuser"
              accessibilityLabel={`Refuser @${entry.pseudo}`}
              onPress={() => void answer(entry, false)}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Une ligne : le Popy, le pseudo, le nom. Un seul élément pour le lecteur
 * d'écran, qui mène au profil ; « Retirer » est un bouton à part, à côté et
 * non dedans, pour qu'on l'entende après la ligne (recette du 12).
 */
function FollowRow({ entry, removable }: { entry: FollowEntry; removable: boolean }) {
  const { fontScale } = useWindowDimensions();
  const scale = fontScaleFor(fontScale, CONTENT_MAX_FONT_MULTIPLIER);
  const popy = popyFor(entry.pseudo, entry.avatar);
  const refresh = useFollowsRefresh();
  const showToast = useToast((s) => s.show);
  const [gone, setGone] = useState(false);
  // La largeur de la colonne du pseudo, mesurée ; 0 avant la mesure.
  const [room, setRoom] = useState(0);
  const pseudoText = `@${entry.pseudo}`;
  const pseudoBase = PSEUDO_SIZE * scale;
  const pseudoSize =
    room > 0
      ? pseudoBase *
        lineFitScale(
          pseudoText,
          room,
          pseudoBase,
          PSEUDO_SPACING,
          Platform.OS === 'android' ? PixelRatio.get() : undefined,
        )
      : pseudoBase;
  if (gone) return null;

  const confirmRemove = () =>
    Alert.alert(`Retirer @${entry.pseudo} ?`, 'Il ne te suivra plus, sans en être prévenu.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: () => {
          setGone(true);
          removeFollower(supabase, entry.userId)
            .catch((e: unknown) => {
              console.warn('[abonnements] retirer', e);
              setGone(false);
              showToast(followErrorMessage(e), { variant: 'danger' });
            })
            .finally(refresh);
        },
      },
    ]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <Pressable
        onPress={() => router.push(`/u/${entry.pseudo}`)}
        accessible
        accessibilityRole="button"
        accessibilityLabel={entry.displayName ? `@${entry.pseudo}, ${entry.displayName}` : `@${entry.pseudo}`}
        accessibilityHint="Ouvre son profil"
        style={{ flex: 1 }}
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
              paddingVertical: 10,
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
          <View
            style={{ flex: 1, minWidth: 0, gap: 2 }}
            onLayout={(e) => setRoom(e.nativeEvent.layout.width)}
          >
            {/* Entier sur sa ligne, quitte à rétrécir, à la taille que l'écran
                mesure. Confiée à `adjustsFontSizeToFit`, celle de la première
                ligne tombait à la trace sur iOS, à froid, trois fois sur trois
                (recette du lot 5) : la colonne se mesure, puis le pseudo
                s'affiche à sa taille, sans clignoter. */}
            <Text
              allowFontScaling={false}
              style={{
                fontFamily: 'Extenda',
                fontSize: pseudoSize,
                letterSpacing: PSEUDO_SPACING,
                textTransform: 'uppercase',
                opacity: room > 0 ? 1 : 0,
              }}
            >
              {pseudoText}
            </Text>
            {entry.displayName ? (
              <Text numberOfLines={1} allowFontScaling={false} style={{ fontSize: 12 * scale, color: INK_MUTED }}>
                {entry.displayName}
              </Text>
            ) : null}
          </View>
          <Text allowFontScaling={false} style={{ fontSize: 22, fontWeight: '700', color: INK_PLACEHOLDER }}>
            ›
          </Text>
        </View>
      </Pressable>
      {removable ? (
        <SmallButton label="Retirer" accessibilityLabel={`Retirer @${entry.pseudo} de tes abonnés`} onPress={confirmRemove} />
      ) : null}
    </View>
  );
}

function SmallButton({
  label,
  accessibilityLabel,
  onPress,
  dark = false,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  dark?: boolean;
}) {
  const { fontScale } = useWindowDimensions();
  const scale = fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      // La pastille fait 34 pt : la cible tactile en fait 44.
      hitSlop={{ top: 5, bottom: 5 }}
      style={[
        {
          height: 34 * scale,
          justifyContent: 'center',
          paddingHorizontal: 14,
          borderRadius: 999,
          borderWidth: 2.5,
          borderColor: '#0a0a0a',
          backgroundColor: dark ? '#0a0a0a' : '#ffffff',
        },
        SHADOWS.stamp,
      ]}
    >
      <Text
        numberOfLines={1}
        allowFontScaling={false}
        style={{
          fontFamily: 'Bungee',
          fontSize: 11 * scale,
          lineHeight: 15 * scale,
          letterSpacing: 0.5,
          color: dark ? '#fbbf24' : '#0a0a0a',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
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
        On n&apos;arrive pas à charger cette liste. Vérifie ta connexion et réessaie.
      </Text>
      <SmallButton label="Réessayer" accessibilityLabel="Réessayer le chargement" dark onPress={onRetry} />
    </View>
  );
}
