import type { SupabaseClient } from '@supabase/supabase-js';
import { formatVisits } from '@bento-pop/supabase-mobile/bento';
import { withAbortTimeout } from './abort-timeout';
import type { Database } from '@/supabase/types';

/**
 * Le compteur de visites dans l'app. Chantier 8, lot 3.
 *
 * La page d'un bento compte sa visite et rend le compteur en un seul appel,
 * `record_bento_visit_app` : la base ne compte jamais pour le propriétaire, et
 * une seule fois par compte et par jour. Le profil, lui, ne fait que lire,
 * `bento_visit_count`. Les deux passent par le client **avec session** : la
 * base reconnaît le propriétaire à son `auth.uid()`, et refuse une visite
 * d'app sans session.
 *
 * Le compteur n'attend jamais la page : il a sa propre requête, sans réessai,
 * et une visite perdue vaut mieux qu'une page qui attend. Cf.
 * `docs/UX-08-SIGNAUX-DE-RETOUR.md` §6.3.
 */

export type VisitsClient = SupabaseClient<Database>;

/** `visit` : la page d'un bento, qui compte ; `own` : le profil, qui lit. */
export type VisitsMode = 'visit' | 'own';

export const BENTO_VISITS_QUERY_ROOT = 'bento-visits';

/** 5 s, comme la page publique : au-delà, le compteur ne s'affiche pas. */
export const BENTO_VISITS_TIMEOUT_MS = 5000;

export function bentoVisitsQueryKey(bentoId: string, mode: VisitsMode) {
  return [BENTO_VISITS_QUERY_ROOT, bentoId, mode] as const;
}

/**
 * Compte la visite, ou lit le compteur, selon `mode`. `null` quand l'appelant
 * n'a pas le droit de le voir : masqué par son propriétaire, ou bento non
 * publié. Une erreur se lève, et React Query garde la valeur d'avant.
 */
export async function loadBentoVisits(
  client: VisitsClient,
  bentoId: string,
  mode: VisitsMode,
  signal?: AbortSignal,
): Promise<number | null> {
  let request = client.rpc(mode === 'visit' ? 'record_bento_visit_app' : 'bento_visit_count', {
    p_bento: bentoId,
  });
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw error;
  return typeof data === 'number' ? data : null;
}

/**
 * Options de `useQuery`. Chaque affichage compte (`refetchOnMount` à
 * `always`), la valeur en cache s'affiche en attendant la réponse, et rien ne
 * se réessaie. `enabled` reste à l'écran, qui seul sait si la page a trouvé
 * son bento. Le délai est un paramètre pour les tests.
 */
export function bentoVisitsQueryOptions(
  client: VisitsClient,
  bentoId: string,
  mode: VisitsMode,
  timeoutMs: number = BENTO_VISITS_TIMEOUT_MS,
) {
  return {
    queryKey: bentoVisitsQueryKey(bentoId, mode),
    queryFn: ({ signal }: { signal: AbortSignal }): Promise<number | null> =>
      withAbortTimeout(
        (attempt) => loadBentoVisits(client, bentoId, mode, attempt),
        timeoutMs,
        signal,
      ),
    staleTime: 0,
    refetchOnMount: 'always' as const,
    retry: false,
  };
}

/** Une ligne d'état, et le compteur après elle quand il est connu. */
export function withVisits(line: string, visits: number | null | undefined): string {
  return typeof visits === 'number' ? `${line} · ${formatVisits(visits)}` : line;
}

/**
 * « Afficher mes visites » (D9). La politique `users_update_own` ne laisse
 * écrire que sa propre ligne : sur celle d'un autre compte, rien ne change, et
 * aucune erreur ne le dit.
 */
export async function writeShowVisits(
  client: VisitsClient,
  userId: string,
  on: boolean,
): Promise<void> {
  const { error } = await client.from('users').update({ show_visits: on }).eq('id', userId);
  if (error) throw error;
}
