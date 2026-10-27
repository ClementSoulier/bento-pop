import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { BentoBoxSkeleton, BentoGrid, SKELETON_BONE, ShareImage } from '@/components/bento';
import { HeaderActions } from '@/components/social/ActionBar';
import { ActionSheet, type SheetAction } from '@/components/social/ActionSheet';
import { fontScaleFor } from '@/components/bento/font-scaling';
import {
  CONTROL_MAX_FONT_MULTIPLIER,
  CONTENT_MAX_FONT_MULTIPLIER,
  CTA_LABEL_LINE_H,
  DATE_LINE_H,
  PSEUDO_LINE_H,
  PUBLIC_CTA,
  PUBLIC_HEADER,
  PUBLIC_TOP_BAR,
  OTHERS_CHIP_H,
  OTHERS_GAP,
  TOP_BAR_H,
  publicBentoScale,
  publicCtaLabelHeight,
  publicScrollBottomInset,
  publicSideInset,
} from '@/components/bento/public-layout';
import { INK_MUTED, SHADOWS, YellowBg, useToast } from '@/components/primitives';
import {
  bentoMatchesQueryOptions,
  matchesPillAccessibilityLabel,
  matchesPillLabel,
  withoutBlocked,
} from '@/lib/matches';
import { popyFor } from '@/lib/popy-avatar';
import type { PublicBento, PublicBentoRef } from '@/lib/public-bento';
import { publicBentoQueryOptions } from '@/lib/public-bento-query';
import { publicPageState } from '@/lib/public-page-state';
import { shareBentoImage } from '@/lib/share-image';
import { useIsOffline } from '@/lib/use-is-offline';
import { useOfflineInset } from '@/lib/use-offline-inset';
import { bentoVisitsQueryOptions } from '@/lib/visits';
import { followSegment, profileDateLine } from '@/lib/follows';
import { useSocialLinks, useSocialLinksEnabled } from '@/components/social-links/use-social-links';
import {
  shownNetworks,
  socialLinkHint,
  socialLinkLabel,
  socialProfileUrl,
  type SocialNetworkName,
} from '@/lib/social-links';
import {
  useFollowButton,
  useFollowSummary,
  useFollowsEnabled,
  useViewer,
  type FollowButtonState,
} from '@/components/follows/use-follows';
import { useBlocked } from '@/state/blocked';
import { useSession } from '@/state/session';
import { publicSupabase, supabase } from '@/supabase/client';
import { composerCases } from '@/components/bento/cases';
import { redirectPath, resolvePseudoQueryOptions } from '@/lib/pseudo-redirect';
import { accountBentosQueryOptions } from '@/lib/account-bentos';
import { bentoRoute } from '@/lib/bento-address';
import { accountBentoTitle, type FeedBento } from '@/lib/feed';
import { FeedPost } from '@/components/feed/FeedPost';
import { WhySection } from '@/components/whys/WhySection';
import { PencilIcon } from '@/components/TabIcons';
import { feedBoxWidth, feedScale, feedSideInset } from '@/components/feed/layout';

/** En route, `/u/<pseudo>`, ou dans l'onglet Profil pour son propre compte. */
type AccountMode = 'route' | 'tab';

/**
 * Page publique d'un compte, `/u/<pseudo>`, et d'un bento nommé,
 * `/u/<pseudo>/<slug>` : cible des liens de partage et, depuis le chantier 6,
 * de toute la recherche. Lecture seule.
 *
 * Les deux routes rendent ce même écran. Sans `slug`, le contenu principal est
 * le bento principal du compte, et ses autres bentos sont listés dessous : les
 * liens déjà partagés gardent donc leur contenu (chantier 16, D5).
 *
 * Cet écran ne décide rien, il rend. La géométrie vient de
 * `public-layout.ts`, les données de `public-bento.ts` par
 * `public-bento-query.ts`, et l'état à montrer de `public-page-state.ts` :
 * trois modules purs, testés sans appareil. Cf.
 * `docs/UX-07-PAGE-BENTO-PUBLIQUE-MOBILE.md`.
 *
 * Depuis le chantier 21, c'est le profil du compte (D1) : sous la boîte, en
 * faisant défiler, ses autres bentos. Et l'onglet Profil rend ce même écran
 * pour son propre compte (D3), cf. `AccountScreen`.
 *
 * Tous ses textes appliquent eux-mêmes la taille système, plafonnée, cf.
 * `fontScaleFor`. Ceux de la barre du haut et des états la laissaient à
 * `maxFontSizeMultiplier` : une taille agrandie écran ouvert les gardait à
 * leur ancienne largeur, sur iOS, « Options » coupé en « OPTI… » et
 * « Mêmes goûts » en « MÊMES GOÛ… » (recette du lot 3 du chantier 21).
 */
export default function PublicBentoRoute() {
  const { pseudo: rawPseudo, slug: rawSlug } = useLocalSearchParams<{
    pseudo: string;
    slug?: string;
  }>();
  // `undefined` sur `/u/<pseudo>` : c'est la page du compte, pas celle d'un
  // bento nommé, et les deux ont leur propre entrée de cache.
  return <AccountScreen pseudo={rawPseudo ?? ''} slug={rawSlug ?? null} mode="route" />;
}

/**
 * La page d'un compte, en route, `/u/<pseudo>`, ou dans l'onglet Profil pour
 * son propre compte (chantier 21, D3). Dans l'onglet, la barre d'onglets prend
 * le bas de l'écran : le modèle d'échelle le compte, par `tabBarHeight`, et la
 * barre du haut mène aux réglages plutôt qu'en arrière.
 */
