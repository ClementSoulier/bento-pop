import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import {
  CONTENT_MAX_FONT_MULTIPLIER,
  CONTROL_MAX_FONT_MULTIPLIER,
  fontScaleFor,
  scaledType,
} from '@/components/bento/font-scaling';
import { AccountError } from '@/components/account/AccountParts';
import { INK_MUTED, INK_PLACEHOLDER, StampButton } from '@/components/primitives';
import { ActionSheet, type SheetAction } from '@/components/social/ActionSheet';
import { busyA11y } from '@/lib/a11y-states';
import { keptEmail } from '@/lib/account';
import { isBlockedAccount } from '@/lib/blocked-accounts';
import { popyFor } from '@/lib/popy-avatar';
import { relativeDate } from '@/lib/relative-date';
import {
  COMMENT_WARN_REMAINING,
  canSendComment,
  commentGate,
  commentRemaining,
  socialErrorKey,
  socialErrorMessage,
} from '@/lib/social';
import { COMMENTS_PAGE, deleteComment, fetchComments, postComment } from '@/lib/social-actions';
import { useAppStatus } from '@/state/app-status';
import { useBento } from '@/state/bento';
import { useBlocked } from '@/state/blocked';
import { useSession } from '@/state/session';
import { useSocial } from '@/state/social';
import { supabase } from '@/supabase/client';
import type { BentoCommentRow } from '@/supabase/types';

type Pages = InfiniteData<BentoCommentRow[], string | null>;

const INK = '#0a0a0a';
const AVATAR = 34;

const commentsQueryKey = (bentoId: string) => ['comments', bentoId] as const;

/**
 * Les commentaires d'un bento, chantier 22 (§5.2) : la liste dans l'ordre où
 * ils ont été écrits, puis le champ, au-dessus du clavier.
 *
 * Écrire demande d'avoir publié son bento et gardé son compte (D3) : sans,
 * le champ laisse place à ce qui manque, une étape à la fois (§5.3). Un
 * propriétaire qui refuse les commentaires, ou l'interrupteur éteint (D15),
 * ferment le champ et vident la liste, ce que la base fait de son côté.
 *
 * Les erreurs se disent sous le champ, pas dans un toast : un toast vit
 * sous la pile, donc derrière cet écran modal sur iOS.
 */
