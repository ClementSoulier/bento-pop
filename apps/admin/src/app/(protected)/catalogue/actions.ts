'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createMobileClient } from '@/lib/supabase/mobile';
import { STORAGE_CACHE_CONTROL } from '@/lib/storage';

const itemIdSchema = z.object({
  itemId: z.string().uuid(),
});

const rejectSchema = z.object({
  itemId: z.string().uuid(),
  reason: z.string().trim().max(280).optional(),
});

const mergeSchema = z.object({
  canonicalId: z.string().uuid(),
  loserIds: z.array(z.string().uuid()).min(1).max(50),
});

const acceptImageSchema = z.object({
  itemId: z.string().uuid(),
  sourceUrl: z.string().url(),
  attribution: z.string().trim().max(500).nullable(),
  licenseCode: z.string().trim().max(50).nullable(),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export type SimilarCandidate = {
  id: string;
  title: string;
  subtitle: string | null;
  year: number | null;
  imageUrl: string | null;
  score: number;
};

export type WikiImageCandidate = {
  sourceUrl: string;
  thumbnailUrl: string;
  wikipediaPageUrl: string;
  pageTitle: string;
  attribution: string | null;
  licenseCode: string | null;
};

export type AnyItemMatch = {
  id: string;
  title: string;
  categoryLabel: string;
  status: 'draft' | 'pending' | 'validated' | 'rejected' | 'merged';
};

/**
 * Valide un item pending : devient visible en recherche pour tous les
 * utilisateurs (RLS items_read passe sur status='validated'). Le trigger
 * SQL `items_touch_lifecycle_on_update` met automatiquement
 * `validated_at`, on remplit juste `validated_by` (uuid admin).
 */
export async function validateItem(input: { itemId: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = itemIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'itemId invalide' };

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const { error } = await mobile
    .from('items')
    .update({
      status: 'validated',
      validated_by: admin.userId,
    })
    .eq('id', parsed.data.itemId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/catalogue');
  return { ok: true };
}

/**
 * Refuse un item pending. Effet utilisateur : les `bento_items` qui
 * pointaient dessus deviennent visuellement vides (RLS items_read
 * exclut les rejected) — l'app mobile affichera un slot vide. La
 * publication du bento reste possible pour l'instant (pas de gate
 * SQL en V1, ça vivra côté UI), mais l'utilisateur verra son slot
 * disparaître au prochain hydrate.
 *
 * `rejected_reason` est optionnel et ne sert pour l'instant qu'à
 * la traçabilité admin (pas de notification user en V1).
 */
export async function rejectItem(input: { itemId: string; reason?: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Inputs invalides' };

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const { error } = await mobile
    .from('items')
    .update({
      status: 'rejected',
      rejected_by: admin.userId,
      rejected_reason: parsed.data.reason ?? null,
    })
    .eq('id', parsed.data.itemId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/catalogue');
  return { ok: true };
}

/**
 * Cherche les items validés proches d'un item pending donné, dans la
 * même catégorie. Utilisé pour proposer un merge plutôt qu'une
 * validation en doublon.
 *
 * Threshold abaissé à 0.25 (vs 0.4 côté user) pour rattraper des fautes
 * de frappe ou orthographes alternatives que l'admin saura juger.
 */
export async function getSimilarsForItem(input: { itemId: string }): Promise<
  { ok: true; candidates: SimilarCandidate[] } | { ok: false; error: string }
> {
  await requireAdmin();
  const parsed = itemIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'itemId invalide' };

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  // 1. Récupère le titre + catégorie de l'item pending
  const { data: item, error: itemErr } = await mobile
    .from('items')
    .select('title, category_id')
    .eq('id', parsed.data.itemId)
    .maybeSingle();
  if (itemErr || !item) return { ok: false, error: itemErr?.message ?? 'Item introuvable' };

  // 2. Trouve la category_key à partir de l'id (la RPC prend une key)
  const { data: category } = await mobile
    .from('bento_categories')
    .select('key')
    .eq('id', item.category_id)
    .maybeSingle();
  if (!category) return { ok: false, error: 'Catégorie introuvable' };

  // 3. RPC find_similar_items avec threshold bas
  const { data, error } = await mobile.rpc('find_similar_items', {
    q: item.title,
    category_key: category.key,
    threshold: 0.25,
    lim: 5,
  });
  if (error) return { ok: false, error: error.message };

  const candidates: SimilarCandidate[] = (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    year: r.year,
    imageUrl: r.image_url,
    score: r.score,
  }));

  return { ok: true, candidates };
}

/**
 * Fusionne un ou plusieurs items pending dans un item canonique validé.
 * Délègue toute la logique transactionnelle à la fonction SQL
 * `admin_merge_items` (réécriture bento_items, aliases, status).
 */
export async function mergeItems(input: {
  canonicalId: string;
  loserIds: string[];
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = mergeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Inputs invalides' };
  }
  if (parsed.data.loserIds.includes(parsed.data.canonicalId)) {
    return { ok: false, error: 'Le canonique ne peut pas être dans les losers.' };
  }

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const { error } = await mobile.rpc('admin_merge_items', {
    canonical_id: parsed.data.canonicalId,
    loser_ids: parsed.data.loserIds,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/catalogue');
  return { ok: true };
}

/**
 * Demande à l'Edge Function `suggest-item-image` 3 candidats Wikipedia
 * pour l'illustration d'un item. La fonction ne touche pas à la BDD,
 * c'est `acceptImageSuggestion` qui finalise le choix de l'admin.
 *
 * Note : `mobile.functions.invoke` utilise l'URL Supabase mobile +
 * la service-role key (les Edge Functions valident le JWT, et le
 * service-role passe).
 */
export async function suggestImageForItem(input: {
  itemId: string;
}): Promise<{ ok: true; candidates: WikiImageCandidate[] } | { ok: false; error: string }> {
  await requireAdmin();
  const parsed = itemIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'itemId invalide' };

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const { data, error } = await mobile.functions.invoke<
    { ok: true; candidates: WikiImageCandidate[] } | { ok: false; error: string }
  >('suggest-item-image', {
    body: { itemId: parsed.data.itemId },
  });
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Réponse vide de l\'Edge Function' };
  return data;
}

/**
 * Finalise une suggestion : télécharge l'image depuis Wikipedia, l'upload
 * dans le bucket Supabase Storage `item-images/{itemId}/main.{ext}`, met
 * à jour `items.image_url` (URL publique du bucket) + `items.image_credit`.
 *
 * Le `licenseCode` est stocké dans la table `item_image_suggestions` à
 * titre de traçabilité légère. Pour V1 on garde uniquement l'attribution
 * affichée + l'image — pas de trace fine de quelle suggestion a été
 * acceptée car le BO reste source de vérité.
 */
/**
 * Recherche libre dans le catalogue, tous statuts confondus (sauf merged).
 * Utilisé par la search bar de la page /catalogue pour retrouver un item
 * et naviguer vers sa fiche d'édition.
 */
export async function searchAnyItems(input: { q: string }): Promise<
  { ok: true; matches: AnyItemMatch[] } | { ok: false; error: string }
> {
  await requireAdmin();
  const q = input.q.trim();
  if (q.length < 2) return { ok: true, matches: [] };

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const { data, error } = await mobile
    .from('items')
    .select('id, title, status, category_id')
    .neq('status', 'merged')
    .ilike('title', `%${q}%`)
    .order('title')
    .limit(15);
  if (error) return { ok: false, error: error.message };

  // Fetch categories pour labels
  const catIds = [...new Set((data ?? []).map((r) => r.category_id))];
  const { data: cats } = catIds.length
    ? await mobile.from('bento_categories').select('id, label_fr').in('id', catIds)
    : { data: [] as { id: number; label_fr: string }[] };
  const labelById = new Map((cats ?? []).map((c) => [c.id, c.label_fr]));

  const matches: AnyItemMatch[] = (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    categoryLabel: labelById.get(r.category_id) ?? '?',
    status: r.status as AnyItemMatch['status'],
  }));
  return { ok: true, matches };
}

