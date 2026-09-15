import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { BentoBoxSkeleton, BentoGrid, SKELETON_BONE, ShareImage } from '@/components/bento';
import { fontScaleFor } from '@/components/bento/font-scaling';
import {
  BUTTON_MAX_FONT_MULTIPLIER,
  CONTENT_MAX_FONT_MULTIPLIER,
  CTA_LABEL_LINE_H,
  DATE_LINE_H,
  PSEUDO_LINE_H,
  PUBLIC_CTA,
  PUBLIC_HEADER,
  PUBLIC_TOP_BAR,
  TOP_BAR_H,
  publicBentoScale,
  publicCtaLabelHeight,
  publicScrollBottomInset,
  publicSideInset,
} from '@/components/bento/public-layout';
import { SHADOWS, YellowBg } from '@/components/primitives';
import { popyForPseudo } from '@/lib/popy-avatar';
import type { PublicBento } from '@/lib/public-bento';
import { publicBentoQueryOptions } from '@/lib/public-bento-query';
import { publicPageState } from '@/lib/public-page-state';
import { submitReport } from '@/lib/report';
import { shareBentoImage } from '@/lib/share-image';
import { useIsOffline } from '@/lib/use-is-offline';
import { useBlocked } from '@/state/blocked';
import { useSession } from '@/state/session';
import { publicSupabase } from '@/supabase/client';

/**
 * Bento public à l'adresse `/u/<pseudo>` : cible des liens de partage et,
 * depuis le chantier 6, de toute la recherche. Lecture seule.
 *
 * Cet écran ne décide rien, il rend. La géométrie vient de
 * `public-layout.ts`, les données de `public-bento.ts` par
 * `public-bento-query.ts`, et l'état à montrer de `public-page-state.ts` :
 * trois modules purs, testés sans appareil. Cf.
 * `docs/UX-07-PAGE-BENTO-PUBLIQUE-MOBILE.md`.
 */