export function AccountScreen({
  pseudo,
  slug,
  mode,
  tabBarHeight = 0,
}: {
  pseudo: string;
  slug: string | null;
  mode: AccountMode;
  tabBarHeight?: number;
}) {
  const ownPseudo = useSession((s) => s.profile?.pseudo);
  const isOffline = useIsOffline();

  // Client sans session : la page ne doit jamais attendre l'authentification,
  // cf. `supabase/public-reads.ts`.
  const { data, isError, isFetching, refetch } = useQuery(
    publicBentoQueryOptions(publicSupabase, pseudo, slug),
  );
  const state = publicPageState({ ownPseudo, data, isError, isFetching, isOffline });

  // Chantier 8 : chaque affichage d'un bento trouvé compte une visite, par le
  // client avec session, le seul qui laisse la base reconnaître le
  // propriétaire, pour qui elle ne compte rien. Une requête à part : le
  // compteur n'attend jamais la page, et la page ne l'attend pas.
  const { data: visits } = useQuery({
    ...bentoVisitsQueryOptions(supabase, state.kind === 'found' ? state.bento.id : '', 'visit'),
    enabled: state.kind === 'found',
  });

  // Chantier 20 : les mêmes goûts, une requête à part elle aussi, par le client
  // sans session, les matchs étant les mêmes pour tous. La pastille n'apparaît
  // qu'avec leur réponse, dans la barre du haut, à hauteur fixe : rien ne bouge
  // dans la page (D10). Sans les comptes bloqués sur l'appareil (D13).
  const { data: matches } = useQuery({
    ...bentoMatchesQueryOptions(publicSupabase, state.kind === 'found' ? state.bento.id : ''),
    enabled: state.kind === 'found',
  });
  const blocked = useBlocked((s) => s.index);
  const matchCount = matches ? withoutBlocked(matches, blocked).length : 0;

  // De retour en ligne après un échec, la page se recharge d'elle-même : sans
  // ça, « Connexion perdue » resterait affiché une fois le bandeau hors ligne
  // disparu. Seulement au retour : relancer à chaque erreur doublerait les
  // tentatives et repousserait l'écran d'erreur au-delà de sa borne.
  const wasOffline = useRef(isOffline);
  useEffect(() => {
    const cameBackOnline = wasOffline.current && !isOffline;
    wasOffline.current = isOffline;
    if (cameBackOnline && isError) void refetch();
  }, [isOffline, isError, refetch]);

  // Chantier 21 (D6) : un pseudo introuvable a peut-être changé. La base dit
  // quel pseudo l'a remplacé, et l'adresse est remplacée, le bento nommé
  // compris. Le temps de la réponse, la page reste en chargement plutôt que de
  // dire « introuvable ».
  const redirect = useQuery({
    ...resolvePseudoQueryOptions(publicSupabase, pseudo),
    enabled: mode === 'route' && state.kind === 'not-found' && pseudo !== '',
  });
  const redirectTo = redirect.data ?? null;
  useEffect(() => {
    if (redirectTo) router.replace(redirectPath(redirectTo, slug));
  }, [redirectTo, slug]);
  const resolving =
    mode === 'route' &&
    state.kind === 'not-found' &&
    (redirect.fetchStatus === 'fetching' || redirectTo !== null);

  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Le bandeau hors ligne descend l'écran, et c'est justement dans l'état
  // « Connexion perdue » qu'il apparaît : le modèle le compte.
  const offlineInset = useOfflineInset();
  // La bande des autres bentos prend de la place au-dessus de la boîte : le
  // modèle la compte, sans quoi la boîte passerait sous le bloc de boutons.
  const otherBentos = state.kind === 'found' ? state.others.length : 0;
  // Dans l'onglet, la barre d'onglets prend le bas de l'écran, marge de
  // sécurité comprise : la page tient au-dessus d'elle.
  const scale = publicBentoScale({
    width,
    height: height - tabBarHeight,
    insetTop: insets.top + offlineInset,
    insetBottom: mode === 'tab' ? 0 : insets.bottom,
    fontScale,
    otherBentos,
  });
  const sideInset = publicSideInset(width, scale);

  return (
    <YellowBg>
      <SafeAreaView
        style={{ flex: 1 }}
        edges={mode === 'tab' ? ['top', 'left', 'right'] : undefined}
      >
        <TopBar
          mode={mode}
          // Le bento et non le seul pseudo : un signalement doit nommer ce
          // qui a été vu, et un compte peut en avoir plusieurs. Chantier 16.
          optionsFor={
            state.kind === 'found' && !state.isOwn
              ? { pseudo: state.bento.pseudo, bentoId: state.bento.id, userId: state.bento.userId }
              : null
          }
          matchesFor={
            state.kind === 'found' && matchCount > 0
              ? {
                  bentoId: state.bento.id,
                  pseudo: state.bento.pseudo,
                  count: matchCount,
                  isOwn: state.isOwn,
                }
              : null
          }
          // Arrivé par un lien partagé sur `/u/<pseudo>/<slug>`, il n'y a rien
          // derrière : « Retour » mène alors au compte, pas au composer, sinon
          // la page d'un bento nommé est un cul-de-sac.
          fallback={slug && pseudo ? (`/u/${pseudo}` as const) : '/(tabs)/compose'}
        />
        {state.kind === 'found' ? (
          <FoundPage
            bento={state.bento}
            others={state.others}
            visits={visits}
            isOwn={state.isOwn}
            scale={scale}
            sideInset={sideInset}
            boxWidth={width - sideInset * 2}
            fontScale={fontScale}
          />
        ) : state.kind === 'loading' || resolving ? (
          <LoadingPage pseudo={pseudo} scale={scale} sideInset={sideInset} />
        ) : state.kind === 'not-found' ? (
          <StateMessage
            title="Bento introuvable"
            body={
              slug
                ? `Aucun bento publié à l'adresse @${pseudo}/${slug}.`
                : `Aucun bento publié à l'adresse @${pseudo}. Il a peut-être été supprimé, ou le pseudo n'existe pas (encore).`
            }
          />
        ) : state.kind === 'nothing-online' ? (
          // Avec un slug, l'adresse nomme un bento précis : dire « ce compte
          // n'a rien en ligne » serait faux, il peut en avoir d'autres.
          slug ? (
            <StateMessage
              title="Bento introuvable"
              body={`@${state.pseudo} n'a pas de bento à l'adresse ${slug}.`}
              action={{
                label: 'Voir son bento',
                accessibilityLabel: `Voir le bento de @${state.pseudo}`,
                onPress: () => router.replace(`/u/${state.pseudo}` as const),
              }}
            />
          ) : state.isOwn ? (
            <StateMessage
              title="Rien en ligne"
              body="Ton bento n'est pas en ligne."
              action={{
                label: 'Reprendre mon bento',
                accessibilityLabel: 'Reprendre mon bento dans le composer',
                onPress: () => router.replace('/(tabs)/compose'),
              }}
            />
          ) : (
            <StateMessage
              title="Rien en ligne"
              body={`@${state.pseudo} n'a pas de bento en ligne.`}
            />
          )
        ) : (
          <StateMessage
            title="Connexion perdue"
            body={`Le bento de @${pseudo} n'a pas pu se charger.`}
            action={{
              label: 'Réessayer',
              accessibilityLabel: `Réessayer de charger le bento de @${pseudo}`,
              onPress: () => void refetch(),
            }}
          />
        )}
      </SafeAreaView>
    </YellowBg>
  );
}

