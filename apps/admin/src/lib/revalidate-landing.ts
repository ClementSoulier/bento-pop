/**
 * Helper pour purger le cache SSG/ISR de la landing après une mutation
 * d'épisode dans le BO.
 *
 * Pourquoi pas `revalidatePath` directement ? Admin et landing sont 2 apps
 * Next.js séparées (containers Coolify distincts). `revalidatePath` ne
 * purge que le cache de l'app qui l'appelle. Pour propager d'une app à
 * l'autre, on passe par un endpoint HTTP `/api/revalidate` côté landing.
 *
 * Env requises (server-only) :
 *  - `LANDING_URL`        : URL absolue de la landing (ex. https://bento-pop.com)
 *  - `REVALIDATE_TOKEN`   : secret partagé avec la landing
 *
 * Si l'une manque, on no-op (logs un warning). Le save admin reste
 * fonctionnel ; la page publique se rafraîchira au prochain ISR (1h).
 *
 * On ne fail jamais le save admin sur une erreur de revalidation : le
 * contenu est bien en DB, c'est le seul invariant qui compte. La
 * propagation au cache est best-effort.
 */
export async function revalidateLanding(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const url = process.env.LANDING_URL;
  const token = process.env.REVALIDATE_TOKEN;
  if (!url || !token) {
    console.warn('[revalidate-landing] LANDING_URL ou REVALIDATE_TOKEN manquant, no-op');
    return;
  }

  const endpoint = `${url.replace(/\/$/, '')}/api/revalidate`;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ paths }),
      // Petit timeout : si la landing répond pas en 5s, on log et on
      // continue. Pas de retry, on attendra l'ISR.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(
        `[revalidate-landing] échec HTTP ${res.status} sur ${endpoint} : ${text.slice(0, 200)}`,
      );
    }
  } catch (err) {
    console.warn('[revalidate-landing] fetch failed:', err);
  }
}
