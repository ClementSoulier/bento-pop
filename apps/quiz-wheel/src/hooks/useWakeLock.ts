'use client';

import { useEffect } from 'react';

type WakeLockSentinel = {
  release: () => Promise<void>;
  addEventListener: (type: 'release', cb: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> };
};

/**
 * Empêche la mise en veille de l'écran pendant que la page est ouverte.
 * Indispensable pour le mode régie : la page peut rester affichée plusieurs
 * heures sans interaction.
 */
export function useWakeLock(): void {
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function request() {
      const nav = navigator as WakeLockNavigator;
      if (!nav.wakeLock) return;
      try {
        const granted = await nav.wakeLock.request('screen');
        if (cancelled) {
          await granted.release();
          return;
        }
        sentinel = granted;
        granted.addEventListener('release', () => {
          sentinel = null;
        });
      } catch {
        /* noop : permission refusée ou contexte non-secure */
      }
    }
    void request();

    function onVisible() {
      if (document.visibilityState === 'visible' && !sentinel) void request();
    }
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
    };
  }, []);
}
