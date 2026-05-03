'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { buildTickPlan } from '@/lib/easing';
import { playDing, playTick, primeAudio } from '@/lib/audio';

export type SpinnerState =
  | { status: 'idle' }
  | {
      status: 'spinning';
      currentIndex: number;
      targetIndex: number;
    }
  | { status: 'revealed'; index: number };

type Action =
  | { type: 'START'; targetIndex: number; firstIndex: number }
  | { type: 'TICK'; nextIndex: number; targetIndex: number }
  | { type: 'STOP'; index: number }
  | { type: 'RESET' };

function reducer(state: SpinnerState, action: Action): SpinnerState {
  switch (action.type) {
    case 'START':
      return {
        status: 'spinning',
        currentIndex: action.firstIndex,
        targetIndex: action.targetIndex,
      };
    case 'TICK':
      return {
        status: 'spinning',
        currentIndex: action.nextIndex,
        targetIndex: action.targetIndex,
      };
    case 'STOP':
      return { status: 'revealed', index: action.index };
    case 'RESET':
      return { status: 'idle' };
  }
}

type Options = {
  /** Nombre de compartiments dans le layout courant. */
  compartmentCount: number;
  /** Durée totale du tirage en secondes (clamped 2–15s). */
  durationSeconds: number;
  soundOn: boolean;
};

export type SpinnerControls = {
  state: SpinnerState;
  highlighted: number;
  winner: number;
  isSpinning: boolean;
  launch: () => void;
  reset: () => void;
};

export function useWheelSpinner({
  compartmentCount,
  durationSeconds,
  soundOn,
}: Options): SpinnerControls {
  const [state, dispatch] = useReducer(reducer, { status: 'idle' });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup à l'unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Reset si le layout change pendant un tirage
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    dispatch({ type: 'RESET' });
  }, [compartmentCount]);

  const launch = useCallback(() => {
    if (state.status === 'spinning') return;
    if (compartmentCount <= 0) return;

    primeAudio();

    const totalMs = Math.max(2000, Math.min(15000, durationSeconds * 1000));
    const steps = buildTickPlan(totalMs);
    const stepCount = steps.length;
    if (stepCount === 0) return;

    const target = Math.floor(Math.random() * compartmentCount);
    // Index de départ choisi pour que `target = (start + stepCount - 1) mod n`
    const startIdx = ((target - stepCount + 1) % compartmentCount + compartmentCount) % compartmentCount;

    dispatch({ type: 'START', targetIndex: target, firstIndex: startIdx });
    if (soundOn) playTick(false);

    let k = 1;
    const tick = () => {
      if (k >= stepCount) {
        dispatch({ type: 'STOP', index: target });
        if (soundOn) playDing();
        return;
      }
      const idx = (startIdx + k) % compartmentCount;
      dispatch({ type: 'TICK', nextIndex: idx, targetIndex: target });
      if (soundOn) {
        const nearEnd = k > stepCount - 6;
        playTick(nearEnd);
      }
      k++;
      timeoutRef.current = setTimeout(tick, steps[k - 1] ?? 300);
    };
    timeoutRef.current = setTimeout(tick, steps[0] ?? 70);
  }, [state.status, compartmentCount, durationSeconds, soundOn]);

  const reset = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    dispatch({ type: 'RESET' });
  }, []);

  const highlighted =
    state.status === 'spinning' ? state.currentIndex : -1;
  const winner = state.status === 'revealed' ? state.index : -1;

  return {
    state,
    highlighted,
    winner,
    isSpinning: state.status === 'spinning',
    launch,
    reset,
  };
}
