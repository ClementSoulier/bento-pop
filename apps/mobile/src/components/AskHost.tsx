import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSegments } from 'expo-router';
import { AskSheet, Confetti, type Mood } from '@/design';
import { successFeedback } from '@/lib/haptics';
import { answerAsk, useAsk, type AskAnswer } from '@/state/ask';
import { ASK_BLOCKING_ROUTES, ASK_SETTLE_MS, askVisible } from '@/state/ask-rules';
import { ToastHost } from './ToastHost';

/** L'écart entre la feuille et le toast qu'elle suit (D12 du 32). */
const TOAST_GAP = 8;

/**
 * L'hôte des demandes (chantier 32, D10), monté une fois à la racine : la
 * première demande de la file dans l'`AskSheet` du design, Popy et sa
 * question. La réponse part une fois la feuille sortie de l'écran, et la
 * suivante monte ensuite : une à la fois, dans l'ordre.
 *
 * Il porte aussi la célébration sans feuille (D13) : la publication, quand
 * « Garde ton bento » ne se propose pas, fait tomber ses confettis sur l'écran.
 * Une célébration a son retour de succès, une fois : à la pluie, ou à la
 * montée d'une demande qui en porte.
 */
export function AskHost() {
  const segments = useSegments();
  // Une route qui bloquait vient de partir : iOS finit de la fermer avant
  // qu'une feuille se présente, cf. `ASK_SETTLE_MS`.
  const blocked = ASK_BLOCKING_ROUTES.has(segments[0] ?? '');
  const [settled, setSettled] = useState(!blocked);
  useEffect(() => {
    if (blocked) {
      setSettled(false);
      return;
    }
    const timer = setTimeout(() => setSettled(true), ASK_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [blocked]);
  const head = useAsk((s) => (askVisible(s.queue, segments[0]) ? (s.queue[0] ?? null) : null));
  const current = settled ? head : null;
  // Les toasts suivent ce qui est vraiment à l'écran, pas la file.
  useEffect(() => {
    useAsk.setState({ shown: current !== null });
  }, [current]);
  const rain = useAsk((s) => s.rain);
  // La réponse choisie, gardée le temps que la feuille sorte.
  const [answered, setAnswered] = useState<{ id: number; answer: AskAnswer } | null>(null);
  const [panelHeight, setPanelHeight] = useState(0);

  const celebrated = useRef(rain);
  const [shownRain, setShownRain] = useState(0);
  useEffect(() => {
    if (rain === celebrated.current) return;
    celebrated.current = rain;
    setShownRain(rain);
    successFeedback();
  }, [rain]);

  const currentId = current?.id;
  const confetti = Boolean(current?.confetti);
  useEffect(() => {
    if (currentId !== undefined && confetti) successFeedback();
  }, [currentId, confetti]);

  const answer = (value: AskAnswer) => {
    if (!current || answered?.id === current.id) return;
    setAnswered({ id: current.id, answer: value });
  };

  return (
    <>
      {shownRain > 0 ? (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={StyleSheet.absoluteFill}
        >
          <Confetti key={shownRain} onDone={() => setShownRain(0)} />
        </View>
      ) : null}
      {current ? (
        <AskSheet
          key={current.id}
          visible={answered?.id !== current.id}
          mood={(current.mood ?? 'content') as Mood}
          title={current.title}
          message={current.message}
          primary={current.primary}
          onPrimary={() => answer('primary')}
          secondary={current.secondary}
          onSecondary={() => answer('secondary')}
          onClose={() => answer('dismissed')}
          confetti={current.confetti}
          onPanelHeight={setPanelHeight}
          onHidden={() => {
            if (answered?.id !== current.id) return;
            setAnswered(null);
            answerAsk(current.id, answered.answer);
          }}
          overlay={
            panelHeight > 0 ? <ToastHost scope="ask" bottom={panelHeight + TOAST_GAP} /> : null
          }
        />
      ) : null}
    </>
  );
}
