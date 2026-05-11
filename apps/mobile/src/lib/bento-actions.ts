import { supabase } from '@/supabase/client';
import type { CategoryKey } from '@/supabase/types';
import type { SearchResult } from '@/api/types';

/**
 * Mapping `CategoryKey` → ID dans `bento_categories` (smallint).
 * En MVP on hardcode (5 IDs après le seed initial), à charger depuis BDD
 * si on rend les catégories vraiment évolutives en runtime.
 */
const CATEGORY_IDS: Record<CategoryKey, number> = {
  film: 1,
  series: 2,
  artist: 3,
  track: 4,
  creator: 5,
  place: 6,
};

/**
 * Trouve un item existant correspondant à un résultat de recherche, ou le
 * crée. Le catalogue `items` est mutualisé : si Alice a déjà choisi « Dune »
 * sur TMDb, Bob réutilise la même ligne (dedup via UNIQUE (source, external_id)).
 */
export async function upsertItem(
  result: SearchResult,
  category: CategoryKey,
): Promise<string> {
  // 1. Lookup
  const { data: existing } = await supabase
    .from('items')
    .select('id')
    .eq('external_source', result.source)
    .eq('external_id', result.externalId)
    .maybeSingle();
  if (existing) return existing.id;

  // 2. Insertion
  const { data: inserted, error } = await supabase
    .from('items')
    .insert({
      category_id: CATEGORY_IDS[category],
      external_source: result.source,
      external_id: result.externalId,
      title: result.title,
      subtitle: result.subtitle ?? null,
      year: result.year ?? null,
      image_url: result.imageUrl ?? null,
      metadata: (result.raw ?? {}) as Record<string, unknown>,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    throw new Error(`Item insert failed: ${error?.message ?? 'unknown'}`);
  }
  return inserted.id;
}

/**
 * S'assure que l'utilisateur a un bento (en crée un vide sinon).
 * Renvoie l'ID du bento.
 */
export async function ensureBento(userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('bentos')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('bentos')
    .insert({ user_id: userId })
    .select('id')
    .single();
  if (error || !created) {
    throw new Error(`Bento create failed: ${error?.message ?? 'unknown'}`);
  }
  return created.id;
}

/**
 * Affecte (ou remplace) l'item d'une case du bento. Upsert sur la PK
 * composite `(bento_id, category_id)`.
 */
export async function setBentoSlot(
  bentoId: string,
  category: CategoryKey,
  itemId: string,
): Promise<void> {
  const { error } = await supabase
    .from('bento_items')
    .upsert(
      {
        bento_id: bentoId,
        category_id: CATEGORY_IDS[category],
        item_id: itemId,
      },
      { onConflict: 'bento_id,category_id' },
    );
  if (error) {
    throw new Error(`Slot upsert failed: ${error.message}`);
  }
}

/** Publie un bento (set `published_at = now()` si pas déjà publié). */
export async function publishBento(bentoId: string): Promise<void> {
  const { error } = await supabase
    .from('bentos')
    .update({ published_at: new Date().toISOString() })
    .eq('id', bentoId);
  if (error) throw new Error(`Publish failed: ${error.message}`);
}

/**
 * Vide une case du bento : supprime la ligne `bento_items` pour la
 * catégorie donnée. L'item lui-même reste dans le catalogue mutualisé.
 */
export async function clearBentoSlot(
  bentoId: string,
  category: CategoryKey,
): Promise<void> {
  const { error } = await supabase
    .from('bento_items')
    .delete()
    .eq('bento_id', bentoId)
    .eq('category_id', CATEGORY_IDS[category]);
  if (error) throw new Error(`Clear slot failed: ${error.message}`);
}

/**
 * Charge le bento de l'utilisateur (slots + items joints) pour hydrater le
 * store local au démarrage.
 */
export async function loadOwnBento(userId: string) {
  const { data, error } = await supabase
    .from('bentos')
    .select(
      `
      id,
      published_at,
      bento_items (
        category_id,
        item_id,
        items ( id, title, subtitle, image_url, external_source, external_id )
      )
      `,
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`Bento load failed: ${error.message}`);
  return data;
}

/**
 * Charge un bento publié par pseudo (lecture publique via RLS).
 * Retourne `null` si le pseudo n'existe pas ou si le bento n'est pas publié.
 */
export async function loadPublicBentoByPseudo(pseudo: string) {
  const { data: user } = await supabase
    .from('users')
    .select('id, pseudo, display_name, created_at')
    .ilike('pseudo', pseudo)
    .maybeSingle();
  if (!user) return null;

  const { data: bento } = await supabase
    .from('bentos')
    .select(
      `
      id,
      published_at,
      is_featured,
      bento_items (
        category_id,
        items ( id, title, subtitle, year, image_url, external_source, external_id )
      )
      `,
    )
    .eq('user_id', user.id)
    .not('published_at', 'is', null)
    .maybeSingle();
  if (!bento) return null;

  return { user, bento };
}