export default function CommentsScreen() {
  const { bentoId } = useLocalSearchParams<{ bentoId: string }>();
  const { fontScale } = useWindowDimensions();
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<BentoCommentRow>>(null);

  const kept = useSession((s) => keptEmail(s.user) !== null);
  const hasPublished = useBento((s) => s.own.some((b) => b.publishedAt !== null));
  const commentsEnabled = useAppStatus((s) => s.config?.commentsEnabled ?? true);
  const social = useSocial((s) => s.byId[bentoId]);
  const bumpComments = useSocial((s) => s.bumpComments);
  const blocked = useBlocked((s) => s.index);

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<BentoCommentRow | null>(null);
  const scrolledOnce = useRef(false);

  useEffect(() => {
    // Ouvert par un lien, l'écran ne connaît pas encore les réglages du bento.
    void useSocial.getState().load([bentoId]);
  }, [bentoId]);

  const query = useInfiniteQuery({
    queryKey: commentsQueryKey(bentoId),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchComments(supabase, bentoId, pageParam),
    // Une page pleine en laisse peut-être d'autres, plus anciennes que son
    // premier commentaire.
    getNextPageParam: (last) =>
      last.length === COMMENTS_PAGE ? (last[0]?.created_at ?? null) : null,
  });

  const comments = useMemo(
    () =>
      [...(query.data?.pages ?? [])]
        .reverse()
        .flat()
        // Bloquer prend effet tout de suite ; la base les retire aussi à la
        // lecture suivante (D9).
        .filter(
          (c) =>
            c.is_mine ||
            !isBlockedAccount(blocked, { userId: c.author_id, pseudo: c.author_pseudo }),
        ),
    [query.data, blocked],
  );

  const closed = !commentsEnabled || social?.acceptsComments === false;
  const gate = commentGate({ hasPublished, kept });

  const setPages = (update: (pages: BentoCommentRow[][]) => BentoCommentRow[][]) =>
    queryClient.setQueryData<Pages>(commentsQueryKey(bentoId), (data) =>
      data ? { ...data, pages: update(data.pages) } : { pages: update([[]]), pageParams: [null] },
    );

  const send = async () => {
    if (busy || !canSendComment(text)) return;
    setBusy(true);
    setError(null);
    try {
      const row = await postComment(supabase, bentoId, text);
      setPages((pages) => [[...(pages[0] ?? []), row], ...pages.slice(1)]);
      bumpComments(bentoId, 1);
      setText('');
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (e) {
      // Un refus attendu (filtre, rythme, droits) se dit à l'écran ; seul
      // l'inattendu se journalise.
      if (!socialErrorKey(e)) console.warn('[commentaires] envoi', e);
      setError(socialErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = (comment: BentoCommentRow) => {
    Alert.alert('Supprimer ce commentaire ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            if (await deleteComment(supabase, comment.id)) {
              setPages((pages) => pages.map((page) => page.filter((c) => c.id !== comment.id)));
              if (comment.status === 'visible') bumpComments(bentoId, -1);
            }
          } catch (e) {
            // Un refus attendu (filtre, rythme, droits) se dit à l'écran ; seul
            // l'inattendu se journalise.
            if (!socialErrorKey(e)) console.warn('[commentaires] suppression', e);
            setError(socialErrorMessage(e));
          }
        },
      },
    ]);
  };

  const block = (comment: BentoCommentRow) => {
    Alert.alert(
      `Bloquer @${comment.author_pseudo} ?`,
      'Il ne pourra plus commenter ni aimer tes bentos, et ses commentaires y disparaissent. Tu peux le débloquer depuis tes réglages.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Bloquer',
          style: 'destructive',
          onPress: () => {
            void useBlocked
              .getState()
              .block({ userId: comment.author_id, pseudo: comment.author_pseudo });
            // Ses commentaires sortent du nombre : relu tout de suite.
            void useSocial.getState().load([bentoId], { force: true });
          },
        },
      ],
    );
  };

  const actionsFor = (comment: BentoCommentRow): SheetAction[] => {
    if (comment.is_mine)
      return [{ label: 'Supprimer', destructive: true, onPress: () => remove(comment) }];
    const actions: SheetAction[] = [
      {
        label: 'Signaler ce commentaire',
        onPress: () =>
          router.push({
            pathname: '/report',
            params: { kind: 'comment', id: comment.id, pseudo: comment.author_pseudo },
          }),
      },
      { label: `Bloquer @${comment.author_pseudo}`, onPress: () => block(comment) },
    ];
    if (comment.can_delete)
      actions.push({ label: 'Supprimer', destructive: true, onPress: () => remove(comment) });
    return actions;
  };

  const titleSize = 28 * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fbf3de' }} edges={['top', 'bottom']}>
      {/* `padding` sur les deux plateformes : l'affichage bord à bord d'Android
          (SDK 57) ne redimensionne plus la fenêtre sous le clavier, qui
          couvrait le champ. Relevé à la recette du lot 5, Pixel 8. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 8,
          }}
        >
          <Text
            accessibilityRole="header"
            allowFontScaling={false}
            numberOfLines={1}
            style={{
              fontFamily: 'Bungee',
              fontSize: titleSize * 0.7,
              lineHeight: titleSize * 0.9,
              color: INK,
            }}
          >
            Commentaires
          </Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            hitSlop={8}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              borderWidth: 2.5,
              borderColor: INK,
              backgroundColor: '#ffffff',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text allowFontScaling={false} style={{ fontSize: 16, fontWeight: '800', color: INK }}>
              ✕
            </Text>
          </Pressable>
        </View>

        {closed ? (
          <Notice text="Les commentaires sont fermés sur ce bento." />
        ) : query.isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={INK} accessibilityLabel="Chargement des commentaires" />
          </View>
        ) : query.isError ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              gap: 16,
            }}
          >
            <Text
              allowFontScaling={false}
              style={{
                ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 15, 21),
                color: INK,
                textAlign: 'center',
              }}
            >
              Les commentaires n'ont pas pu se charger.
            </Text>
            <StampButton onPress={() => void query.refetch()}>Réessayer</StampButton>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={comments}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingVertical: 12,
              gap: 18,
              flexGrow: 1,
            }}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => {
              // Les plus récents en bas, au premier affichage.
              if (!scrolledOnce.current && comments.length > 0) {
                scrolledOnce.current = true;
                listRef.current?.scrollToEnd({ animated: false });
              }
            }}
            ListHeaderComponent={
              query.hasNextPage ? (
                <Pressable
                  onPress={() => void query.fetchNextPage()}
                  disabled={query.isFetchingNextPage}
                  accessibilityRole="button"
                  accessibilityLabel="Voir les commentaires précédents"
                  accessibilityState={
                    busyA11y(
                      { disabled: query.isFetchingNextPage, busy: query.isFetchingNextPage },
                      Platform.OS,
                    ).state
                  }
                  accessibilityValue={
                    busyA11y({ busy: query.isFetchingNextPage }, Platform.OS).value
                  }
                  style={{ alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12 }}
                >
                  <Text
                    allowFontScaling={false}
                    style={{
                      ...scaledType(fontScale, CONTROL_MAX_FONT_MULTIPLIER, 14, 19),
                      fontWeight: '700',
                      color: INK,
                    }}
                  >
                    {query.isFetchingNextPage ? 'Chargement…' : 'Voir les précédents'}
                  </Text>
                </Pressable>
              ) : null
            }
            ListEmptyComponent={
              <Notice text="Aucun commentaire pour l'instant. Lance la conversation." />
            }
            renderItem={({ item }) => <CommentRow comment={item} onMore={() => setMenuFor(item)} />}
          />
        )}

        {closed ? null : gate ? (
          <Gate gate={gate} />
        ) : (
          <View
            style={{
              borderTopWidth: 2,
              borderTopColor: 'rgba(10,10,10,0.12)',
              paddingHorizontal: 16,
              paddingTop: 10,
              paddingBottom: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
              <TextInput
                value={text}
                onChangeText={(value) => {
                  setText(value);
                  setError(null);
                }}
                placeholder="Ajoute un commentaire…"
                placeholderTextColor={INK_PLACEHOLDER}
                accessibilityLabel="Ton commentaire"
                multiline
                editable={!busy}
                maxFontSizeMultiplier={CONTENT_MAX_FONT_MULTIPLIER}
                style={{
                  flex: 1,
                  minHeight: 44,
                  maxHeight: 120,
                  borderWidth: 2.5,
                  borderColor: INK,
                  borderRadius: 22,
                  backgroundColor: '#ffffff',
                  paddingHorizontal: 16,
                  paddingTop: 11,
                  paddingBottom: 11,
                  fontSize: 15,
                  color: INK,
                }}
              />
              <Pressable
                onPress={() => void send()}
                disabled={busy || !canSendComment(text)}
                accessibilityRole="button"
                accessibilityLabel="Envoyer"
                accessibilityState={
                  busyA11y({ disabled: busy || !canSendComment(text), busy }, Platform.OS).state
                }
                accessibilityValue={busyA11y({ busy }, Platform.OS).value}
                style={{
                  height: 44,
                  paddingHorizontal: 16,
                  borderRadius: 22,
                  borderWidth: 2.5,
                  borderColor: INK,
                  backgroundColor: INK,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: busy || !canSendComment(text) ? 0.4 : 1,
                }}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#fbbf24" />
                ) : (
                  <Text
                    allowFontScaling={false}
                    style={{
                      fontFamily: 'Bungee',
                      fontSize: 12 * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER),
                      color: '#fbbf24',
                      letterSpacing: 1,
                    }}
                  >
                    ENVOYER
                  </Text>
                )}
              </Pressable>
            </View>
            <Remaining text={text} />
            <AccountError message={error} />
          </View>
        )}
      </KeyboardAvoidingView>

      <ActionSheet
        visible={menuFor !== null}
        title={menuFor ? `Commentaire de @${menuFor.author_pseudo}` : undefined}
        actions={menuFor ? actionsFor(menuFor) : []}
        onClose={() => setMenuFor(null)}
      />
    </SafeAreaView>
  );
}

function CommentRow({ comment, onMore }: { comment: BentoCommentRow; onMore: () => void }) {
  const { fontScale } = useWindowDimensions();
  const popy = popyFor(comment.author_pseudo, comment.author_avatar);
  const hidden = comment.status === 'hidden';
  return (
    // Grisé à 65 % : au-dessus des 60 % d'encre que l'app s'impose pour un texte.
    <View style={{ flexDirection: 'row', gap: 12, opacity: hidden ? 0.65 : 1 }}>
      <Pressable
        onPress={() =>
          router.push({ pathname: '/u/[pseudo]', params: { pseudo: comment.author_pseudo } })
        }
        accessibilityRole="link"
        accessibilityLabel={`Page de @${comment.author_pseudo}`}
        style={{
          width: AVATAR,
          height: AVATAR,
          borderRadius: AVATAR / 2,
          backgroundColor: popy.accent,
          borderWidth: 2,
          borderColor: INK,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Image
          source={popy.source}
          style={{ width: AVATAR - 8, height: AVATAR - 8 }}
          resizeMode="contain"
        />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={{
              flexShrink: 1,
              ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 14, 19),
              fontWeight: '800',
              color: INK,
            }}
          >
            @{comment.author_pseudo}
          </Text>
          <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={{
              ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 12, 16),
              color: INK_MUTED,
            }}
          >
            {relativeDate(comment.created_at)}
          </Text>
          <Pressable
            onPress={onMore}
            accessibilityRole="button"
            accessibilityLabel={`Actions sur le commentaire de @${comment.author_pseudo}`}
            hitSlop={12}
            style={{ marginLeft: 'auto', paddingHorizontal: 4 }}
          >
            <Text
              allowFontScaling={false}
              style={{ fontSize: 18, fontWeight: '800', color: INK_MUTED }}
            >
              …
            </Text>
          </Pressable>
        </View>
        <Text
          allowFontScaling={false}
          style={{
            marginTop: 2,
            ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 15, 21),
            color: INK,
          }}
        >
          {comment.body}
        </Text>
        {hidden ? (
          <Text
            allowFontScaling={false}
            style={{
              marginTop: 4,
              ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 12, 16),
              color: INK,
              fontWeight: '700',
            }}
          >
            Masqué par l'équipe{comment.hidden_reason ? ` · ${comment.hidden_reason}` : ''}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Ce qu'il reste à écrire, sous les 30 derniers caractères. */
function Remaining({ text }: { text: string }) {
  const { fontScale } = useWindowDimensions();
  const remaining = commentRemaining(text);
  if (remaining > COMMENT_WARN_REMAINING) return null;
  return (
    <Text
      allowFontScaling={false}
      accessibilityLiveRegion="polite"
      style={{
        marginTop: 6,
        alignSelf: 'flex-end',
        ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 12, 16),
        color: remaining < 0 ? '#c1121f' : INK_MUTED,
        fontWeight: '600',
      }}
    >
      {remaining >= 0
        ? `${remaining} caractère${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''}`
        : `${-remaining} de trop`}
    </Text>
  );
}

