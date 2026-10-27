import { useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  CONTENT_MAX_FONT_MULTIPLIER,
  CONTROL_MAX_FONT_MULTIPLIER,
  fontScaleFor,
  scaledType,
} from '@/components/bento/font-scaling';
import { useViewer } from '@/components/follows/use-follows';
import {
  useNotificationList,
  useNotificationsReady,
} from '@/components/notifications/use-notifications';
import { INK_MUTED, SHADOWS, TopChip, YellowBg } from '@/components/primitives';
import { markNotificationsSeen, notificationBadgeKey } from '@/lib/notification-actions';
import {
  notificationAccessibilityLabel,
  notificationSections,
  seenUntil,
  toNotification,
  type Notification,
  type NotificationAvatar,
  type NotificationTarget,
} from '@/lib/notifications';
import { POPY_CHOICES, popyFor } from '@/lib/popy-avatar';
import { relativeDate } from '@/lib/relative-date';
import { usePushTarget } from '@/state/push-target';
import { useSession } from '@/state/session';
import { supabase } from '@/supabase/client';

const AVATAR = 44;
/** Le Popy de Bento Pop, pour les décisions de l'équipe (D2). */
const TEAM_POPY = POPY_CHOICES[0];

/**
 * L'onglet « Notifs », chantier 24 : la zone de notifications (D1, D5).
 *
 * Une ligne par sujet, regroupée par la base (D6) ; les nouvelles en tête,
 * sur fond jaune clair. Arriver sur l'onglet relit la zone ; une fois
 * affichée, la ligne la plus récente devient la date de lecture (D8), et la
 * pastille s'éteint. Les lignes restent marquées pendant la visite : elles ne
 * deviennent « plus tôt » qu'à la lecture suivante.
 *
 * Sans profil, rien ne peut arriver : l'écran le dit, et propose de composer
 * (D12).
 */
