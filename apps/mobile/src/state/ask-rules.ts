/**
 * La file des demandes (chantier 32, D10) : les règles, sans React Native ni
 * magasin, pour que les tests les lisent sous `node:test`.
 *
 * Une demande est une `AskSheet` du design, Popy et sa question, à la place des
 * `Alert.alert` d'aujourd'hui et de la route `account/keep-offer`. Elles partent
 * de `lib`, sans écran sous la main, et peuvent arriver ensemble : la
 * publication, le composer et la proposition d'un item en lèvent. Une seule se
 * montre à la fois, dans l'ordre d'arrivée.
 */

/** Ce qu'on a répondu : l'action principale, la secondaire, ou la feuille fermée sans choisir. */
export type AskAnswer = 'primary' | 'secondary' | 'dismissed';

export type AskOptions = {
  /** Une même demande ne se pose pas deux fois en même temps : l'accord des éditions, levé par deux écrans. */
  key?: string;
  /** L'humeur de Popy, `content` par défaut. */
  mood?: string;
  title: string;
  message?: string;
  primary: string;
  /** « Plus tard », « Non merci ». */
  secondary?: string;
  /** Une célébration : les confettis tombent sur la feuille. */
  confetti?: boolean;
};

export type QueuedAsk = AskOptions & { id: number };

/** La demande rejoint la file, à la fin ; si une demande de même clé attend déjà, elle ne s'y ajoute pas. */
export function enqueueAsk(queue: readonly QueuedAsk[], ask: QueuedAsk): QueuedAsk[] {
  if (ask.key !== undefined && queue.some((queued) => queued.key === ask.key)) return [...queue];
  return [...queue, ask];
}

/** La demande répondue quitte la file ; les autres gardent leur ordre. */
export function removeAsk(queue: readonly QueuedAsk[], id: number): QueuedAsk[] {
  return queue.filter((queued) => queued.id !== id);
}

/**
 * Les routes devant lesquelles une demande attend. La recherche d'une case est
 * une présentation native sur iOS : une demande levée pendant qu'elle se ferme
 * (la proposition d'un item, `c05`) se présenterait par-dessus une présentation
 * qui part. Elle se montre une fois la recherche partie.
 */
export const ASK_BLOCKING_ROUTES: ReadonlySet<string> = new Set(['search-modal']);

/**
 * Le temps laissé à iOS pour finir de fermer une route qui bloquait, après que
 * la navigation l'a dite partie : présentée trop tôt, la feuille était refusée
 * (« Attempt to present … which is already presenting RNSScreen »), et la
 * recherche restait posée, transparente, sur le composer, à prendre ses
 * touchers. Mesuré à l'iPhone SE au lot 4 du 32.
 */
export const ASK_SETTLE_MS = 400;

/** La demande en tête de file se montre-t-elle, sur cette route ? */
export function askVisible(queue: readonly QueuedAsk[], route: string | undefined): boolean {
  return queue.length > 0 && !ASK_BLOCKING_ROUTES.has(route ?? '');
}