/** Ce qui manque pour commenter, une étape à la fois (§5.3). */
function Gate({ gate }: { gate: 'publish' | 'keep' }) {
  const { fontScale } = useWindowDimensions();
  const publish = gate === 'publish';
  return (
    <View
      style={{
        borderTopWidth: 2,
        borderTopColor: 'rgba(10,10,10,0.12)',
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 14,
        gap: 12,
      }}
    >
      <Text
        allowFontScaling={false}
        style={{
          ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 15, 21),
          color: INK,
          fontWeight: '600',
        }}
      >
        {publish
          ? 'Publie ton bento pour commenter. Ton pseudo vient avec.'
          : "Garde ton compte pour commenter. Un code par mail, et tes commentaires te suivent d'un téléphone à l'autre."}
      </Text>
      <StampButton
        wide
        onPress={() => {
          if (publish) {
            router.back();
            router.navigate('/(tabs)/compose');
          } else {
            router.push('/account/keep');
          }
        }}
      >
        {publish ? 'Composer mon bento' : 'Garder mon compte'}
      </StampButton>
    </View>
  );
}

function Notice({ text }: { text: string }) {
  const { fontScale } = useWindowDimensions();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text
        allowFontScaling={false}
        style={{
          ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 15, 21),
          color: INK_MUTED,
          textAlign: 'center',
          fontWeight: '600',
        }}
      >
        {text}
      </Text>
    </View>
  );
}
