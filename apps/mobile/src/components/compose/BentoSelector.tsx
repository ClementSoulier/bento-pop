import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { TilePulse } from '@/components/bento/TilePulse';
import { useToast } from '@/components/primitives';
import { Chip } from '@/design';
import { listOwnBentos, switchBento } from '@/lib/bento-actions';
import { type Edition, createEditionBento } from '@/lib/editions';
import { selectionFeedback } from '@/lib/haptics';
import { type OwnBento, bentoName } from '@/lib/own-bento';
import { offerEditorialConsent } from '@/lib/push-runtime';
import { useBento } from '@/state/bento';
import { usePushTarget } from '@/state/push-target';
import { useSession } from '@/state/session';
import { selectorRevealOffset } from './selector-reveal';

/**
 * Les puces des bentos du compte et des éditions à composer, sous l'en-tête du
 * composer (chantier 32, `c09`, `u05`). Le bento courant est choisi, les éditions
 * pas encore commencées sont en `add`.
 *
 * Ne rend rien tant qu'un compte n'a qu'un bento et aucune édition à composer.
 */
export function BentoSelector({
  own,
  currentId,
  editions,
}: {
  own: OwnBento[];
  currentId: string | null;
  /** Les éditions à proposer, déjà filtrées par l'écran. */
  editions: Edition[];
}) {
  const showToast = useToast((s) => s.show);
  const [creating, setCreating] = useState<number | null>(null);
  // L'édition qu'a annoncée une notification tapée (D21 du 17).
  const spotlight = usePushTarget((s) => s.spotlight);

  // Ce qu'il faut pour garder la puce active à l'écran : où est chaque puce, ce
  // que la bande laisse voir, et où elle en est. Des refs et non de l'état : rien
  // de tout cela ne se dessine.
  const bande = useRef<ScrollView>(null);
  const pastilles = useRef(new Map<string, { x: number; width: number }>());
  const vue = useRef({ offset: 0, viewport: 0 });
  const montrer = useCallback((id: string | null) => {
    const pastille = id ? pastilles.current.get(id) : undefined;
    if (!pastille) return;
    const x = selectorRevealOffset({ ...pastille, ...vue.current });
    if (x !== null) bande.current?.scrollTo({ x, animated: true });
  }, []);
  // Un changement de bento courant, vers une puce déjà mesurée. Celle d'un bento
  // qui vient d'être créé ne l'est pas encore : elle se montre elle-même à sa
  // première mesure, cf. `onLayout` plus bas.
  useEffect(() => {
    montrer(currentId);
  }, [currentId, montrer]);
  // L'édition annoncée, si sa puce est déjà mesurée. Sinon, elle se montre
  // elle-même à sa première mesure : les éditions se lisent après.
  useEffect(() => {
    if (spotlight) montrer(`edition-${spotlight.editionId}`);
  }, [spotlight, montrer]);

  // Rien à choisir : le composer garde son aspect. Promesse du §5.4 du chantier 16.
  if (own.length <= 1 && editions.length === 0) return null;

  const rejoindre = async (edition: Edition) => {
    if (creating !== null) return;
    setCreating(edition.id);
    selectionFeedback();
    try {
      const bentoId = await createEditionBento(edition.id);
      const userId = useSession.getState().user?.id;
      if (userId) useBento.getState().setOwn(await listOwnBentos(userId), bentoId);
      await switchBento(bentoId);
      // L'autre moment de l'accord éditorial (D20 du 17) : rejoindre une édition.
      // La phrase ne vient qu'une fois par téléphone, cf. `offerEditorialConsent`.
      void offerEditorialConsent();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'L’édition n’a pas pu s’ouvrir.', {
        variant: 'danger',
      });
    } finally {
      setCreating(null);
    }
  };

  return (
    <ScrollView
      ref={bande}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
      style={{ flexGrow: 0 }}
      onLayout={(e) => {
        vue.current.viewport = e.nativeEvent.layout.width;
      }}
      // Sans cadence, iOS n'envoie qu'un événement par geste, et la position lue
      // serait celle du début du défilement.
      scrollEventThrottle={16}
      onScroll={(e) => {
        vue.current.offset = e.nativeEvent.contentOffset.x;
      }}
    >
      {own.map((bento) => {
        const actif = bento.id === currentId;
        return (
          <View
            key={bento.id}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              pastilles.current.set(bento.id, { x, width });
              if (actif) montrer(bento.id);
            }}
          >
            <Chip
              label={bentoName(bento)}
              selected={actif}
              accessibilityLabel={
                bento.isPrimary
                  ? 'Éditer mon bento'
                  : bento.editionTitle
                    ? `Éditer l’édition ${bento.editionTitle}`
                    : `Éditer le bento ${bento.slug}`
              }
              onPress={() => {
                if (actif) return;
                selectionFeedback();
                void switchBento(bento.id);
              }}
            />
          </View>
        );
      })}

      {/* Les éditions sorties qu'on n'a pas encore composées. Un toucher crée leur
          bento et bascule dessus. Celle qu'annonce une notification tapée pulse, et
          vient à l'écran (D21 du 17) : la rejoindre reste un geste. */}
      {editions.map((edition) => (
        <View
          key={`edition-${edition.id}`}
          onLayout={(e) => {
            const { x, width } = e.nativeEvent.layout;
            pastilles.current.set(`edition-${edition.id}`, { x, width });
            if (spotlight?.editionId === edition.id) {
              montrer(`edition-${edition.id}`);
              // Une fois montrée, l'annonce s'oublie : revenir sur l'onglet ne la
              // rejoue pas.
              setTimeout(() => usePushTarget.getState().clearSpotlight(), 1500);
            }
          }}
        >
          <TilePulse trigger={spotlight?.editionId === edition.id ? spotlight.seq : null}>
            <Chip
              variant="add"
              label={creating === edition.id ? '…' : edition.title}
              accessibilityLabel={`Composer l’édition ${edition.title}`}
              disabled={creating !== null}
              onPress={() => void rejoindre(edition)}
            />
          </TilePulse>
        </View>
      ))}
    </ScrollView>
  );
}
