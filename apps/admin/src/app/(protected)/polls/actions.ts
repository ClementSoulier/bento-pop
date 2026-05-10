'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

const optionSchema = z.object({
  id: z.string().trim().min(1, 'ID requis').max(40),
  label: z.string().trim().min(1, 'Libellé requis').max(120),
});

const pollSchema = z.object({
  id: z.string().uuid().optional(),
  week_tag: z.string().trim().min(1, 'Tag requis').max(80),
  question: z.string().trim().min(1, 'Question requise').max(280),
  options: z.array(optionSchema).min(2, 'Au moins 2 options').max(8),
  ends_at: z.string().min(1, 'Date de clôture requise'),
});

export type PollFormPayload = z.infer<typeof pollSchema>;

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath('/');
  revalidatePath('/polls');
}

export async function savePoll(input: PollFormPayload): Promise<ActionResult> {
  await requireAdmin();
  const parsed = pollSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Champs invalides' };
  }
  // IDs d'options uniques
  const ids = new Set(parsed.data.options.map((o) => o.id));
  if (ids.size !== parsed.data.options.length) {
    return { ok: false, error: 'Les IDs d\'options doivent être uniques.' };
  }

  const supabase = await createServerClient();
  const row = {
    week_tag: parsed.data.week_tag,
    question: parsed.data.question,
    options: parsed.data.options,
    ends_at: parsed.data.ends_at,
  };

  const { error } = parsed.data.id
    ? await supabase.from('landing_vote_weeks').update(row as never).eq('id', parsed.data.id)
    : await supabase.from('landing_vote_weeks').insert(row as never);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/**
 * Publie une semaine : la passe en is_current=true et démarque toutes les
 * autres. La contrainte unique partielle interdit deux semaines courantes
 * en simultané, on désactive donc d'abord les autres.
 */
export async function publishPoll(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createServerClient();
  const { error: clearErr } = await supabase
    .from('landing_vote_weeks')
    .update({ is_current: false } as never)
    .eq('is_current', true);
  if (clearErr) return { ok: false, error: clearErr.message };
  const { error } = await supabase
    .from('landing_vote_weeks')
    .update({ is_current: true } as never)
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function archivePoll(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from('landing_vote_weeks')
    .update({ is_current: false } as never)
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deletePoll(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createServerClient();
  const { error } = await supabase.from('landing_vote_weeks').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
