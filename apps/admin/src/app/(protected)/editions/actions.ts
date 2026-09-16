'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import {
  type EditionCase,
  createEdition,
  deleteEdition,
  saveCases,
  updateEdition,
} from '@/lib/editions';
import { createMobileClient } from '@/lib/supabase/mobile';

export type ActionResult = { ok: true } | { ok: false; error: string };

const editionSchema = z.object({
  title: z.string().min(1).max(80),
  slug: z.string().min(3).max(40),
  releasedAt: z.string().nullable(),
});

const caseSchema = z.object({
  order: z.number().int().min(1).max(6),
  prompt: z.string().min(1).max(120),
  stamp: z.string().min(1).max(8),
  gender: z.enum(['m', 'f']),
  typeId: z.number().int().positive(),
});

function refresh(id?: number) {
  revalidatePath('/editions');
  if (id !== undefined) revalidatePath(`/editions/${id}`);
}

/** Crée une édition, en brouillon ou déjà datée. */
export async function createEditionAction(input: {
  title: string;
  slug: string;
  releasedAt: string | null;
}): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  await requireAdmin();
  const parsed = editionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Inputs invalides' };
  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const res = await createEdition(mobile, parsed.data);
  if (!res.ok) return res;
  refresh(res.value);
  return { ok: true, id: res.value };
}

/** Titre, adresse et date de sortie. */
export async function updateEditionAction(input: {
  id: number;
  title: string;
  slug: string;
  releasedAt: string | null;
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = editionSchema.extend({ id: z.number().int().positive() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Inputs invalides' };
  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const res = await updateEdition(mobile, parsed.data.id, parsed.data);
  if (!res.ok) return res;
  refresh(parsed.data.id);
  return { ok: true };
}

/**
 * Remplace les cases d'une édition.
 *
 * Refusée sur une édition sortie : les cases sont supprimées puis réinsérées,
 * ce qui emporterait en cascade les items déjà posés par les personnes qui
 * l'ont composée.
 */
export async function saveCasesAction(input: {
  id: number;
  cases: EditionCase[];
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({ id: z.number().int().positive(), cases: z.array(caseSchema).min(2).max(6) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Inputs invalides' };
  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const { data, error } = await mobile
    .from('editions')
    .select('released_at')
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Édition introuvable.' };

  const sortie = data.released_at !== null && new Date(data.released_at as string) <= new Date();
  if (sortie) {
    return {
      ok: false,
      error:
        'Cette édition est sortie : ses cases ne se modifient plus. ' +
        'Retire sa date de sortie d’abord, ce qui la masquera de tout le monde.',
    };
  }

  const res = await saveCases(mobile, parsed.data.id, parsed.data.cases);
  if (!res.ok) return res;
  refresh(parsed.data.id);
  return { ok: true };
}

/** Supprime une édition. Refusée si quelqu'un l'a composée. */
export async function deleteEditionAction(id: number): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.number().int().positive().safeParse(id);
  if (!parsed.success) return { ok: false, error: 'Inputs invalides' };
  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const res = await deleteEdition(mobile, parsed.data);
  if (!res.ok) return res;
  refresh();
  return { ok: true };
}
