import { create } from 'zustand';
import type { IconName } from '@/design/icons';
import type { ToastTone } from '@/design/overlays/toast-rules';

export type ToastVariant = ToastTone;

type ToastAction = { label: string; onPress: () => void };

type ToastState = {
  message: string | null;
  variant: ToastVariant;
  /** L'icône que la maquette dessine, quand ce n'est pas celle de la variante. */
  icon: IconName | null;
  action: ToastAction | null;
  /** La durée que l'appel demande ; le guide en fixe le plancher (`toastDuration`). */
  durationMs: number | null;
  /** Incrémenté à chaque toast : un nouveau message est un nouveau toast. */
  seq: number;
  show: (
    message: string,
    opts?: { variant?: ToastVariant; icon?: IconName; action?: ToastAction; durationMs?: number },
  ) => void;
  hide: () => void;
  /** Retire le toast `seq`, s'il est encore celui qu'on montre. */
  dismiss: (seq: number) => void;
};

/**
 * La file des toasts de l'app : un magasin global, pour en lever un de
 * n'importe où (`useToast().show(...)`), et un seul hôte, `ToastHost`, monté
 * une fois à la racine. Une file d'un seul : le suivant remplace le précédent.
 *
 * Sa forme n'a pas changé au chantier 31, qui a refait l'hôte au design (D7) :
 * les trente appels de l'app restent tels quels, l'icône en plus.
 */
export const useToast = create<ToastState>((set, get) => ({
  message: null,
  variant: 'neutral',
  icon: null,
  action: null,
  durationMs: null,
  seq: 0,
  show: (message, opts) =>
    set({
      message,
      variant: opts?.variant ?? 'neutral',
      icon: opts?.icon ?? null,
      action: opts?.action ?? null,
      durationMs: opts?.durationMs ?? null,
      seq: get().seq + 1,
    }),
  hide: () => set({ message: null, action: null }),
  dismiss: (seq) => {
    if (get().seq === seq) set({ message: null, action: null });
  },
}));