export async function acceptImageSuggestion(input: {
  itemId: string;
  sourceUrl: string;
  attribution: string | null;
  licenseCode: string | null;
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = acceptImageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Inputs invalides' };
  }

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  // 1. Télécharge l'image depuis Wikimedia côté serveur. User-agent custom
  //    pour respecter les règles d'usage Wikimedia (sinon 403 sur certains
  //    fichiers).
  let imageResponse: Response;
  try {
    imageResponse = await fetch(parsed.data.sourceUrl, {
      headers: {
        'user-agent': 'BentoPopAdmin/1.0 (https://bento-pop.com; contact@keremaprod.com)',
      },
    });
  } catch (e) {
    return { ok: false, error: `Téléchargement échoué : ${(e as Error).message}` };
  }
  if (!imageResponse.ok) {
    return { ok: false, error: `Wikimedia ${imageResponse.status}` };
  }
  const contentType = imageResponse.headers.get('content-type') ?? 'image/jpeg';
  const ext = contentType.includes('png')
    ? 'png'
    : contentType.includes('webp')
      ? 'webp'
      : contentType.includes('gif')
        ? 'gif'
        : 'jpg';
  const arrayBuf = await imageResponse.arrayBuffer();

  // 2. Upload Storage. `upsert: true` pour écraser une image existante
  //    si l'admin change d'avis (path stable = pas de cache à purger).
  const path = `${parsed.data.itemId}/main.${ext}`;
  const { error: uploadErr } = await mobile.storage
    .from('item-images')
    .upload(path, arrayBuf, {
      contentType,
      cacheControl: STORAGE_CACHE_CONTROL,
      upsert: true,
    });
  if (uploadErr) return { ok: false, error: `Storage : ${uploadErr.message}` };

  // 3. URL publique (bucket public)
  const { data: urlData } = mobile.storage.from('item-images').getPublicUrl(path);
  if (!urlData?.publicUrl) {
    return { ok: false, error: 'Impossible de générer l\'URL publique' };
  }

  // 4. Met à jour l'item. On ajoute `?v={ts}` à l'URL pour bust les caches
  //    aval (CDN, React Native Image cache) quand l'admin remplace l'image.
  const bustedUrl = `${urlData.publicUrl}?v=${Date.now()}`;
  const { error: updateErr } = await mobile
    .from('items')
    .update({
      image_url: bustedUrl,
      image_credit: parsed.data.attribution,
    })
    .eq('id', parsed.data.itemId);
  if (updateErr) return { ok: false, error: `Update item : ${updateErr.message}` };

  revalidatePath('/catalogue');
  return { ok: true };
}
