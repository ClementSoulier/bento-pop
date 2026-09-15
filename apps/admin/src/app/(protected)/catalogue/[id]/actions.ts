'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { changeItemType, validateDrafts } from '@/lib/catalogue-types';
import { createMobileClient } from '@/lib/supabase/mobile';
import { STORAGE_CACHE_CONTROL } from '@/lib/storage';

export type ActionResult = { ok: true } | { ok: false; error: string };

const itemIdSchema = z.object({ itemId: z.string().uuid() });

const updateMetaSchema = z.object({
  itemId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(280).nullable(),
  year: z.coerce.number().int().min(0).max(9999).nullable(),
});

const aliasSchema = z.object({
  itemId: z.string().uuid(),
  alias: z.string().trim().min(1).max(200),
});

const aliasIdSchema = z.object({ aliasId: z.string().uuid() });

const uploadImageSchema = z.object({
  itemId: z.string().uuid(),
  attribution: z.string().trim().max(500).nullable(),
});

const createDraftSchema = z.object({
  typeKey: z.string().regex(/^[a-z][a-z0-9_]{2,19}$/),
  title: z.string().trim().min(1).max(200),
});

const changeTypeSchema = z.object({
  itemId: z.string().uuid(),
  typeId: z.number().int().positive(),
});

