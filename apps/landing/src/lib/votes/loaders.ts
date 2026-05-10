import { cache } from 'react';
import type { VoteCounts, VoteOption, VoteWeek } from '@/lib/content/schemas';
import { createServerClient } from '@/lib/supabase/server';

/**
 * Charge la semaine courante (is_current=true) depuis Supabase.
 * Retourne `null` si Supabase n'est pas configuré ou si aucune semaine n'est
 * marquée courante — l'appelant bascule alors sur le `fallback` du content.
 */
export const loadCurrentVoteWeek = cache(async (): Promise<VoteWeek | null> => {
  const supabase = await createServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('landing_vote_weeks')
    .select('id, week_tag, question, options, ends_at')
    .eq('is_current', true)
    .maybeSingle();
  if (error || !data) return null;
  // Cast structurel : la vue est typée trop largement par supabase-js,
  // mais le SQL garantit la forme.
  const row = data as unknown as {
    id: string;
    week_tag: string;
    question: string;
    options: VoteOption[];
    ends_at: string;
  };
  return {
    id: row.id,
    weekTag: row.week_tag,
    question: row.question,
    options: row.options,
    closesAt: row.ends_at,
  };
});

/**
 * Charge les compteurs de la semaine donnée depuis la vue agrégée.
 * Retourne `null` si Supabase n'est pas configuré.
 */
export const loadVoteCounts = cache(async (weekId: string): Promise<VoteCounts | null> => {
  const supabase = await createServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('landing_vote_results')
    .select('option_id, votes')
    .eq('week_id', weekId);
  if (error || !data) return null;
  const rows = data as unknown as { option_id: string; votes: number }[];
  return Object.fromEntries(rows.map((r) => [r.option_id, r.votes]));
});
