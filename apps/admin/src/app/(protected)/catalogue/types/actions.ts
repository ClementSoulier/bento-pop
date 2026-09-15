'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createItemType, setItemTypeActive, updateItemType } from '@/lib/catalogue-types';
import { createMobileClient } from '@/lib/supabase/mobile';

export type ActionResult = { ok: true } | { ok: false; error: string };

const createSchema = z.object({
  key: z.string(),
  label: z.string(),
  order: z.coerce.number(),
});

const updateSchema = z.object({
  id: z.number().int().positive(),
  label: z.string(),
  order: z.coerce.number(),
});

const activeSchema = z.object({
  id: z.number().int().positive(),
  active: z.boolean(),
});

function refresh() {
  revalidatePath('/catalogue/types');
  revalidatePath('/catalogue');
}

/**
 * Crée un type, **inactif** : il n'apparaît dans l'app qu'une fois activé, et
 * se remplit d'abord de brouillons validés ici. La validation fine (format de
 * la clé, longueur du libellé) vit dans `lib/catalogue-types.ts`, testée.
 */
export async function createTypeAction(input: {
  key: string;
  label: string;
  order: number;
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Inputs invalides' };
  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const res = await createItemType(mobile, parsed.data);
  if (!res.ok) return res;
  refresh();
  return { ok: true };
}

/** Libellé et ordre. La clé, définitive, ne se modifie pas. */
export async function updateTypeAction(input: {
  id: number;
  label: string;
  order: number;
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Inputs invalides' };
  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const res = await updateItemType(mobile, parsed.data.id, parsed.data);
  if (!res.ok) return res;
  refresh();
  return { ok: true };
}

/**
 * Active ou désactive. Un type porté par une case du bento principal ne se
 * désactive pas : sa recherche serait vide dans toutes les versions de l'app.
 */
export async function setTypeActiveAction(input: {
  id: number;
  active: boolean;
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = activeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Inputs invalides' };
  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const res = await setItemTypeActive(mobile, parsed.data.id, parsed.data.active);
  if (!res.ok) return res;
  refresh();
  return { ok: true };
}