/**
 * Les autres bentos publiés du compte, en bande horizontale sous l'en-tête.
 *
 * **Au-dessus de la boîte, et c'est une correction de recette.** Posée sous la
 * grille, la bande tombait exactement derrière le bloc de boutons : mesurée
 * invisible au repos sur iPhone 17 Pro, atteignable seulement en défilant, et
 * rien ne laissait deviner qu'il y avait quelque chose à aller chercher.
 *
 * Ne rend rien tant qu'il n'y en a qu'un, ce qui est le cas de tous les
 * comptes au 16 septembre 2026 : la page ne change donc pas d'un pixel tant
 * qu'un deuxième bento n'existe pas. C'est la promesse du §5.4 de la spéc, et
 * `publicOthersStripHeight` rend zéro dans ce cas.
 *
 * Le libellé est le titre de l'édition pour un bento d'édition, chantier 13,
 * et le slug tel quel pour un bento libre : c'est son adresse, et c'est tout
 * ce qu'il porte. Depuis le chantier 21, la bande résume la liste sous la
 * boîte : même ordre, mêmes titres, « Bento principal » compris, qui mène à
 * l'adresse du compte.
 */
function OtherBentos({
  pseudo,
  others,
  sideInset,
}: {
  pseudo: string;
  others: PublicBentoRef[];
  sideInset: number;
}) {
  const { fontScale } = useWindowDimensions();
  const scale = fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER);
  if (others.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: sideInset, gap: 8 }}
      style={{ marginBottom: OTHERS_GAP, flexGrow: 0 }}
    >
      {others.map((other) => (
        <Pressable
          key={other.id}
          onPress={() => router.push(bentoRoute(pseudo, other.slug, other.isPrimary))}
          accessibilityRole="button"
          accessibilityLabel={
            other.isPrimary
              ? `Voir le bento principal de @${pseudo}`
              : `Voir le bento ${accountBentoTitle(other)} de @${pseudo}`
          }
          style={[
            {
              height: OTHERS_CHIP_H * scale,
              justifyContent: 'center',
              backgroundColor: '#fbf3de',
              borderWidth: 2.5,
              borderColor: '#0a0a0a',
              borderRadius: 999,
              paddingHorizontal: 14,
            },
            SHADOWS.stamp,
          ]}
        >
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={{
              fontFamily: 'Bungee',
              fontSize: 12 * scale,
              lineHeight: 16 * scale,
              letterSpacing: 0.5,
              color: '#0a0a0a',
            }}
          >
            {accountBentoTitle(other)}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/**
 * Barre du haut, à hauteur fixe : « Options » apparaît quand le bento arrive
 * sans que rien ne bouge en dessous.
 */
function TopBar({
  mode,
  optionsFor,
  matchesFor,
  fallback,
}: {
  /** Dans l'onglet, « Réglages » à la place de « Retour » (chantier 21, D3). */
  mode: AccountMode;
  optionsFor: { pseudo: string; bentoId: string; userId: string | null } | null;
  /** La pastille des mêmes goûts, dès un match (chantier 20, D10). */
  matchesFor: { bentoId: string; pseudo: string; count: number; isOwn: boolean } | null;
  /** Où mener quand il n'y a pas d'écran précédent, cf. l'appelant. */
  fallback: '/(tabs)/compose' | `/u/${string}`;
}) {
  return (
    <View
      style={{
        height: TOP_BAR_H,
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: PUBLIC_TOP_BAR.paddingTop,
        alignItems: 'center',
      }}
    >
      {mode === 'tab' ? (
        <SettingsButton />
      ) : (
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
              width: PUBLIC_TOP_BAR.buttonSize,
              height: PUBLIC_TOP_BAR.buttonSize,
              alignItems: 'center',
              justifyContent: 'center',
            },
            SHADOWS.stamp,
          ]}
        >
          {/* Un glyphe dans une cible de 36 pt, pas un texte à lire : grossi, il sortait de sa pastille. */}
          <Text allowFontScaling={false} style={{ fontSize: 16, fontWeight: '800' }}>
            ‹
          </Text>
        </Pressable>
      )}
      {/* À droite, la pastille puis « Options », ou « Modifier le profil »
          dans l'onglet : un groupe, et non deux marges automatiques, qui se
          partageraient l'espace libre. */}
      <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center' }}>
        {matchesFor ? <MatchesPill {...matchesFor} /> : null}
        {mode === 'tab' ? (
          <EditProfileButton />
        ) : optionsFor ? (
          <BlockReportMenu
            pseudo={optionsFor.pseudo}
            bentoId={optionsFor.bentoId}
            userId={optionsFor.userId}
          />
        ) : null}
      </View>
    </View>
  );
}

/**
 * « Réglages », chantier 21 (D3) : dans l'onglet Profil, la page du compte
 * remplace l'ancien tableau de bord, et ses réglages ont leur écran. Même
 * dessin que « Options », un libellé et non une pastille : la barre garde sa
 * hauteur.
 */
export function SettingsButton() {
  const { fontScale } = useWindowDimensions();
  return (
    <Pressable
      onPress={() => router.push('/settings')}
      accessibilityRole="button"
      accessibilityLabel="Réglages"
      accessibilityHint="Ouvre les réglages de ton compte"
      // Le libellé fait 25 pt de haut : la cible tactile en fait 44.
      hitSlop={{ top: 10, bottom: 10 }}
      style={{ paddingRight: 12, paddingVertical: 6 }}
    >
      <Text
        numberOfLines={1}
        allowFontScaling={false}
        style={{
          fontFamily: 'Bungee',
          fontSize: 10 * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER),
          letterSpacing: 1.5,
          color: INK_MUTED,
          textTransform: 'uppercase',
        }}
      >
        Réglages
      </Text>
    </Pressable>
  );
}

