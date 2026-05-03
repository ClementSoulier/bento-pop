'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LAYOUTS, DEFAULT_LAYOUT } from '@/data/layouts';
import { POPYS } from '@/data/popys';
import { useWheelSpinner } from '@/hooks/useWheelSpinner';
import { useKeyboardControls, toggleFullscreen } from '@/hooks/useKeyboardControls';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useAutoHideCursor } from '@/hooks/useAutoHideCursor';
import { primeAudio } from '@/lib/audio';
import { BentoBox } from './BentoBox';
import { RevealModal } from './RevealModal';
import { FloatingMascots } from './FloatingMascots';
import { HeaderChips } from './HeaderChips';
import fond from '@bento-pop/brand/assets/textures/fond.jpg';

const REVEAL_DELAY_MS = 1100;
const DEFAULT_DURATION_S = 6;

export function QuizWheel() {
  // Mode présentation : wake-lock + curseur auto-masqué
  useWakeLock();
  useAutoHideCursor();

  // Débloque l'AudioContext dès le premier geste utilisateur (sinon le
  // premier tick d'un spin lancé via Espace peut être muet, le temps que
  // resume() résolve).
  useEffect(() => {
    primeAudio();
  }, []);

  const [layoutKey] = useState(DEFAULT_LAYOUT);
  const [soundOn, setSoundOn] = useState(true);
  const [round, setRound] = useState(0);
  const [showReveal, setShowReveal] = useState(false);

  const layout = LAYOUTS[layoutKey];
  const compartmentCount = layout.dishes.length;

  const { state, highlighted, winner, isSpinning, launch, reset } = useWheelSpinner({
    compartmentCount,
    durationSeconds: DEFAULT_DURATION_S,
    soundOn,
  });

  const handleLaunch = useCallback(() => {
    if (isSpinning) return;
    setShowReveal(false);
    setRound((r) => r + 1);
    launch();
  }, [isSpinning, launch]);

  // Ouvre le modal après une courte pause une fois le winner révélé
  useEffect(() => {
    if (state.status !== 'revealed') return;
    const timer = setTimeout(() => setShowReveal(true), REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state.status]);

  const handleReset = useCallback(() => {
    setShowReveal(false);
    reset();
  }, [reset]);

  useKeyboardControls({
    onSpace: () => {
      if (showReveal) {
        setShowReveal(false);
        return;
      }
      if (!isSpinning) handleLaunch();
    },
    onEnter: () => {
      if (showReveal) setShowReveal(false);
    },
    onR: handleReset,
    onF: toggleFullscreen,
    onM: () => setSoundOn((s) => !s),
    onEscape: () => {
      if (showReveal) {
        setShowReveal(false);
      } else if (document.fullscreenElement) {
        void document.exitFullscreen?.();
      } else {
        handleReset();
      }
    },
  });

  const winnerKey = winner >= 0 ? layout.dishes[winner] : undefined;
  const winnerPopy = winnerKey ? POPYS[winnerKey] : null;

  const status = useMemo<'idle' | 'spinning' | 'revealed'>(() => {
    if (isSpinning) return 'spinning';
    if (winner >= 0) return 'revealed';
    return 'idle';
  }, [isSpinning, winner]);

  return (
    <>
      {/* Fond bois/jaune avec vignette radiale */}
      <div
        className="
          fixed inset-0
          after:pointer-events-none after:absolute after:inset-0
          after:bg-[radial-gradient(ellipse_80%_70%_at_50%_50%,transparent_40%,rgba(217,119,6,0.35)_100%)]
        "
      >
        <Image src={fond} alt="" fill priority className="object-cover" sizes="100vw" />
      </div>

      <FloatingMascots />
      <HeaderChips round={round} status={status} />

      <BentoBox
        layout={layout}
        highlighted={highlighted}
        winner={winner}
        showLabels
      />

      <RevealModal
        popy={winnerPopy}
        open={showReveal}
        onClose={() => setShowReveal(false)}
      />
    </>
  );
}