/** Met à jour titre/sous-titre/année d'un item. Status inchangé. */
export async function updateItemMeta(input: {
  itemId: string;
  title: string;
  subtitle: string | null;
  year: number | null;
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = updateMetaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Inputs invalides' };
  }
  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const { error } = await mobile
    .from('items')
    .update({
      title: parsed.data.title,
      subtitle: parsed.data.subtitle,
      year: parsed.data.year,
    })
    .eq('id', parsed.data.itemId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/catalogue/${parsed.data.itemId}`);
  revalidatePath('/catalogue');
  return { ok: true };
}

export async function addAlias(input: {
  itemId: string;
  alias: string;
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = aliasSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Inputs invalides' };
  }
  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const { error } = await mobile.from('item_aliases').insert({
    item_id: parsed.data.itemId,
    alias: parsed.data.alias,
  });
  if (error) {
    // 23505 = unique violation : on traite le doublon silencieusement.
    if (error.code === '23505') {
      return { ok: false, error: 'Cet alias existe déjà.' };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath(`/catalogue/${parsed.data.itemId}`);
  return { ok: true };
}

export async function deleteAlias(input: { aliasId: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = aliasIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'aliasId invalide' };

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  // On récupère l'item_id avant suppression pour revalider proprement.
  const { data: alias } = await mobile
    .from('item_aliases')
    .select('item_id')
    .eq('id', parsed.data.aliasId)
    .maybeSingle();

  const { error } = await mobile
    .from('item_aliases')
    .delete()
    .eq('id', parsed.data.aliasId);
  if (error) return { ok: false, error: error.message };

  if (alias?.item_id) revalidatePath(`/catalogue/${alias.item_id}`);
  return { ok: true };
}

/**
 * Upload manuel d'une image pour un item. Reçoit FormData contenant
 * `file` (le binaire) + `attribution` (texte, optionnel). Pour l'upload
 * via fetch côté client : `formData.append('file', fileBlob); formData.append('attribution', '...')`.
 */
export async function uploadItemImage(itemId: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const file = formData.get('file');
  const attribution = formData.get('attribution');

  const parsed = uploadImageSchema.safeParse({
    itemId,
    attribution: typeof attribution === 'string' ? attribution.trim() || null : null,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Inputs invalides' };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Fichier manquant ou vide.' };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, error: 'Fichier > 8 Mo : trop lourd pour le bucket.' };
  }
  if (!file.type.startsWith('image/')) {
    return { ok: false, error: 'Le fichier doit être une image.' };
  }

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const ext = file.type.includes('png')
    ? 'png'
    : file.type.includes('webp')
      ? 'webp'
      : file.type.includes('gif')
        ? 'gif'
        : 'jpg';
  const path = `${parsed.data.itemId}/main.${ext}`;
  const arrayBuf = await file.arrayBuffer();
  const { error: uploadErr } = await mobile.storage
    .from('item-images')
    .upload(path, arrayBuf, {
      contentType: file.type,
      cacheControl: STORAGE_CACHE_CONTROL,
      upsert: true,
    });
  if (uploadErr) return { ok: false, error: `Storage : ${uploadErr.message}` };

  const { data: urlData } = mobile.storage.from('item-images').getPublicUrl(path);
  if (!urlData?.publicUrl) {
    return { ok: false, error: 'Impossible de générer l\'URL publique' };
  }
  const bustedUrl = `${urlData.publicUrl}?v=${Date.now()}`;

  const { error: updateErr } = await mobile
    .from('items')
    .update({
      image_url: bustedUrl,
      image_credit: parsed.data.attribution,
    })
    .eq('id', parsed.data.itemId);
  if (updateErr) return { ok: false, error: `Update item : ${updateErr.message}` };

  revalidatePath(`/catalogue/${parsed.data.itemId}`);
  return { ok: true };
}

/**
 * Retire l'image associée à un item : reset items.image_url + image_credit
 * et supprime le fichier Storage (best-effort, ignore les 404). Le path
 * Storage est `{itemId}/main.{ext}` : on tente les extensions courantes
 * puisqu'on ne stocke pas l'ext en BDD.
 */
export async function removeItemImage(input: { itemId: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = itemIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'itemId invalide' };

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  // Best-effort delete sur les ext courantes (on ne tracke pas l'ext en BDD)
  const paths = ['jpg', 'png', 'webp', 'gif'].map(
    (ext) => `${parsed.data.itemId}/main.${ext}`,
  );
  await mobile.storage.from('item-images').remove(paths);

  const { error: updateErr } = await mobile
    .from('items')
    .update({ image_url: null, image_credit: null })
    .eq('id', parsed.data.itemId);
  if (updateErr) return { ok: false, error: updateErr.message };

  revalidatePath(`/catalogue/${parsed.data.itemId}`);
  return { ok: true };
}

/**
 * Crée un item `status='draft'` côté admin (item préparé en interne avant
 * publication), dans un **type**, actif ou non : c'est ainsi qu'on amorce un
 * type avant de l'activer. Sans case d'origine, puisque le type suffit depuis
 * le chantier 15. Redirige vers la fiche d'édition.
 */
export async function createDraftItem(input: { typeKey: string; title: string }): Promise<void> {
  const admin = await requireAdmin();
  const parsed = createDraftSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Inputs invalides');
  }
  const mobile = createMobileClient();
  if (!mobile) throw new Error('Supabase mobile non configuré');

  const { data: type } = await mobile
    .from('item_types')
    .select('id')
    .eq('key', parsed.data.typeKey)
    .maybeSingle();
  if (!type) throw new Error('Type inconnu');

  // Trigger SQL : le service-role garde le statut posé pour external_source='admin'.
  const { data, error } = await mobile
    .from('items')
    .insert({
      type_id: type.id,
      category_id: null,
      external_source: 'admin',
      title: parsed.data.title,
      status: 'draft',
      validated_by: admin.userId,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Insert item : ${error?.message ?? 'inconnu'}`);

  revalidatePath('/catalogue');
  redirect(`/catalogue/${data.id}`);
}

/**
 * Passe un item à un autre type, par exemple « Arcane », proposée comme
 * créateur, vers Série. Refusé tant qu'il est posé dans une case d'un autre
 * type : la fiche le dit avant, la base le garantit.
 */
export async function changeItemTypeAction(input: { itemId: string; typeId: number }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = changeTypeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Inputs invalides' };
  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const res = await changeItemType(mobile, parsed.data.itemId, parsed.data.typeId);
  if (!res.ok) return res;
  revalidatePath(`/catalogue/${parsed.data.itemId}`);
  revalidatePath('/catalogue');
  revalidatePath('/catalogue/types');
  return { ok: true };
}

/** Valide un brouillon depuis sa fiche. */
export async function validateDraftAction(input: { itemId: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = itemIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'itemId invalide' };
  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const res = await validateDrafts(mobile, [parsed.data.itemId], admin.userId);
  if (!res.ok) return res;
  if (res.value === 0) return { ok: false, error: 'Cet item n’est plus un brouillon.' };
  revalidatePath(`/catalogue/${parsed.data.itemId}`);
  revalidatePath('/catalogue');
  return { ok: true };
}
