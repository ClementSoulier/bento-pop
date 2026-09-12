'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { CATEGORY_IDS, CATEGORY_ORDER } from '@bento-pop/supabase-mobile/bento';
import type { CategoryKey } from '@bento-pop/supabase-mobile/types';
import { requireAdmin } from '@/lib/auth';
import { createMobileClient } from '@/lib/supabase/mobile';
import { DISPLAY_NAME_MAX, checkPseudoShape, explainWriteFailure, normalizeDisplayName } from '@/lib/pseudo-rules';

export type FoundItem = {
  id: string;
  title: string;
  subtitle: string | null;
  year: number | null;
  imageUrl: string | null;
};

/**
 * Cherche un item du catalogue, avec la fonction que l'app utilise déjà.
 *
 * Passer par `search_items` plutôt que par un `ilike` maison n'est pas une
 * commodité : c'est ce qui garantit que l'équipe voit **le même catalogue,
 * classé pareil**, que ce que voit quelqu'un dans l'app. Un bento éditorial
 * composé sur d'autres résultats contiendrait des items que personne ne
 * retrouve.
 */
export async function searchCatalogItems(
  category: CategoryKey,
  query: string,
): Promise<FoundItem[]> {
  await requireAdmin();
  const q = query.trim();
  if (q.length < 2) return [];

  const mobile = createMobileClient();
  if (!mobile) return [];

  const { data, error } = await mobile.rpc('search_items', {
    q,
    category_key: category,
    lim: 12,
  });
  if (error) return [];

  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    year: r.year,
    imageUrl: r.image_url,
  }));
}

const createSchema = z.object({
  pseudo: z.string().min(1).max(64),
  displayName: z.string().max(200),
  slots: z.record(z.string(), z.string().uuid()),
  publish: z.boolean(),
  featured: z.boolean(),
});

export type CreateResult =
  | { ok: true; userId: string; pseudo: string }
  | { ok: false; error: string };

/**
 * Crée un profil éditorial et son bento.
 *
 * **Aucun compte d'authentification n'est créé**, et c'est tout l'objet de la
 * migration `20260913000000` : en créer un exigerait un email inventé, qui
 * gonflerait le compteur d'installations avec quelqu'un qui n'a jamais
 * installé l'app.
 *
 * ─── L'ordre des écritures, et ce qu'il protège ───────────────────────
 *
 * Trois insertions se suivent sans transaction commune, PostgREST n'en
 * offrant pas. L'ordre est donc choisi pour que chaque interruption laisse un
 * état **invisible du public** :
 *
 *   1. le profil, qui échoue le plus souvent (pseudo pris, mal formé,
 *      bloqué) et n'a alors rien créé du tout ;
 *   2. le bento, **toujours en brouillon** ;
 *   3. les six cases, en une seule insertion : Postgres la traite comme une
 *      unité, donc les six passent ou aucune ;
 *   4. la publication et la mise en avant, **en dernier**.
 *
 * Publier en dernier est ce qui compte : un échec en cours de route laisse au
 * pire un brouillon incomplet, que personne ne voit et que la liste des
 * utilisateurs permet de supprimer. L'ordre inverse aurait pu exposer un
 * bento à trois cases dans le fil.
 */
export async function createEditorialBento(input: {
  pseudo: string;
  displayName: string;
  slots: Record<string, string>;
  publish: boolean;
  featured: boolean;
}): Promise<CreateResult> {
  await requireAdmin();

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Champs invalides' };
  }

  const pseudo = parsed.data.pseudo.trim();
  const shape = checkPseudoShape(pseudo);
  if (!shape.ok) return { ok: false, error: shape.message };

  const displayName = normalizeDisplayName(parsed.data.displayName);
  if (displayName !== null && displayName.length > DISPLAY_NAME_MAX) {
    return { ok: false, error: `Le nom affiché fait ${DISPLAY_NAME_MAX} caractères au maximum.` };
  }

  const chosen = CATEGORY_ORDER.filter((c) => parsed.data.slots[c]);
  if (chosen.length === 0) {
    return { ok: false, error: 'Choisis au moins une case.' };
  }
  if (parsed.data.publish && chosen.length < CATEGORY_ORDER.length) {
    // Même règle que l'app : on ne publie pas un bento incomplet, sans quoi
    // le fil montrerait des cases vides sur un contenu mis en avant.
    return { ok: false, error: 'Un bento se publie complet : il manque des cases.' };
  }

  const mobile = createMobileClient();
  if (!mobile) {
    return {
      ok: false,
      error: 'Supabase mobile non configuré (MOBILE_SUPABASE_URL / MOBILE_SUPABASE_SERVICE_ROLE_KEY).',
    };
  }

  // 1. Le profil. `kind: 'editorial'` et pas de `terms_accepted_at` : la
  //    contrainte `users_editorial_has_no_terms` refuserait le contraire.
  const { data: profile, error: profileError } = await mobile
    .from('users')
    .insert({ pseudo, display_name: displayName, kind: 'editorial' })
    .select('id')
    .single();
  if (profileError || !profile) {
    return { ok: false, error: explainWriteFailure(profileError ?? {}) };
  }

  // 2. Le bento, en brouillon quoi qu'il arrive.
  const { data: bento, error: bentoError } = await mobile
    .from('bentos')
    .insert({ user_id: profile.id })
    .select('id')
    .single();
  if (bentoError || !bento) {
    return { ok: false, error: `Profil créé, mais le bento a échoué : ${bentoError?.message ?? 'inconnu'}` };
  }

  // 3. Les cases, en une insertion.
  const { error: itemsError } = await mobile.from('bento_items').insert(
    chosen.map((cat) => ({
      bento_id: bento.id,
      category_id: CATEGORY_IDS[cat],
      item_id: parsed.data.slots[cat]!,
    })),
  );
  if (itemsError) {
    return { ok: false, error: `Bento créé en brouillon, mais les cases ont échoué : ${itemsError.message}` };
  }

  // 4. Publication et mise en avant, seulement une fois le reste en place.
  if (parsed.data.publish || parsed.data.featured) {
    const { error: publishError } = await mobile
      .from('bentos')
      .update({
        published_at: parsed.data.publish ? new Date().toISOString() : null,
        is_featured: parsed.data.featured,
      })
      .eq('id', bento.id);
    if (publishError) {
      return { ok: false, error: `Bento créé en brouillon, mais la publication a échoué : ${publishError.message}` };
    }
  }

  revalidatePath('/utilisateurs');
  revalidatePath('/bentos');
  return { ok: true, userId: profile.id, pseudo };
}
