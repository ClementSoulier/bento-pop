/**
 * Délai d'abandon d'une opération annulable.
 *
 * `supabase-js` n'en a aucun : sur un réseau qui accepte la connexion sans
 * répondre, une requête attend ce que le système lui accorde. `withTimeout`
 * rend une valeur de repli mais laisse la requête courir ; ici elle est
 * réellement annulée, et l'échec est une erreur, pas une valeur.
 */

/**
 * Levée quand le délai expire.
 *
 * Porte le statut 0, celui d'une panne réseau chez `supabase-js` : pour une
 * politique de réessai, un réseau qui ne répond pas et un réseau absent sont
 * le même incident.
 */
export class AbortTimeoutError extends Error {
  readonly status = 0;

  constructor(ms: number) {
    super(`Abandon après ${ms} ms`);
    this.name = 'AbortTimeoutError';
  }
}

/**
 * Lance `run` avec un signal, et l'abandonne au bout de `ms`.
 *
 * Le rejet est garanti à l'échéance, même si `run` ignore le signal : la
 * borne ne dépend pas de la bonne volonté de l'opération.
 *
 * `parent` est le signal de React Query, levé quand plus personne n'attend la
 * réponse. Les deux causes d'abandon passent par le même contrôleur.
 */
export function withAbortTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  ms: number,
  parent?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort();
  if (parent?.aborted) controller.abort();
  else parent?.addEventListener('abort', abortFromParent);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // Rejeter avant d'annuler : l'annulation fait rejeter l'opération de
      // façon synchrone, et `Promise.race` retiendrait alors son erreur à elle
      // plutôt que celle du délai.
      reject(new AbortTimeoutError(ms));
      controller.abort();
    }, ms);
  });

  return Promise.race([run(controller.signal), deadline]).finally(() => {
    clearTimeout(timer);
    parent?.removeEventListener('abort', abortFromParent);
  });
}
