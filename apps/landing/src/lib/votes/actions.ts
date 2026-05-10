'use server';

import { revalidatePath } from 'next/cache';
import type { VoteCounts } from '@/lib/content/schemas';
import { ensureAnonId } from './anon-id';
import { createAdminClient } from '@/lib/supabase/admin';

export type CastVoteResult =
  | { ok: true; counts: VoteCounts; alreadyVoted: boolean }
  | { ok: false; reason: 'no_supabase' | 'server_error' };

/**
 * Enregistre le vote anonyme de l'utilisateur courant.
 *
 * - L'anti-double-vote est porté par la contrainte unique (week_id, anon_id).
 *   Une seconde tentative est silencieuse côté API mais signalée à l'UI via
 *   `alreadyVoted = true` (pour qu'elle reste sur l'affichage "voté").
 * - On renvoie systématiquement les compteurs frais pour synchroniser le
 *   client (qui peut avoir une vue optimiste légèrement périmée).
 */
export async function castVote(weekId: string, optionId: string): Promise<CastVoteResult> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, reason: 'no_supabase' };

  const anonId = await ensureAnonId();

  const { error: insertError } = await supabase
    .from('landing_vote_responses')
    .insert({ week_id: weekId, option_id: optionId, anon_id: anonId });

  // 23505 = unique violation (a déjà voté cette semaine). On le traite comme
  // un succès idempotent.
  const alreadyVoted = insertError?.code === '23505';
  if (insertError && !alreadyVoted) {
    return { ok: false, reason: 'server_error' };
  }

  const { data, error: countsError } = await supabase
    .from('landing_vote_results')
    .select('option_id, votes')
    .eq('week_id', weekId);

  if (countsError || !data) {
    return { ok: false, reason: 'server_error' };
  }

  // Revalidate la page d'accueil pour que le SSR voit les nouveaux totaux à
  // la prochaine visite (compteurs cohérents partout).
  revalidatePath('/');

  return {
    ok: true,
    counts: Object.fromEntries(data.map((r) => [r.option_id, r.votes])),
    alreadyVoted,
  };
}
