import { useEffect } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { CONTROL_MAX_FONT_MULTIPLIER, fontScaleFor } from '@/components/bento/font-scaling';
import { ACTION_BAR, actionBarHeight } from '@/components/feed/layout';
import { stampShadow, useToast } from '@/components/primitives';
import { failureFeedback, tapFeedback } from '@/lib/haptics';
import { actionBarModel, socialErrorMessage, type ActionPill } from '@/lib/social';
import { useAppStatus } from '@/state/app-status';
import { useSession } from '@/state/session';
import { requestSocial, useSocial } from '@/state/social';

const INK = '#0a0a0a';
const RED = '#e63946';

const HEART =
  'M12 20.5s-7.5-4.6-9.6-9.3C.9 7.6 3 4 6.6 4c2.1 0 3.6 1.1 5.4 3.1C13.8 5.1 15.3 4 17.4 4 21 4 23.1 7.6 21.6 11.2c-2.1 4.7-9.6 9.3-9.6 9.3z';
const BUBBLE =
  'M4 5.5C4 4.1 5.1 3 6.5 3h11C18.9 3 20 4.1 20 5.5v8c0 1.4-1.1 2.5-2.5 2.5H11l-4.5 4v-4C5.1 16 4 14.9 4 13.5z';

/**
 * Le cœur et la bulle d'un bento, chantier 22 (§5.1), et ce qu'ils font.
 *
 * Les nombres se demandent en groupe, à la montée (`requestSocial`), après le
 * fil ou la page : le premier écran ne les attend pas (D16).
 */
function useActions(bentoId: string, ownerId: string | null, compact: boolean) {
  const userId = useSession((s) => s.user?.id ?? null);
  const social = useSocial((s) => s.byId[bentoId]);
  const toggleLike = useSocial((s) => s.toggleLike);
  // Fermé sans nouvelle version (D15). Sans configuration lue, ouvert : la
  // base refuse de toute façon ce qu'elle refuse.
  const commentsEnabled = useAppStatus((s) => s.config?.commentsEnabled ?? true);
  const showToast = useToast((s) => s.show);

  useEffect(() => {
    requestSocial(bentoId);
  }, [bentoId]);

  const isOwn = ownerId !== null && ownerId === userId;
  const model = actionBarModel(social, { isOwn, compact });

  const onLike = async () => {
    tapFeedback();
    const { error } = await toggleLike(bentoId);
    if (error) {
      failureFeedback();
      showToast(socialErrorMessage(error), { variant: 'danger' });
    }
  };
  const onComment = () => router.push({ pathname: '/comments/[bentoId]', params: { bentoId } });

  return { heart: model.heart, bubble: commentsEnabled ? model.bubble : null, onLike, onComment };
}

/**
 * Sous un post du fil, et de « Ses autres bentos ».
 *
 * **À côté du post, pas dedans** : le post est un seul élément accessible
 * dont les descendants sont masqués (`FeedPost`), un cœur à l'intérieur
 * serait inatteignable au lecteur d'écran. Ici, deux boutons à part.
 *
 * **Sa hauteur ne bouge jamais** (D16) : réservée dès le premier rendu, avant
 * les nombres, et même vide quand le propriétaire refuse likes et
 * commentaires.
 */
export function ActionBar({ bentoId, ownerId }: { bentoId: string; ownerId: string | null }) {
  const { fontScale } = useWindowDimensions();
  const { heart, bubble, onLike, onComment } = useActions(bentoId, ownerId, false);
  return (
    <View
      style={{
        height: actionBarHeight(fontScale),
        paddingTop: ACTION_BAR.marginTop,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: ACTION_BAR.gap,
      }}
    >
      {heart ? <Pill pill={heart} icon="heart" onPress={onLike} /> : null}
      {bubble ? <Pill pill={bubble} icon="bubble" onPress={onComment} /> : null}
    </View>
  );
}

/**
 * Sur la page d'un bento : le cœur à gauche du Popy, la bulle à sa droite,
 * dans la bande de l'avatar, que rien n'occupait. Rien n'y prend de hauteur :
 * le budget de la page reste celui du chantier 7, la boîte à la taille du
 * fil, sans défilement (`publicBoxAvailableHeight`).
 *
 * `bandTop` et `bandHeight` disent où se trouve l'avatar dans l'en-tête ;
 * chaque pastille s'y centre. Compactes : le nombre seul, rien qu'une icône
 * à zéro.
 */
export function HeaderActions({
  bentoId,
  ownerId,
  bandTop,
  bandHeight,
}: {
  bentoId: string;
  ownerId: string | null;
  bandTop: number;
  bandHeight: number;
}) {
  const { fontScale } = useWindowDimensions();
  const { heart, bubble, onLike, onComment } = useActions(bentoId, ownerId, true);
  const pillHeight = actionBarHeight(fontScale) - ACTION_BAR.marginTop;
  const top = bandTop + (bandHeight - pillHeight) / 2;
  return (
    <>
      {heart ? (
        <View style={{ position: 'absolute', left: 16, top }}>
          <Pill pill={heart} icon="heart" onPress={onLike} />
        </View>
      ) : null}
      {bubble ? (
        <View style={{ position: 'absolute', right: 16, top }}>
          <Pill pill={bubble} icon="bubble" onPress={onComment} />
        </View>
      ) : null}
    </>
  );
}

function Pill({
  pill,
  icon,
  onPress,
}: {
  pill: ActionPill;
  icon: 'heart' | 'bubble';
  onPress: () => void;
}) {
  const { fontScale } = useWindowDimensions();
  // Plafonné comme les autres contrôles : la barre ne grossit pas au-delà de
  // ce que `actionBarHeight` lui réserve.
  const scale = fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER);
  const content = (
    <>
      <Svg width={ACTION_BAR.iconSize} height={ACTION_BAR.iconSize} viewBox="0 0 24 24">
        <Path
          d={icon === 'heart' ? HEART : BUBBLE}
          fill={icon === 'heart' && pill.active ? RED : '#ffffff'}
          stroke={INK}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
      </Svg>
      {pill.text ? (
        <Text
          numberOfLines={1}
          allowFontScaling={false}
          style={{
            fontFamily: 'Bungee',
            fontSize: 13 * scale,
            lineHeight: ACTION_BAR.labelLineHeight * scale,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: INK,
          }}
        >
          {pill.text}
        </Text>
      ) : null}
    </>
  );
  const style = [
    {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      // L'icône seule tient la hauteur de la ligne de texte.
      minHeight:
        ACTION_BAR.borderWidth * 2 +
        ACTION_BAR.paddingVertical * 2 +
        Math.max(ACTION_BAR.iconSize, ACTION_BAR.labelLineHeight * scale),
      borderWidth: ACTION_BAR.borderWidth,
      borderColor: INK,
      borderRadius: 999,
      paddingVertical: ACTION_BAR.paddingVertical,
      paddingHorizontal: ACTION_BAR.paddingHorizontal,
      backgroundColor: '#ffffff',
    },
    stampShadow(3),
  ];

  if (!pill.pressable) {
    return (
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={pill.accessibilityLabel}
        style={style}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={pill.accessibilityLabel}
      accessibilityState={icon === 'heart' ? { selected: pill.active } : undefined}
      // La pastille fait une trentaine de points de haut : la cible en fait 44.
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={style}
    >
      {content}
    </Pressable>
  );
}
