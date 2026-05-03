'use client';

import { useEffect } from 'react';

/** Masque le curseur après `delayMs` d'inactivité. Réapparaît au mouvement. */
export function useAutoHideCursor(delayMs = 2500): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const root = document.documentElement;

    function arm() {
      root.classList.remove('cursor-hidden');
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => root.classList.add('cursor-hidden'), delayMs);
    }
    arm();
    window.addEventListener('mousemove', arm);
    window.addEventListener('mousedown', arm);
    window.addEventListener('keydown', arm);
    return () => {
      if (timer) clearTimeout(timer);
      root.classList.remove('cursor-hidden');
      window.removeEventListener('mousemove', arm);
      window.removeEventListener('mousedown', arm);
      window.removeEventListener('keydown', arm);
    };
  }, [delayMs]);
}
