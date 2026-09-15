'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { caseKeyForType, validateDrafts } from '@/lib/catalogue-types';
import { createMobileClient } from '@/lib/supabase/mobile';
import { STORAGE_CACHE_CONTROL } from '@/lib/storage';
import { findWikimediaImages } from '@/lib/wikimedia';

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

const suggestionIdSchema = z.object({
  suggestionId: z.string().uuid(),
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
  // Description Wikidata (« film de Christopher Nolan », « commune de
  // France »). Optionnelle : les Edge Functions déployées avant septembre
  // 2026 ne la renvoient pas.
  description?: string | null;
  attribution: string | null;
  licenseCode: string | null;
};

export type AnyItemMatch = {
  id: string;
  title: string;
  typeLabel: string;
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
 * Cherche les items validés proches d'un item donné, dans **son type**.
 * Utilisé pour proposer une fusion plutôt qu'une validation en doublon :
 * depuis le chantier 15, une Personne proposée comme artiste retrouve aussi
 * le créateur du même nom.
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

  const { data: item, error: itemErr } = await mobile
    .from('items')
    .select('id, title, type_id')
    .eq('id', parsed.data.itemId)
    .maybeSingle();
  if (itemErr || !item) return { ok: false, error: itemErr?.message ?? 'Item introuvable' };

  // La fonction prend une clé de case, dont elle cherche le type : on prend
  // une case qui porte le type de l'item. Un type sans case, un livre par
  // exemple, attendra la recherche par type du chantier 13.
  const caseKey = await caseKeyForType(mobile, item.type_id);
  if (!caseKey) {
    return {
      ok: false,
      error: 'Type sans case dans le bento principal : recherche de similaires indisponible pour l’instant.',
    };
  }

  const { data, error } = await mobile.rpc('find_similar_items', {
    q: item.title,
    category_key: caseKey,
    threshold: 0.25,
    lim: 6,
  });
  if (error) return { ok: false, error: error.message };

  const candidates: SimilarCandidate[] = (data ?? [])
    .filter((r) => r.id !== item.id)
    .slice(0, 5)
    .map((r) => ({
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
 * Valide des brouillons en une fois, depuis le tableau du catalogue.
 * Seuls les brouillons passent ; un item refusé ou fusionné ne revient pas par
 * cette porte. Renvoie le nombre d'items réellement validés.
 */
export async function validateDraftsAction(input: {
  itemIds: string[];
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  const parsed = z.object({ itemIds: z.array(z.string().uuid()).min(1).max(500) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Sélection invalide' };

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const res = await validateDrafts(mobile, parsed.data.itemIds, admin.userId);
  if (!res.ok) return res;
  revalidatePath('/catalogue');
  revalidatePath('/catalogue/types');
  return { ok: true, count: res.value };
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
 * Cherche jusqu'à 3 illustrations réutilisables pour un item, sur
 * Wikipedia / Wikimedia Commons. Ne touche pas à la BDD : c'est
 * `acceptImageSuggestion` qui finalise le choix de l'admin.
 *
 * La recherche tournait auparavant dans l'Edge Function Supabase
 * `suggest-item-image`. Elle est revenue ici parce qu'elle n'a besoin
 * d'aucun secret ni d'aucun accès base : la garder côté Next évite un
 * artefact à déployer séparément, et le correctif de licence (filtre
 * Commons) part avec le déploiement du BO au lieu d'attendre un
 * `supabase functions deploy`.
 */
export async function suggestImageForItem(input: {
  itemId: string;
}): Promise<{ ok: true; candidates: WikiImageCandidate[] } | { ok: false; error: string }> {
  await requireAdmin();
  const parsed = itemIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'itemId invalide' };

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const { data: item, error } = await mobile
    .from('items')
    .select('title, category_id, type_id')
    .eq('id', parsed.data.itemId)
    .maybeSingle();
  if (error || !item) return { ok: false, error: error?.message ?? 'Item introuvable' };

  // La case d'origine sert d'indice de recherche (« Seven film ») : c'est ce
  // qui écarte les homonymes dès la requête. Un item sans case prend l'indice
  // de son type, un livre par exemple.
  const { data: hint } =
    item.category_id === null
      ? await mobile.from('item_types').select('key').eq('id', item.type_id).maybeSingle()
      : await mobile
          .from('bento_categories')
          .select('key')
          .eq('id', item.category_id)
          .maybeSingle();

  try {
    const candidates = await findWikimediaImages(item.title, hint?.key ?? null);
    return { ok: true, candidates };
  } catch (e) {
    return { ok: false, error: `Recherche Wikimedia : ${(e as Error).message}` };
  }
}

/**
 * Recherche libre dans le catalogue, tous statuts confondus (sauf merged).
 * Utilisée par la barre de recherche de /catalogue, et par la fusion d'une
 * fiche, qui la restreint au type de l'item et s'exclut elle-même.
 */
export async function searchAnyItems(input: {
  q: string;
  typeId?: number;
  excludeId?: string;
}): Promise<{ ok: true; matches: AnyItemMatch[] } | { ok: false; error: string }> {
  await requireAdmin();
  const q = input.q.trim();
  if (q.length < 2) return { ok: true, matches: [] };

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  let query = mobile
    .from('items')
    .select('id, title, status, type_id')
    .neq('status', 'merged')
    .ilike('title', `%${q}%`);
  if (input.typeId !== undefined) query = query.eq('type_id', input.typeId);
  if (input.excludeId) query = query.neq('id', input.excludeId);
  const { data, error } = await query.order('title').limit(15);
  if (error) return { ok: false, error: error.message };

  const { data: types } = await mobile.from('item_types').select('id, label_fr');
  const labelById = new Map((types ?? []).map((t) => [t.id, t.label_fr]));

  const matches: AnyItemMatch[] = (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    typeLabel: labelById.get(r.type_id) ?? '?',
    status: r.status as AnyItemMatch['status'],
  }));
  return { ok: true, matches };
}

/**
 * Cœur du « je retiens cette image » : télécharge depuis Wikimedia, pousse
 * dans `item-images/{itemId}/main.{ext}` et met à jour l'item. Partagé par
 * l'acceptation à la volée (`acceptImageSuggestion`, recherche live depuis
 * la file de modération) et par la revue des suggestions déjà stockées
 * (`acceptStoredSuggestion`), pour qu'une image arrive toujours dans le
 * bucket de la même façon.
 */
async function storeImageFromWikimedia(
  mobile: NonNullable<ReturnType<typeof createMobileClient>>,
  input: { itemId: string; sourceUrl: string; attribution: string | null },
): Promise<ActionResult> {
  // 1. Télécharge l'image depuis Wikimedia côté serveur. User-agent custom
  //    pour respecter les règles d'usage Wikimedia (sinon 403 sur certains
  //    fichiers).
  let imageResponse: Response;
  try {
    imageResponse = await fetch(input.sourceUrl, {
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
  const path = `${input.itemId}/main.${ext}`;
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
    return { ok: false, error: "Impossible de générer l'URL publique" };
  }

  // 4. Met à jour l'item. On ajoute `?v={ts}` à l'URL pour bust les caches
  //    aval (CDN, React Native Image cache) quand l'admin remplace l'image.
  const bustedUrl = `${urlData.publicUrl}?v=${Date.now()}`;
  const { error: updateErr } = await mobile
    .from('items')
    .update({
      image_url: bustedUrl,
      image_credit: input.attribution,
    })
    .eq('id', input.itemId);
  if (updateErr) return { ok: false, error: `Update item : ${updateErr.message}` };

  return { ok: true };
}

/**
 * Acceptation d'un candidat trouvé en direct (panneau Wikipedia de la file
 * de modération) : stocke l'image et repose l'attribution sur l'item. Rien
 * n'est écrit dans `item_image_suggestions`, ce chemin ne passe pas par la
 * file de revue.
 */
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

  const stored = await storeImageFromWikimedia(mobile, {
    itemId: parsed.data.itemId,
    sourceUrl: parsed.data.sourceUrl,
    attribution: parsed.data.attribution,
  });
  if (!stored.ok) return stored;

  revalidatePath('/catalogue');
  return { ok: true };
}

/**
 * Accepte une suggestion déjà en base (produite par le script
 * `catalog-images.mjs`). Même effet que l'acceptation live, plus la mise à
 * jour du cycle de vie de la suggestion : celle retenue passe `accepted`,
 * les autres candidates du même item passent `dismissed` pour sortir de la
 * file de revue.
 */
export async function acceptStoredSuggestion(input: {
  suggestionId: string;
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = suggestionIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'suggestionId invalide' };

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const { data: suggestion, error: readErr } = await mobile
    .from('item_image_suggestions')
    .select('id, item_id, source_url, attribution')
    .eq('id', parsed.data.suggestionId)
    .maybeSingle();
  if (readErr || !suggestion) {
    return { ok: false, error: readErr?.message ?? 'Suggestion introuvable' };
  }

  const stored = await storeImageFromWikimedia(mobile, {
    itemId: suggestion.item_id,
    sourceUrl: suggestion.source_url,
    attribution: suggestion.attribution,
  });
  if (!stored.ok) return stored;

  await mobile
    .from('item_image_suggestions')
    .update({ status: 'dismissed' })
    .eq('item_id', suggestion.item_id)
    .eq('status', 'pending');
  const { error: markErr } = await mobile
    .from('item_image_suggestions')
    .update({ status: 'accepted' })
    .eq('id', suggestion.id);
  if (markErr) return { ok: false, error: markErr.message };

  revalidatePath('/catalogue/illustrations');
  revalidatePath('/catalogue');
  return { ok: true };
}

/**
 * Écarte toutes les suggestions en attente d'un item : aucune ne convenait.
 * L'item reste sans image, l'admin pourra en uploader une à la main depuis
 * sa fiche.
 */
export async function dismissItemSuggestions(input: { itemId: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = itemIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'itemId invalide' };

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré' };

  const { error } = await mobile
    .from('item_image_suggestions')
    .update({ status: 'dismissed' })
    .eq('item_id', parsed.data.itemId)
    .eq('status', 'pending');
  if (error) return { ok: false, error: error.message };

  revalidatePath('/catalogue/illustrations');
  return { ok: true };
}
