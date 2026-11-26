/**
 * Limite d'envois par adresse IP, en mémoire du serveur.
 *
 * La landing tourne dans un seul conteneur (Coolify) : la mémoire du process
 * suffit, sans table ni service de plus. Un redémarrage remet les compteurs à
 * zéro, ce qui est sans gravité : la limite ne protège que du martèlement
 * (base remplie d'adresses inventées, salon Discord inondé).
 */
export type RateLimiter = {
  /** `true` si l'envoi passe (et compte), `false` s'il dépasse la limite. */
  take(key: string, now?: number): boolean;
};

export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = 10_000,
}: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}): RateLimiter {
  const hits = new Map<string, number[]>();

  function prune(now: number) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= windowMs)) hits.delete(key);
    }
    // Encore trop de clés (beaucoup d'adresses dans la même fenêtre) : on
    // oublie les plus anciennes, dans l'ordre d'insertion de la Map.
    for (const key of hits.keys()) {
      if (hits.size <= maxKeys) break;
      hits.delete(key);
    }
  }

  return {
    take(key, now = Date.now()) {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > maxKeys) prune(now);
      return true;
    },
  };
}
