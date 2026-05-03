'use client';

import { useEffect } from 'react';

type Handlers = {
  onSpace?: () => void;
  onEnter?: () => void;
  onR?: () => void;
  onF?: () => void;
  onEscape?: () => void;
  onM?: () => void;
};

export function useKeyboardControls(handlers: Handlers): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          handlers.onSpace?.();
          break;
        case 'Enter':
        case 'NumpadEnter':
          handlers.onEnter?.();
          break;
        case 'KeyR':
          handlers.onR?.();
          break;
        case 'KeyF':
          handlers.onF?.();
          break;
        case 'KeyM':
          handlers.onM?.();
          break;
        case 'Escape':
          handlers.onEscape?.();
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers]);
}

export function toggleFullscreen(): void {
  if (typeof document === 'undefined') return;
  if (!document.fullscreenElement) {
    void document.documentElement.requestFullscreen?.();
  } else {
    void document.exitFullscreen?.();
  }
}
