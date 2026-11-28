import { create } from 'zustand';
import {
  enqueueAsk,
  removeAsk,
  type AskAnswer,
  type AskOptions,
  type QueuedAsk,
} from './ask-rules';

export type { AskAnswer, AskOptions } from './ask-rules';

type AskState = {
  /** Les demandes en attente ; la première se montre, cf. `AskHost`. */
  queue: QueuedAsk[];
  /** Une feuille est à l'écran : les toasts passent dans sa fenêtre, au-dessus d'elle. */
  shown: boolean;
  /** Incrémenté à chaque célébration sans feuille : une pluie de confettis sur l'écran. */
  rain: number;
};

/**
 * La file des demandes de l'app (chantier 32, D10), comme celle des toasts : un
 * magasin global, pour poser une question de n'importe où, `lib` compris, et un
 * seul hôte, `AskHost`, monté une fois à la racine. Une demande à la fois, dans
 * l'ordre ; rien ne bloque l'app pendant qu'elle attend.
 */
export const useAsk = create<AskState>(() => ({ queue: [], shown: false, rain: 0 }));

let nextId = 1;
const resolvers = new Map<number, (answer: AskAnswer) => void>();

/**
 * Pose une question dans une `AskSheet` et rend la réponse, une fois la feuille
 * sortie de l'écran : la boîte du système ou l'écran qui suit ne passent pas
 * par-dessus elle. Une demande de même clé déjà en attente répond `dismissed`.
 */
export function ask(options: AskOptions): Promise<AskAnswer> {
  const { queue } = useAsk.getState();
  if (options.key !== undefined && queue.some((queued) => queued.key === options.key)) {
    return Promise.resolve('dismissed');
  }
  const id = nextId++;
  return new Promise((resolve) => {
    resolvers.set(id, resolve);
    useAsk.setState((state) => ({ queue: enqueueAsk(state.queue, { ...options, id }) }));
  });
}

/** La réponse à la demande `id` : elle quitte la file, la suivante peut se montrer. */
export function answerAsk(id: number, answer: AskAnswer): void {
  const resolve = resolvers.get(id);
  resolvers.delete(id);
  useAsk.setState((state) => ({ queue: removeAsk(state.queue, id) }));
  resolve?.(answer);
}

/**
 * Une célébration sans feuille (D13) : la pluie de confettis tombe sur l'écran,
 * avec le retour de succès, une fois. La publication, quand « Garde ton bento »
 * ne se propose pas.
 */
export function celebrate(): void {
  useAsk.setState((state) => ({ rain: state.rain + 1 }));
}
