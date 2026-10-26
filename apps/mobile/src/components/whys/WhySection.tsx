import { useEffect, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import type { CaseMeta } from '@bento-pop/supabase-mobile/bento';
import {
  CONTENT_MAX_FONT_MULTIPLIER,
  CONTROL_MAX_FONT_MULTIPLIER,
  fontScaleFor,
  scaledType,
} from '@/components/bento/font-scaling';
import { INK_MUTED, StampButton, stampShadow } from '@/components/primitives';
import { ActionSheet } from '@/components/social/ActionSheet';
import { whyLineLabel, whyLines, type BentoWhys, type WhyLine } from '@/lib/whys';
import { useAppStatus } from '@/state/app-status';
import { useOwnWhys } from '@/state/own-whys';

const INK = '#0a0a0a';
const CREAM = '#fbf3de';

/** L'écart entre la boîte et le titre de la section. */
export const WHY_SECTION_GAP = 32;

/**
 * « Pourquoi ces choix », sous la boîte de la page d'un bento, chantier 12
 * (§5.1, D1) : une ligne par case expliquée, l'étiquette, le titre et le
 * pourquoi. Rien tant qu'aucune case ne l'est : la page ne change pas d'un
 * point.
 *
 * Pour son propre bento, la section lit ses pourquoi par la session, masqués
 * compris avec leur motif (D8), porte « Modifier », et devient une invitation
 * tant qu'il n'y en a aucun (D2). Pour les autres, chaque ligne a son « … »,
 * qui mène à « Signaler ».
 *
 * **La ligne et son bouton sont frères**, pas l'un dans l'autre : une ligne
 * lue d'un bloc masquerait son bouton au lecteur d'écran sur iOS, le piège
 * de la feuille d'actions du 22.
 */
export function WhySection({
  bentoId,
  pseudo,
  slug,
  cases,
  slots,
  whys,
  isOwn,
  sideInset,
}: {
  bentoId: string;
  pseudo: string;
  /** Celui de la page ouverte : l'écran « Tes pourquoi » relit le même cache. */
  slug: string | null;
  cases: readonly CaseMeta[];
  slots: Readonly<Partial<Record<string, { title: string }>>>;
  whys: BentoWhys;
  isOwn: boolean;
  sideInset: number;
}) {
  const { fontScale } = useWindowDimensions();
  const enabled = useAppStatus((s) => s.config?.whysEnabled ?? true);
  const own = useOwnWhys((s) => s.byBento[bentoId]);
  const [menuFor, setMenuFor] = useState<WhyLine | null>(null);

  useEffect(() => {
    if (isOwn) void useOwnWhys.getState().load(bentoId);
  }, [isOwn, bentoId]);

  if (!enabled) return null;
  // Les siens dès qu'ils sont lus ; d'ici là, ce que la page a lu pour tous.
  const lines = whyLines(cases, slots, whys, isOwn && own ? own : null);
  if (lines.length === 0 && !isOwn) return null;

  const openEditor = () =>
    router.push({ pathname: '/whys/[bentoId]', params: { bentoId, pseudo, slug: slug ?? '' } });

  const body = scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 15, 21);

  return (
    <View style={{ marginTop: WHY_SECTION_GAP, marginHorizontal: sideInset }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          gap: 12,
        }}
      >
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          allowFontScaling={false}
          style={{
            flexShrink: 1,
            fontFamily: 'Bungee',
            fontSize: 10 * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER),
            letterSpacing: 2,
            color: INK_MUTED,
            textTransform: 'uppercase',
          }}
        >
          Pourquoi ces choix
        </Text>
        {isOwn && lines.length > 0 ? (
          <Pressable
            onPress={openEditor}
            accessibilityRole="button"
            accessibilityLabel="Modifier mes pourquoi"
            hitSlop={8}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              borderWidth: 2.5,
              borderColor: INK,
              backgroundColor: '#ffffff',
            }}
          >
            <Text
              allowFontScaling={false}
              style={{
                fontFamily: 'Bungee',
                fontSize: 11 * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER),
                color: INK,
              }}
            >
              Modifier
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View
        style={[
          {
            backgroundColor: CREAM,
            borderWidth: 2.5,
            borderColor: INK,
            borderRadius: 22,
            paddingHorizontal: 16,
            paddingVertical: 14,
            gap: 16,
          },
          stampShadow(3),
        ]}
      >
        {lines.length === 0 ? (
          <View style={{ gap: 12 }}>
            <Text allowFontScaling={false} style={{ ...body, color: INK, fontWeight: '600' }}>
              Dis pourquoi ces choix, une ligne par case. C'est ce qu'on lira sous ta boîte.
            </Text>
            <StampButton wide onPress={openEditor} accessibilityLabel="Écrire mes pourquoi">
              Écrire mes pourquoi
            </StampButton>
          </View>
        ) : (
          lines.map((line) => (
            <View key={line.caseKey} style={{ flexDirection: 'row', gap: 8 }}>
              <View
                accessible
                accessibilityLabel={whyLineLabel(line)}
                // Grisé à 65 % : au-dessus des 60 % d'encre que l'app s'impose.
                style={{ flex: 1, minWidth: 0, gap: 2, opacity: line.hidden ? 0.65 : 1 }}
              >
                <Text
                  allowFontScaling={false}
                  numberOfLines={2}
                  style={{
                    fontFamily: 'Bungee',
                    fontSize: 10 * fontScaleFor(fontScale, CONTROL_MAX_FONT_MULTIPLIER),
                    letterSpacing: 1,
                    color: INK_MUTED,
                    textTransform: 'uppercase',
                  }}
                >
                  {line.label}
                </Text>
                <Text allowFontScaling={false} style={{ ...body, color: INK, fontWeight: '800' }}>
                  {line.title}
                </Text>
                <Text allowFontScaling={false} style={{ ...body, color: INK }}>
                  « {line.body} »
                </Text>
                {line.hidden ? (
                  <Text
                    allowFontScaling={false}
                    style={{
                      marginTop: 2,
                      ...scaledType(fontScale, CONTENT_MAX_FONT_MULTIPLIER, 12, 16),
                      color: INK,
                      fontWeight: '700',
                    }}
                  >
                    Masqué par l'équipe{line.hiddenReason ? ` · ${line.hiddenReason}` : ''}
                  </Text>
                ) : null}
              </View>
              {!isOwn && line.whyId ? (
                <Pressable
                  onPress={() => setMenuFor(line)}
                  accessibilityRole="button"
                  accessibilityLabel={`Options du pourquoi, ${line.prompt}`}
                  hitSlop={8}
                  // Le « … » en haut de son cadre, à hauteur de l'étiquette, et
                  // le cadre jamais au-dessus de la ligne : le lecteur d'écran
                  // lit de haut en bas, il annonçait les options avant le texte.
                  style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'flex-start', marginRight: -10 }}
                >
                  <Text allowFontScaling={false} style={{ fontSize: 18, fontWeight: '800', color: INK_MUTED }}>
                    …
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </View>

      <ActionSheet
        visible={menuFor !== null}
        title={menuFor ? `Pourquoi de @${pseudo}, ${menuFor.prompt}` : undefined}
        actions={
          menuFor?.whyId
            ? [
                {
                  label: 'Signaler ce pourquoi',
                  onPress: () => {
                    const whyId = menuFor.whyId;
                    setMenuFor(null);
                    if (whyId) router.push({ pathname: '/report', params: { kind: 'why', id: whyId, pseudo } });
                  },
                },
              ]
            : []
        }
        onClose={() => setMenuFor(null)}
      />
    </View>
  );
}