/**
 * « Modifier le profil », chantier 21 (D3) : dans l'onglet, une pastille
 * comme « Retour », un crayon. Un libellé n'avait pas sa place : avec
 * « Réglages » et « Mêmes goûts », la barre aurait demandé 379 points pour
 * 370 ; sous l'identité, il aurait poussé la boîte, déjà à son plancher dans
 * l'onglet, de 44 points sous les boutons. La pastille est là dans tous les
 * états de la page, chargement et « Rien en ligne » compris.
 */
function EditProfileButton() {
  return (
    <Pressable
      onPress={() => router.push('/profile/edit')}
      accessibilityRole="button"
      accessibilityLabel="Modifier le profil"
      accessibilityHint="Ton nom, ton pseudo et ton Popy"
      // La pastille fait 36 pt : la cible tactile en fait 44.
      hitSlop={4}
      style={[
        {
          marginLeft: 10,
          backgroundColor: '#ffffff',
          borderWidth: 2.5,
          borderColor: '#0a0a0a',
          borderRadius: 999,
          width: PUBLIC_TOP_BAR.buttonSize,
          height: PUBLIC_TOP_BAR.buttonSize,
          alignItems: 'center',
          justifyContent: 'center',
        },
        SHADOWS.stamp,
      ]}
    >
      <PencilIcon size={18} />
    </Pressable>
  );
}

/**
 * « Mêmes goûts · 3 », chantier 20 (D10) : la porte de l'écran des matchs.
 * Plus basse que la pastille « Retour », elle tient dans la barre à hauteur
 * fixe, et le texte plafonné de même : la page ne bouge pas quand elle arrive.
 */
function MatchesPill({
  bentoId,
  pseudo,
  count,
  isOwn,
}: {
  bentoId: string;
  pseudo: string;
  count: number;
  isOwn: boolean;
}) {
  const { fontScale } = useWindowDimensions();
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/matches/[bentoId]',
          params: { bentoId, pseudo, own: isOwn ? '1' : '0' },
        })
      }
      accessibilityRole="button"
      accessibilityLabel={matchesPillAccessibilityLabel(count, isOwn)}
      accessibilityHint="Ouvre la liste des bentos qui lui ressemblent"
      // La pastille fait 30 pt de haut : la cible tactile en fait 44.
      hitSlop={{ top: 7, bottom: 7 }}
      style={[
        {
          height: 30,
          justifyContent: 'center',
          backgroundColor: '#fbf3de',
          borderWidth: 2,
          borderColor: '#0a0a0a',
          borderRadius: 999,
          paddingHorizontal: 12,
        },
        SHADOWS.stamp,
      ]}
    >
      <Text
        numberOfLines={1}
        allowFontScaling={false}
        style={{
          fontFamily: 'Bungee',
          fontSize: 10 * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER),
          letterSpacing: 1,
          color: '#0a0a0a',
          textTransform: 'uppercase',
          includeFontPadding: false,
        }}
      >
        {matchesPillLabel(count)}
      </Text>
    </Pressable>
  );
}

type Pastille = 'guest' | 'featured' | null;

/**
 * Avatar, pseudo et ligne de date. Ses cotes et ses hauteurs de ligne viennent
 * du modèle : c'est ce qui garantit que l'échelle calculée correspond à ce qui
 * est rendu.
 *
 * Le modèle compte une ligne pour le pseudo et une pour la date : les deux
 * restent sur une ligne, quitte à rétrécir. Sans ça, `@bento_pop_culture`
 * passait sur quatre lignes à la plus grande police, coupé au milieu. Pas de
 * `minimumFontScale` : React Native 0.86 le lit sans l'appliquer, la police
 * rétrécit donc autant qu'il le faut pour tenir.
 *
 * `dateLine` nul pendant le chargement : la ligne garde sa hauteur exacte, en
 * os, pour que la boîte n'ait pas à bouger quand la date arrive.
 *
 * Depuis le chantier 23 (D2), les nombres d'abonnés suivent la date sur la
 * même ligne, soulignés, et la ligne entière ouvre les listes : aucune ligne
 * de plus, la boîte du 17 Pro n'ayant que 3 pt de marge.
 */