export default function NotificationsTab() {
  const { fontScale } = useWindowDimensions();
  const ready = useNotificationsReady();
  const { viewerId, hasProfile } = useViewer();
  const pseudo = useSession((s) => s.profile?.pseudo ?? null);
  const list = useNotificationList(ready);
  const queryClient = useQueryClient();
  const focused = useIsFocused();

  const rows = useMemo(() => (list.data?.pages ?? []).flat(), [list.data]);
  const items = useMemo(
    () => (viewerId && pseudo ? rows.map((r) => toNotification(r, { id: viewerId, pseudo })) : []),
    [rows, viewerId, pseudo],
  );
  const sections = useMemo(() => notificationSections(items), [items]);

  // Chaque arrivée sur l'onglet relit la zone (D9) ; la première lecture
  // vient de la requête elle-même.
  const { isFetched, refetch } = list;
  useFocusEffect(
    useCallback(() => {
      if (ready && isFetched) void refetch();
    }, [ready, isFetched, refetch]),
  );

  // La date de lecture (D8), posée tant que l'onglet est à l'écran et qu'il
  // montre du neuf ; puis la pastille, relue.
  const until = seenUntil(rows);
  const hasNew = rows.some((r) => r.is_new);
  useEffect(() => {
    if (!focused || !ready || !until || !hasNew) return;
    const key = notificationBadgeKey(viewerId);
    markNotificationsSeen(supabase, until)
      .then(() => {
        queryClient.setQueryData(key, 0);
        void queryClient.invalidateQueries({ queryKey: key });
      })
      .catch((e: unknown) => console.warn('[notifications] lu', e));
  }, [focused, ready, until, hasNew, viewerId, queryClient]);

  const sectionTitleSize = 11 * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER);

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1 }}>
        <SectionList
          sections={sections}
          keyExtractor={(n) => n.key}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          refreshControl={
            ready ? (
              <RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor="#0a0a0a" />
            ) : undefined
          }
          ListHeaderComponent={
            <View>
              <View style={{ paddingTop: 8, marginHorizontal: -20 }}>
                <TopChip label="NOTIFICATIONS" />
              </View>
              {/* Plafonné par l'écran lui-même, hauteur de ligne comprise,
                  comme le titre de « Trouver ». Sans accent : sa place n'a pas
                  à être réservée. */}
              <Text
                accessibilityRole="header"
                allowFontScaling={false}
                style={{
                  marginTop: 16,
                  marginBottom: 20,
                  fontFamily: 'Extenda',
                  ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 28, 26),
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                {'Quoi de\nneuf ?'}
              </Text>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <Text
              accessibilityRole="header"
              allowFontScaling={false}
              style={{
                fontFamily: 'Bungee',
                fontSize: sectionTitleSize,
                letterSpacing: 1.5,
                color: INK_MUTED,
                textTransform: 'uppercase',
                marginBottom: 10,
                marginTop: section.title === 'Plus tôt' ? 10 : 0,
              }}
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => <NotificationLine item={item} />}
          ListEmptyComponent={
            !hasProfile ? (
              <EmptyState
                line="Ici arrivent les likes, les commentaires et les abonnés de ton bento."
                action={{ label: 'Compose le tien', onPress: () => router.navigate('/(tabs)/compose') }}
              />
            ) : list.isPending && ready ? (
              <ActivityIndicator size="small" color="#0a0a0a" style={{ marginTop: 24 }} />
            ) : list.isError ? (
              <EmptyState
                line="On n'arrive pas à charger tes notifications. Vérifie ta connexion et réessaie."
                action={{ label: 'Réessayer', onPress: () => void list.refetch() }}
              />
            ) : (
              <EmptyState line="Rien de neuf pour l'instant. Les likes, les commentaires et les abonnés de tes bentos arriveront ici." />
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

/** Mène au sujet d'une ligne (§5). */
function openTarget(target: NotificationTarget): void {
  switch (target.kind) {
    case 'page':
      router.push(target.href);
      return;
    case 'comments':
      router.push({ pathname: '/comments/[bentoId]', params: { bentoId: target.bentoId } });
      return;
    case 'followers':
      router.push({
        pathname: '/follows/[userId]',
        params: { userId: target.userId, pseudo: target.pseudo, tab: 'followers' },
      });
      return;
    case 'push':
      // Le chemin du tap du push du 17 (D10) : le composer suit la cible une
      // fois à l'écran.
      usePushTarget.getState().set(target.target);
      router.navigate('/(tabs)/compose');
      return;
    case 'whys':
      router.push({
        pathname: '/whys/[bentoId]',
        params: target.slug
          ? { bentoId: target.bentoId, pseudo: target.pseudo, slug: target.slug }
          : { bentoId: target.bentoId, pseudo: target.pseudo },
      });
      return;
  }
}

function hintOf(target: NotificationTarget | null): string | undefined {
  switch (target?.kind) {
    case 'page':
      return 'Ouvre le bento';
    case 'comments':
      return 'Ouvre les commentaires';
    case 'followers':
      return 'Ouvre tes abonnés';
    case 'push':
      return 'Ouvre le composer';
    case 'whys':
      return 'Ouvre tes pourquoi';
    default:
      return undefined;
  }
}

/**
 * Une ligne : l'avatar, la phrase, l'heure, et le point des nouvelles. Un
 * seul élément pour le lecteur d'écran, qui lit la phrase en entier (D20).
 */
function NotificationLine({ item }: { item: Notification }) {
  const { fontScale } = useWindowDimensions();
  const { target } = item;
  const when = relativeDate(item.at);
  return (
    <Pressable
      onPress={target ? () => openTarget(target) : undefined}
      accessible
      accessibilityRole={target ? 'button' : 'text'}
      accessibilityLabel={notificationAccessibilityLabel(item)}
      accessibilityHint={hintOf(target)}
      style={{ marginBottom: 12 }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: item.isNew ? '#ffd857' : '#ffffff',
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
        <Avatar avatar={item.avatar} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text
            allowFontScaling={false}
            style={{ ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 14, 19), color: '#0a0a0a' }}
          >
            {item.parts.map((part, i) =>
              part.strong ? (
                // Imbriqué : il prend la taille de la phrase, seule sa
                // graisse change.
                <Text key={i} allowFontScaling={false} style={{ fontWeight: '800' }}>
                  {part.text}
                </Text>
              ) : (
                part.text
              ),
            )}
          </Text>
          {when ? (
            <Text
              allowFontScaling={false}
              style={{ ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 12, 16), color: INK_MUTED }}
            >
              {when}
            </Text>
          ) : null}
        </View>
        {item.isNew ? (
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: '#e63946',
              borderWidth: 2,
              borderColor: '#0a0a0a',
            }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

function Avatar({ avatar }: { avatar: NotificationAvatar }) {
  const circle = {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 2.5,
    borderColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  } as const;

  if (avatar.kind === 'like') {
    return (
      <View style={[circle, { backgroundColor: '#e63946' }]}>
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path
            d="M12 20.5 C 6 16.5, 2.5 13.2, 2.5 9.2 C 2.5 6.3, 4.7 4, 7.5 4 C 9.4 4, 11 5, 12 6.6 C 13 5, 14.6 4, 16.5 4 C 19.3 4, 21.5 6.3, 21.5 9.2 C 21.5 13.2, 18 16.5, 12 20.5 Z"
            fill="#ffffff"
            stroke="#0a0a0a"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    );
  }

  const popy = avatar.kind === 'account' ? popyFor(avatar.pseudo, avatar.avatar) : TEAM_POPY;
  return (
    <View style={[circle, { backgroundColor: avatar.kind === 'team' ? '#fbf3de' : popy?.accent }]}>
      {popy ? (
        <Image source={popy.source} style={{ width: AVATAR - 10, height: AVATAR - 10 }} resizeMode="contain" />
      ) : null}
    </View>
  );
}

function EmptyState({ line, action }: { line: string; action?: { label: string; onPress: () => void } }) {
  const { fontScale } = useWindowDimensions();
  const scale = fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER);
  return (
    <View style={{ alignItems: 'flex-start', gap: 14, paddingTop: 4 }}>
      <Text
        allowFontScaling={false}
        style={{ ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 15, 21), color: INK_MUTED }}
      >
        {line}
      </Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={{ top: 5, bottom: 5 }}
          style={[
            {
              height: 38 * scale,
              justifyContent: 'center',
              paddingHorizontal: 18,
              borderRadius: 999,
              borderWidth: 2.5,
              borderColor: '#0a0a0a',
              backgroundColor: '#0a0a0a',
            },
            SHADOWS.stamp,
          ]}
        >
          <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={{
              fontFamily: 'Bungee',
              fontSize: 12 * scale,
              lineHeight: 16 * scale,
              letterSpacing: 0.5,
              color: '#fbbf24',
              textTransform: 'uppercase',
            }}
          >
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
