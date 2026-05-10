'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

const STATUS_LABELS = {
  live: 'En direct',
  soon: 'Prochainement',
  done: 'Replay dispo',
} as const;

const eventSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, 'Titre requis').max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date YYYY-MM-DD requise'),
  place: z.string().trim().min(1, 'Lieu requis').max(200),
  stand: z.string().trim().max(200).default(''),
  status: z.enum(['live', 'soon', 'done']),
  replay_url: z.string().trim().url('URL invalide').or(z.literal('')).optional(),
  display_order: z.coerce.number().int().min(0).default(0),
});

export type EventFormPayload = z.infer<typeof eventSchema>;

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath('/');
  revalidatePath('/events');
}

export async function saveEvent(input: EventFormPayload): Promise<ActionResult> {
  await requireAdmin();
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Champs invalides' };
  }
  const supabase = await createServerClient();
  const status = parsed.data.status;
  const row = {
    date: parsed.data.date,
    title: parsed.data.title,
    place: parsed.data.place,
    stand: parsed.data.stand,
    status,
    status_label: STATUS_LABELS[status],
    replay_url: parsed.data.replay_url || null,
    display_order: parsed.data.display_order,
  };

  const { error } = parsed.data.id
    ? await supabase.from('landing_events').update(row as never).eq('id', parsed.data.id)
    : await supabase.from('landing_events').insert(row as never);

  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createServerClient();
  const { error } = await supabase.from('landing_events').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