function ProfileHeader({
  pseudo,
  avatarKey,
  pastille,
  dateLine,
  dateSegment = null,
  dateAccessibilityLabel,
  dateAccessibilityHint,
  onDatePress,
  actionsFor,
  socials = [],
}: {
  pseudo: string;
  /**
   * Les réseaux du chantier 25 qu'il montre, au bout de la ligne de date (D2).
   * Vide, la ligne ne change pas d'un pixel (D11).
   */
  socials?: readonly { network: SocialNetworkName; handle: string }[];
  /** Les nombres du chantier 23, après la date. `null` sans abonné ni abonnement. */
  dateSegment?: string | null;
  dateAccessibilityLabel?: string;
  dateAccessibilityHint?: string;
  /** Ouvre les listes ; absent sans nombre, la ligne restant un texte. */
  onDatePress?: () => void;
  /**
   * Le cœur et la bulle du bento, de part et d'autre du Popy (chantier 22).
   * Absents de l'os de chargement.
   */
  actionsFor?: { bentoId: string; ownerId: string | null };
  /**
   * Le Popy choisi, `null` pour celui du pseudo (chantier 21, D7). Inconnu
   * pendant le chargement : l'os montre alors celui du pseudo, le Popy de
   * presque tous les comptes.
   */
  avatarKey: string | null;
  pastille: Pastille;
  dateLine: string | null;
}) {
  const popy = popyFor(pseudo, avatarKey);
  const avatar = PUBLIC_HEADER.avatarSize;
  // Taille et hauteur de ligne appliquées par l'écran, au plafond du modèle :
  // `maxFontSizeMultiplier` ne plafonne pas la hauteur de ligne sur Android,
  // cf. `fontScaleFor`.
  const { fontScale } = useWindowDimensions();
  const textScale = fontScaleFor(fontScale, CONTENT_MAX_FONT_MULTIPLIER);
  const dateStyle = {
    fontSize: 13 * textScale,
    lineHeight: DATE_LINE_H * textScale,
    marginTop: PUBLIC_HEADER.dateMarginTop,
  } as const;
  // Un seul texte, qui rétrécit en bloc s'il ne tient pas : le modèle de
  // `public-layout.ts` ne compte qu'une ligne. Les nombres du 23 y sont une
  // part soulignée, qui hérite de sa taille.
  const dateText = (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      allowFontScaling={false}
      style={[dateStyle, { color: 'rgba(10,10,10,0.65)', flexShrink: 1 }]}
    >
      {dateLine}
      {dateSegment ? (
        <>
          {' · '}
          <Text allowFontScaling={false} style={{ color: '#0a0a0a', textDecorationLine: 'underline' }}>
            {dateSegment}
          </Text>
        </>
      ) : null}
    </Text>
  );

  return (
    <View
      style={{
        alignItems: 'center',
        paddingTop: PUBLIC_HEADER.paddingTop,
        paddingBottom: PUBLIC_HEADER.paddingBottom,
        paddingHorizontal: 16,
      }}
    >
      <View style={{ position: 'relative' }}>
        <View
          style={[
            {
              width: avatar,
              height: avatar,
              borderRadius: avatar / 2,
              backgroundColor: '#ffffff',
              borderWidth: 3,
              borderColor: '#0a0a0a',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            },
            SHADOWS.stamp,
          ]}
        >
          <Image source={popy.source} style={{ width: 64, height: 64 }} resizeMode="contain" />
        </View>
        {pastille ? <PastilleBadge kind={pastille} /> : null}
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        allowFontScaling={false}
        style={{
          fontFamily: 'Extenda',
          fontSize: 24 * textScale,
          lineHeight: PSEUDO_LINE_H * textScale,
          letterSpacing: 1,
          marginTop: PUBLIC_HEADER.pseudoMarginTop,
          textTransform: 'uppercase',
        }}
      >
        @{pseudo}
      </Text>
      {dateLine === null ? (
        // L'os prend la hauteur d'une vraie ligne de date, taille de police
        // comprise, parce que le texte y est rendu, à opacité nulle. Pas de
        // `color: 'transparent'` : Android l'ignore et affichait la date factice.
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            marginTop: PUBLIC_HEADER.dateMarginTop,
            backgroundColor: SKELETON_BONE,
            borderRadius: 4,
          }}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            allowFontScaling={false}
            style={{ fontSize: dateStyle.fontSize, lineHeight: dateStyle.lineHeight, opacity: 0 }}
          >
            bento publié le 00 septembre 0000
          </Text>
        </View>
      ) : socials.length > 0 ? (
        // Les glyphes du 25 au bout de la ligne : la date rétrécit pour leur
        // laisser la place, la ligne ne grandit pas (D2, D20).
        <View style={{ flexDirection: 'row', alignItems: 'center', maxWidth: '100%' }}>
          {onDatePress ? (
            <Pressable
              onPress={onDatePress}
              accessibilityRole="button"
              accessibilityLabel={dateAccessibilityLabel}
              accessibilityHint={dateAccessibilityHint}
              hitSlop={{ top: 14, bottom: 14 }}
              style={{ flexShrink: 1 }}
            >
              {dateText}
            </Pressable>
          ) : (
            dateText
          )}
          {socials.map(({ network, handle }) => (
            <SocialGlyph
              key={network}
              network={network}
              handle={handle}
              owner={pseudo}
              size={dateStyle.lineHeight}
              marginTop={dateStyle.marginTop}
            />
          ))}
        </View>
      ) : onDatePress ? (
        <Pressable
          onPress={onDatePress}
          accessibilityRole="button"
          accessibilityLabel={dateAccessibilityLabel}
          accessibilityHint={dateAccessibilityHint}
          // La ligne fait 16 pt de haut : la cible tactile en fait 44.
          hitSlop={{ top: 14, bottom: 14 }}
        >
          {dateText}
        </Pressable>
      ) : (
        dateText
      )}
      {actionsFor ? (
        <HeaderActions
          bentoId={actionsFor.bentoId}
          ownerId={actionsFor.ownerId}
          bandTop={PUBLIC_HEADER.paddingTop}
          bandHeight={PUBLIC_HEADER.avatarSize}
        />
      ) : null}
    </View>
  );
}

/**
 * Un réseau du chantier 25, au bout de la ligne de date : un glyphe au trait,
 * à l'encre, de la hauteur de la ligne (D20), qui ouvre le profil sur le
 * réseau (D5). Le lecteur d'écran le lit en lien, réseau, compte et pseudo
 * (D12).
 */
