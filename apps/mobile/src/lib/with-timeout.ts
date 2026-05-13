/**
 * Enveloppe une promesse avec un timeout et un fallback.
 *
 * Si `p` resolve avant `ms` ms → renvoie sa valeur.
 * Si `p` reject → renvoie `fallback` (rejet silencieux).
 * Si `ms` ms s'écoulent avant resolve → renvoie `fallback`.
 *
 * Utilisé au boot de l'app pour éviter qu'un appel réseau hang n'immobilise
 * le splash indéfiniment (cf. rejet App Store sub. 2bf822e0).
 */
export function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(fallback);
      }
    }, ms);
    p.then(
      (v) => {
        if (!done) {
          done = true;
          clearTimeout(t);
          resolve(v);
        }
      },
      () => {
        if (!done) {
          done = true;
          clearTimeout(t);
          resolve(fallback);
        }
      },
    );
  });
}