export default function PublicBentoScreen() {
  const { pseudo: rawPseudo } = useLocalSearchParams<{ pseudo: string }>();
  const pseudo = rawPseudo ?? '';
  const ownPseudo = useSession((s) => s.profile?.pseudo);
  const isOffline = useIsOffline();

  // Client sans session : la page ne doit jamais attendre l'authentification,
  // cf. `supabase/public-reads.ts`.
  const { data, isError, isFetching, refetch } = useQuery(
    publicBentoQueryOptions(publicSupabase, pseudo),
  );
  const state = publicPageState({ ownPseudo, data, isError, isFetching, isOffline });

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

  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scale = publicBentoScale({
    width,
    height,
    insetTop: insets.top,
    insetBottom: insets.bottom,
    fontScale,
  });
  const sideInset = publicSideInset(width, scale);

  return (
    <YellowBg>
      <SafeAreaView style={{ flex: 1 }}>
        <TopBar optionsFor={state.kind === 'found' && !state.isOwn ? state.bento.pseudo : null} />
        {state.kind === 'found' ? (
          <FoundPage
            bento={state.bento}
            isOwn={state.isOwn}
            scale={scale}
            sideInset={sideInset}
            boxWidth={width - sideInset * 2}
            fontScale={fontScale}
          />
        ) : state.kind === 'loading' ? (
          <LoadingPage pseudo={pseudo} scale={scale} sideInset={sideInset} />
        ) : state.kind === 'not-found' ? (
          <StateMessage
            title="Bento introuvable"
            body={`Aucun bento publié à l'adresse @${pseudo}. Il a peut-être été supprimé, ou le pseudo n'existe pas (encore).`}
          />
        ) : state.kind === 'nothing-online' ? (
          state.isOwn ? (
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
 * Barre du haut, à hauteur fixe : « Options » apparaît quand le bento arrive
 * sans que rien ne bouge en dessous.
 */
function TopBar({ optionsFor }: { optionsFor: string | null }) {
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
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/compose'))}
        accessibilityRole="button"
        accessibilityLabel="Retour"
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
      {optionsFor ? <BlockReportMenu pseudo={optionsFor} /> : null}
    </View>
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
 */
function ProfileHeader({
  pseudo,
  pastille,
  dateLine,
}: {
  pseudo: string;
  pastille: Pastille;
  dateLine: string | null;
}) {
  const popy = popyForPseudo(pseudo);
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
      ) : (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          allowFontScaling={false}
          style={[dateStyle, { color: 'rgba(10,10,10,0.65)' }]}
        >
          {dateLine}
        </Text>
      )}
    </View>
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
      <ProfileHeader pseudo={pseudo} pastille={null} dateLine={null} />
      <View style={{ marginHorizontal: sideInset }}>
        <BentoBoxSkeleton scale={scale} />
      </View>
    </View>
  );
}

function FoundPage({
  bento,
  isOwn,
  scale,
  sideInset,
  boxWidth,
  fontScale,
}: {
  bento: PublicBento;
  isOwn: boolean;
  scale: number;
  sideInset: number;
  /** Largeur de la boîte entre ses deux marges, cf. `BentoGrid.width`. */
  boxWidth: number;
  fontScale: number;
}) {
  const shareImageRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const onShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const imageUrls = Object.values(bento.slots)
        .map((s) => s.imageUrl)
        .filter((u): u is string => Boolean(u));
      const outcome = await shareBentoImage(bento.pseudo, shareImageRef, imageUrls);
      if (outcome === 'copied') {
        Alert.alert('Lien copié', 'Tu peux le coller où tu veux.');
      } else if (outcome === 'unsupported') {
        Alert.alert('Oups', 'Partage non supporté sur ce navigateur.');
      }
    } finally {
      setSharing(false);
    }
  };

  const dateLine = `${bento.displayName ? `${bento.displayName} · ` : ''}bento publié le ${formatDate(bento.publishedAt)}`;

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
      >
        <ProfileHeader
          pseudo={bento.pseudo}
          pastille={bento.isGuest ? 'guest' : bento.isFeatured ? 'featured' : null}
          dateLine={dateLine}
        />
        {/* Marge et non largeur, cf. `publicSideInset`. */}
        <View style={{ marginHorizontal: sideInset }}>
          <BentoGrid items={bento.slots} scale={scale} width={boxWidth} readOnly />
        </View>
      </ScrollView>

      <CtaBar isOwn={isOwn} sharing={sharing} onShare={onShare} fontScale={fontScale} />

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
        <ShareImage ref={shareImageRef} items={bento.slots} pseudo={bento.pseudo} />
      </View>
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
}: {
  isOwn: boolean;
  sharing: boolean;
  onShare: () => void;
  fontScale: number;
}) {
  // Appliquée par l'écran, comme l'en-tête : cf. `fontScaleFor`.
  const textScale = fontScaleFor(fontScale, BUTTON_MAX_FONT_MULTIPLIER);
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
          onPress={() => router.replace('/(tabs)/compose')}
          accessibilityRole="button"
          accessibilityLabel={isOwn ? 'Modifier mon bento' : 'Compose le tien'}
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
            {isOwn ? 'Modifier' : 'Compose le tien'}
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
        maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
        style={{ fontFamily: 'Extenda', fontSize: 36, textAlign: 'center', letterSpacing: 1 }}
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
            maxFontSizeMultiplier={BUTTON_MAX_FONT_MULTIPLIER}
            style={{
              fontFamily: 'Bungee',
              fontSize: 12,
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Menu d'actions modération sur le bento d'autrui : Signaler + Bloquer
 * (ou Débloquer si déjà mute). Le block est purement local au device
 * (AsyncStorage via `useBlocked`), pas notifié au backend.
 */
function BlockReportMenu({ pseudo }: { pseudo: string }) {
  const isBlocked = useBlocked((s) => s.isBlocked(pseudo));
  const block = useBlocked((s) => s.block);
  const unblock = useBlocked((s) => s.unblock);

  const onPress = () => {
    const options: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
      {
        text: 'Signaler ce bento',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Signaler ce bento',
            `Tu vas signaler @${pseudo} à l'équipe Bento Pop. Confirmes-tu ?`,
            [
              { text: 'Annuler', style: 'cancel' },
              {
                text: 'Signaler',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await submitReport({ targetKind: 'bento', targetPseudo: pseudo });
                    Alert.alert('Merci', 'Notre équipe va examiner ce bento sous 24h.');
                  } catch (e) {
                    Alert.alert('Oups', (e as Error).message);
                  }
                },
              },
            ],
          );
        },
      },
    ];
    if (isBlocked) {
      options.push({
        text: `Débloquer @${pseudo}`,
        onPress: () => unblock(pseudo),
      });
    } else {
      options.push({
        text: `Bloquer @${pseudo}`,
        onPress: () =>
          Alert.alert(
            'Bloquer cet utilisateur ?',
            'Tu ne verras plus son bento dans La table ni dans la recherche. Tu peux annuler à tout moment depuis ce menu.',
            [
              { text: 'Annuler', style: 'cancel' },
              {
                text: 'Bloquer',
                style: 'destructive',
                onPress: () => block(pseudo),
              },
            ],
          ),
      });
    }
    options.push({ text: 'Annuler', style: 'cancel' });
    Alert.alert(`Options pour @${pseudo}`, undefined, options);
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Options pour @${pseudo}`}
      accessibilityHint="Ouvre les options de signalement et blocage"
      style={{ marginLeft: 'auto', paddingHorizontal: 12, paddingVertical: 6 }}
    >
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={BUTTON_MAX_FONT_MULTIPLIER}
        style={{
          fontFamily: 'Bungee',
          fontSize: 10,
          letterSpacing: 1.5,
          color: 'rgba(10,10,10,0.55)',
          textTransform: 'uppercase',
        }}
      >
        Options
      </Text>
    </Pressable>
  );
}