function SocialGlyph({
  network,
  handle,
  owner,
  size,
  marginTop,
}: {
  network: SocialNetworkName;
  handle: string;
  owner: string;
  size: number;
  marginTop: number;
}) {
  const ink = '#0a0a0a';
  return (
    <Pressable
      onPress={() => void Linking.openURL(socialProfileUrl(network, handle))}
      accessibilityRole="link"
      accessibilityLabel={socialLinkLabel(network, owner, handle)}
      accessibilityHint={socialLinkHint(network)}
      // Le glyphe fait la hauteur de la ligne : la cible tactile en fait 44.
      hitSlop={{ top: 14, bottom: 14, left: 6, right: 6 }}
      style={{ marginLeft: 8, marginTop }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {network === 'instagram' ? (
          <>
            <Rect x="3" y="3" width="18" height="18" rx="5" stroke={ink} strokeWidth={2.2} fill="none" />
            <Circle cx="12" cy="12" r="4.2" stroke={ink} strokeWidth={2.2} fill="none" />
            <Circle cx="17.3" cy="6.7" r="1.3" fill={ink} />
          </>
        ) : (
          <Path
            d="M13.5 3 L13.5 15.2 C 13.5 17.6, 11.6 19.5, 9.2 19.5 C 6.8 19.5, 4.9 17.6, 4.9 15.2 C 4.9 12.8, 6.8 10.9, 9.2 10.9 M13.5 3 C 14.2 5.9, 16.4 7.9, 19.3 8.2"
            stroke={ink}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}
      </Svg>
    </Pressable>
  );
}

/**
 * Une seule pastille, et « invité » l'emporte : c'est le même arbitrage que
 * l'étiquette du fil, cf. `components/feed/ribbon.ts`. Sans elle, cet écran
 * attribue à une personne réelle une composition qu'elle n'a pas faite.
 */
function PastilleBadge({ kind }: { kind: 'guest' | 'featured' }) {
  const isGuest = kind === 'guest';
  return (
    <View
      style={{
        position: 'absolute',
        bottom: -4,
        right: -4,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: isGuest ? '#0a0a0a' : '#e63946',
        borderWidth: 2.5,
        borderColor: '#0a0a0a',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessible
      accessibilityLabel={
        isGuest ? "Bento invité, composé par l'équipe" : "Coup de cœur de l'équipe"
      }
    >
      {/* Un glyphe dans une pastille de 26 pt : à taille fixe, comme le chevron. */}
      <Text
        allowFontScaling={false}
        style={{
          color: isGuest ? '#fbbf24' : '#ffffff',
          fontSize: 14,
          lineHeight: 16,
          fontWeight: '800',
        }}
      >
        {isGuest ? '◆' : '★'}
      </Text>
    </View>
  );
}

/**
 * Le squelette tient la place exacte de la page à venir : même en-tête, même
 * boîte. L'arrivée des données est un remplissage, pas un changement d'écran.
 */
function LoadingPage({
  pseudo,
  scale,
  sideInset,
}: {
  pseudo: string;
  scale: number;
  sideInset: number;
}) {
  return (
    <View style={{ flex: 1 }} accessible accessibilityLabel={`Chargement du bento de @${pseudo}`}>
      <ProfileHeader pseudo={pseudo} avatarKey={null} pastille={null} dateLine={null} />
      <View style={{ marginHorizontal: sideInset }}>
        <BentoBoxSkeleton scale={scale} />
      </View>
    </View>
  );
}

function FoundPage({
  bento,
  others,
  visits,
  isOwn,
  scale,
  sideInset,
  boxWidth,
  fontScale,
}: {
  bento: PublicBento;
  /** Les autres bentos publiés du compte. Vide tant qu'il n'en a qu'un. */
  others: PublicBentoRef[];
  /**
   * Le compteur de visites, après la date (chantier 8). `null` quand son
   * propriétaire le masque, `undefined` tant que la base n'a pas répondu.
   */
  visits: number | null | undefined;
  isOwn: boolean;
  scale: number;
  sideInset: number;
  /** Largeur de la boîte entre ses deux marges, cf. `BentoGrid.width`. */
  boxWidth: number;
  fontScale: number;
}) {
  const shareImageRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  // Chantier 21 (D1, D2, D11) : ses autres bentos, sous la boîte, en entier.
  // Par le client sans session, comme la page, et à part d'elle : le premier
  // écran ne les attend jamais. Une page de plus quand on approche du bas.
  const accountBentos = useInfiniteQuery(
    accountBentosQueryOptions(publicSupabase, bento.userId ?? '', {
      id: bento.id,
      isPrimary: bento.isPrimary,
    }),
  );
  const listed = useMemo(
    () => (accountBentos.data?.pages ?? []).flatMap((page) => page.bentos),
    [accountBentos.data],
  );
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = accountBentos;
  const onScroll = useCallback(
    ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!hasNextPage || isFetchingNextPage) return;
      const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
      if (layoutMeasurement.height + contentOffset.y >= contentSize.height - LIST_NEAR_END) {
        void fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  const onShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const imageUrls = Object.values(bento.slots)
        .map((s) => s?.imageUrl)
        .filter((u): u is string => Boolean(u));
      const outcome = await shareBentoImage(
        bento.pseudo,
        shareImageRef,
        imageUrls,
        bento.slug,
        bento.isPrimary,
      );
      if (outcome === 'copied') {
        Alert.alert('Lien copié', 'Tu peux le coller où tu veux.');
      } else if (outcome === 'unsupported') {
        Alert.alert('Oups', 'Partage non supporté sur ce navigateur.');
      }
    } finally {
      setSharing(false);
    }
  };

  // Le titre de l'édition passe devant la date : sans lui, on ne comprend
  // pas pourquoi cette boîte n'a pas les cases du bento principal. Le bento
  // principal garde sa phrase d'origine, sans virgule : la recette du
  // chantier 13 a relevé « bento, publié le », régression du lot 5. Les
  // visites (8), puis les nombres du 23 (D2), sur la même ligne, comme sur le
  // web : le modèle de `public-layout.ts` ne compte qu'une ligne.
  const followsOn = useFollowsEnabled();
  const { hasProfile } = useViewer();
  const { data: summary } = useFollowSummary(bento.userId);
  const line = profileDateLine({
    displayName: bento.displayName,
    editionTitle: bento.editionTitle,
    publishedAt: bento.publishedAt,
    visits,
    segment: followsOn ? followSegment(summary) : null,
  });
  const ownerId = bento.userId;
  const openLists =
    line.segment && ownerId
      ? () =>
          router.push({
            pathname: '/follows/[userId]',
            params: { userId: ownerId, pseudo: bento.pseudo },
          })
      : undefined;

  // D5 : « Suivre » à la place de « Compose le tien », pour qui a un profil.
  // Rien quand la base a coupé les abonnements, qui rend alors `null`.
  const follow = useFollowButton(ownerId ?? '', bento.pseudo);
  const showFollow = followsOn && !isOwn && hasProfile && ownerId !== null && summary !== null;

  // Chantier 25 (D2, D3) : ses réseaux, s'il les montre.
  const socialOn = useSocialLinksEnabled();
  const { data: links } = useSocialLinks(ownerId);
  const socials = socialOn ? shownNetworks(links ?? null) : [];

  return (
    <View style={{ flex: 1 }}>
      {/*
        Un filet, pas un mode de lecture : partout où le plancher d'échelle ne
        mord pas, le contenu tient et rien ne défile. `alwaysBounceVertical`
        désactivé pour que la page ne rebondisse pas quand elle tient.
      */}
      <ScrollView
        alwaysBounceVertical={false}
        contentContainerStyle={{ paddingBottom: publicScrollBottomInset(fontScale) }}
        onScroll={onScroll}
        scrollEventThrottle={200}
      >
        <ProfileHeader
          pseudo={bento.pseudo}
          avatarKey={bento.avatar}
          pastille={bento.isGuest ? 'guest' : bento.isFeatured ? 'featured' : null}
          dateLine={line.head}
          dateSegment={line.segment}
          dateAccessibilityLabel={line.accessibilityLabel}
          dateAccessibilityHint={
            isOwn ? 'Ouvre tes abonnés et tes abonnements' : 'Ouvre ses abonnés et ses abonnements'
          }
          onDatePress={openLists}
          actionsFor={{ bentoId: bento.id, ownerId: bento.userId }}
          socials={socials}
        />
        <OtherBentos pseudo={bento.pseudo} others={others} sideInset={sideInset} />
        {/* Marge et non largeur, cf. `publicSideInset`. */}
        <View style={{ marginHorizontal: sideInset }}>
          <BentoGrid
            cases={composerCases(bento.cases, bento.slots)}
            scale={scale}
            width={boxWidth}
            readOnly
          />
        </View>
        {/* Chantier 12 (D1) : sous la boîte, que le budget garde entière. */}
        <WhySection
          bentoId={bento.id}
          pseudo={bento.pseudo}
          slug={bento.isPrimary ? null : bento.slug}
          cases={bento.cases}
          slots={bento.slots}
          whys={bento.whys}
          isOwn={isOwn}
          sideInset={sideInset}
        />
        <AccountBentoList bentos={listed} isOwn={isOwn} />
      </ScrollView>

      <CtaBar
        isOwn={isOwn}
        sharing={sharing}
        onShare={onShare}
        fontScale={fontScale}
        follow={showFollow ? follow : null}
      />
      <ActionSheet {...follow.sheet} />

      {/*
        ShareImage rendue HORS de la zone visible via `translateX`, pas via
        `opacity: 0` (iOS optimise les vues transparentes et skip le rendu des
        <Text> à police custom — pseudo manquait dans le PNG). Avec un
        transform, la vue est pleinement rendue, juste positionnée à 3000pt à
        droite. Dimensions explicites 1080×1920 (format Story).

        Sœur du `ScrollView` et non enfant : absolue mais dimensionnée, elle
        n'a rien à faire dans un conteneur défilant.
      */}
      <View
        pointerEvents="none"
        collapsable={false}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 1080,
          height: 1920,
          transform: [{ translateX: 3000 }],
        }}
      >
        <ShareImage
          ref={shareImageRef}
          items={bento.slots}
          cases={bento.cases}
          pseudo={bento.pseudo}
          slug={bento.slug}
          isPrimary={bento.isPrimary}
          editionTitle={bento.editionTitle}
        />
      </View>
    </View>
  );
}

/** À cette distance du bas, la page suivante de la liste se charge. */
const LIST_NEAR_END = 600;

/** L'écart entre la boîte de la page et le titre de la liste. */
const LIST_GAP = 48;

/**
 * Les autres bentos du compte, sous la boîte de sa page (chantier 21, D1, D2).
 * Chacun en entier, comme dans « La table », sous une étiquette qui dit son
 * édition ou son adresse plutôt que son auteur, déjà en tête de page. Rien
 * tant que le compte n'a qu'un bento : la page ne change pas d'un point.
 */
function AccountBentoList({ bentos, isOwn }: { bentos: readonly FeedBento[]; isOwn: boolean }) {
  const { width, fontScale } = useWindowDimensions();
  if (bentos.length === 0) return null;
  const sideInset = feedSideInset(width);
  return (
    <View style={{ marginTop: LIST_GAP }}>
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        allowFontScaling={false}
        style={{
          marginHorizontal: sideInset,
          marginBottom: 16,
          fontFamily: 'Bungee',
          fontSize: 10 * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER),
          letterSpacing: 2,
          color: INK_MUTED,
          textTransform: 'uppercase',
        }}
      >
        {isOwn ? 'Tes autres bentos' : 'Ses autres bentos'}
      </Text>
      {bentos.map((other) => (
        <FeedPost
          key={other.bentoId}
          bento={other}
          width={feedBoxWidth(width)}
          sideInset={sideInset}
          scale={feedScale(width)}
          labelFor="bento"
          onPress={() => router.push(bentoRoute(other.pseudo, other.slug, other.isPrimary))}
        />
      ))}
    </View>
  );
}

/**
 * Boutons collants. Leurs cotes viennent du modèle, qui réserve leur hauteur
 * sous la boîte.
 *
 * Les libellés plafonnent à 1,2 et restent sur une ligne, quitte à rétrécir :
 * sans plafond, à la plus grande police, la rangée montait jusqu'à recouvrir
 * l'écran entier.
 */
function CtaBar({
  isOwn,
  sharing,
  onShare,
  fontScale,
  follow,
}: {
  isOwn: boolean;
  sharing: boolean;
  onShare: () => void;
  fontScale: number;
  /**
   * Chantier 23 (D5) : « Suivre », « Abonné » ou « Demandé » à la place de
   * « Compose le tien », pour qui a un profil. Même bouton, même place : la
   * barre ne bouge pas d'un point.
   */
  follow: FollowButtonState | null;
}) {
  // Appliquée par l'écran, comme l'en-tête : cf. `fontScaleFor`.
  const textScale = fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER);
  const label = {
    fontFamily: 'Bungee',
    fontSize: 13 * textScale,
    lineHeight: CTA_LABEL_LINE_H * textScale,
    letterSpacing: 1,
    textTransform: 'uppercase',
  } as const;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(251,191,36,0)', '#fbbf24']}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={{
          flexDirection: 'row',
          padding: PUBLIC_CTA.padding,
          paddingBottom: PUBLIC_CTA.paddingBottom,
          gap: 8,
        }}
      >
        <Pressable
          onPress={follow && !isOwn ? follow.onPress : () => router.replace('/(tabs)/compose')}
          accessibilityRole="button"
          accessibilityLabel={
            follow && !isOwn
              ? follow.model.accessibilityLabel
              : isOwn
                ? 'Modifier mon bento'
                : 'Compose le tien'
          }
          accessibilityHint={follow && !isOwn ? follow.model.accessibilityHint : undefined}
          accessibilityState={follow && !isOwn ? { busy: follow.busy } : undefined}
          style={[
            {
              flex: 1,
              backgroundColor: '#ffffff',
              borderWidth: PUBLIC_CTA.borderWidth,
              borderColor: '#0a0a0a',
              borderRadius: 999,
              paddingVertical: PUBLIC_CTA.paddingVertical,
              paddingHorizontal: 16,
              alignItems: 'center',
            },
            SHADOWS.stamp,
          ]}
        >
          <Text numberOfLines={1} adjustsFontSizeToFit allowFontScaling={false} style={label}>
            {follow && !isOwn ? follow.model.label : isOwn ? 'Modifier' : 'Compose le tien'}
          </Text>
        </Pressable>
        <Pressable
          disabled={sharing}
          accessibilityRole="button"
          accessibilityLabel={sharing ? "Génération de l'image en cours" : 'Partager le bento'}
          accessibilityState={{ disabled: sharing, busy: sharing }}
          onPress={onShare}
          style={[
            {
              backgroundColor: '#0a0a0a',
              borderWidth: PUBLIC_CTA.borderWidth,
              borderColor: '#0a0a0a',
              borderRadius: 999,
              paddingVertical: PUBLIC_CTA.paddingVertical,
              paddingHorizontal: 22,
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 120,
              opacity: sharing ? 0.7 : 1,
            },
            SHADOWS.stamp,
          ]}
        >
          {/*
            L'indicateur tient dans la hauteur du libellé : plus haut de 3 pt, il
            faisait grandir le bouton, donc monter tout le bloc, le temps du
            partage. Hauteur plafonnée comme le texte : à 17 pt fixes, le
            libellé n'y tenait plus dès que la police grossissait.
          */}
          <View style={{ height: publicCtaLabelHeight(fontScale), justifyContent: 'center' }}>
            {sharing ? (
              <ActivityIndicator size="small" color="#fbbf24" />
            ) : (
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                allowFontScaling={false}
                style={[label, { color: '#fbbf24' }]}
              >
                Partager
              </Text>
            )}
          </View>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Titre, phrase et, au besoin, un bouton : la forme commune des états sans
 * bento.
 *
 * Le titre tient en deux lignes et rétrécit plutôt que de couper un mot : en
 * Extenda 36, « CONNEXION » est à la limite de la largeur d'un écran étroit
 * dès qu'il grossit. Sur Android, la coupure simple est ce qui déclenche ce
 * rétrécissement : sinon le mot s'y coupe au milieu, et le titre, tenant
 * encore en deux lignes, ne rétrécit pas.
 */
function StateMessage({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; accessibilityLabel: string; onPress: () => void };
}) {
  const { fontScale } = useWindowDimensions();
  const bodyScale = fontScaleFor(fontScale, CONTENT_MAX_FONT_MULTIPLIER);
  return (
    <View
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}
    >
      <Text
        numberOfLines={2}
        adjustsFontSizeToFit
        textBreakStrategy="simple"
        allowFontScaling={false}
        style={{
          fontFamily: 'Extenda',
          fontSize: 36 * bodyScale,
          textAlign: 'center',
          letterSpacing: 1,
        }}
      >
        {title}
      </Text>
      <Text
        // Hauteur de ligne comprise : appliquée par l'écran, cf. `fontScaleFor`.
        allowFontScaling={false}
        style={{
          marginTop: 12,
          fontSize: 15 * bodyScale,
          color: 'rgba(10,10,10,0.7)',
          textAlign: 'center',
          lineHeight: 21 * bodyScale,
        }}
      >
        {body}
      </Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel}
          style={{
            marginTop: 20,
            backgroundColor: '#0a0a0a',
            borderRadius: 999,
            paddingVertical: 10,
            paddingHorizontal: 20,
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
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}


/**
 * Menu d'actions modération sur le bento d'autrui : signaler le bento ou son
 * compte, bloquer ou débloquer.
 *
 * Depuis le chantier 22, signaler ouvre l'écran « Signaler », avec un motif
 * (D10), et le blocage s'écrit aussi en base (D9). Une feuille plutôt qu'une
 * alerte système : avec « Signaler @pseudo », il y a quatre choix, et Android
 * n'en affiche que trois.
 */
function BlockReportMenu({
  pseudo,
  bentoId,
  userId,
}: {
  pseudo: string;
  bentoId: string;
  /** Le compte bloqué, retenu avec son pseudo (chantier 21, D8). */
  userId: string | null;
}) {
  const { fontScale } = useWindowDimensions();
  const isBlocked = useBlocked((s) => s.isBlocked({ userId, pseudo }));
  const block = useBlocked((s) => s.block);
  const unblock = useBlocked((s) => s.unblock);
  const showToast = useToast((s) => s.show);
  const [open, setOpen] = useState(false);

  const confirmBlock = () =>
    // Le menu qui débloque vit sur cette page, que le fil et la recherche ne
    // montrent plus une fois le blocage posé : la liste du profil est
    // désormais le chemin de retour, et la phrase le dit.
    Alert.alert(
      'Bloquer cet utilisateur ?',
      'Tu ne verras plus son bento dans La table ni dans la recherche. Il ne pourra plus commenter ni aimer tes bentos, et vous ne vous suivrez plus. Tu peux le débloquer depuis tes réglages.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Bloquer',
          style: 'destructive',
          onPress: () => {
            void block({ userId, pseudo });
            showToast(`@${pseudo} est bloqué. Débloque-le depuis tes réglages.`, {
              variant: 'neutral',
              durationMs: 5000,
            });
            // On quitte la page du compte bloqué : y rester montrerait
            // justement le bento qu'on vient de masquer.
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/table');
          },
        },
      ],
    );

  const actions: SheetAction[] = [
    {
      label: 'Signaler ce bento',
      onPress: () =>
        router.push({ pathname: '/report', params: { kind: 'bento', id: bentoId, pseudo } }),
    },
  ];
  if (userId) {
    actions.push({
      label: `Signaler @${pseudo}`,
      onPress: () =>
        router.push({ pathname: '/report', params: { kind: 'account', id: userId, pseudo } }),
    });
  }
  actions.push(
    isBlocked
      ? {
          label: `Débloquer @${pseudo}`,
          onPress: () => {
            void unblock({ userId, pseudo });
            showToast(`@${pseudo} débloqué`, { variant: 'neutral' });
          },
        }
      : { label: `Bloquer @${pseudo}`, destructive: true, onPress: confirmBlock },
  );
  const onPress = () => setOpen(true);

  return (
    <>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Options pour @${pseudo}`}
        accessibilityHint="Ouvre les options de signalement et blocage"
        // Le libellé fait 25 pt de haut : la cible tactile en fait 44.
        hitSlop={{ top: 10, bottom: 10 }}
        style={{ marginLeft: 'auto', paddingHorizontal: 12, paddingVertical: 6 }}
      >
        <Text
          numberOfLines={1}
          allowFontScaling={false}
          style={{
            fontFamily: 'Bungee',
            fontSize: 10 * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER),
            letterSpacing: 1.5,
            color: INK_MUTED,
            textTransform: 'uppercase',
          }}
        >
          Options
        </Text>
      </Pressable>
      <ActionSheet
        visible={open}
        title={`Options pour @${pseudo}`}
        actions={actions}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
