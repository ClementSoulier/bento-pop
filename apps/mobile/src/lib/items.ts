import { supabase } from '@/supabase/client';
import type { CategoryKey } from '@/supabase/types';

/**
 * Wrapper sur le catalogue maison (table `items`) côté mobile.
 *
 * Remplace les anciens appels TMDb / MusicBrainz / Wikidata / OSM. La
 * recherche tape `search_items` (RPC SQL), la soumission insère une
 * ligne `items` avec `external_source='user'` → le trigger SQL force
 * `status='pending'` et remplit `submitted_by/submitted_at`.
 */

export type ItemSearchResult = {
  id: string;
  title: string;
  subtitle: string | null;
  year: number | null;
  imageUrl: string | null;
  imageCredit: string | null;
  score: number;
};

export type SimilarItem = {
  id: string;
  title: string;
  subtitle: string | null;
  year: number | null;
  imageUrl: string | null;
  score: number;
};

const CATEGORY_IDS: Record<CategoryKey, number> = {
  film: 1,
  series: 2,
  artist: 3,
  track: 4,
  creator: 5,
  place: 6,
};

/**
 * Recherche fuzzy dans le catalogue validé. Retour vide si query trop
 * courte (évite de spammer Supabase pendant que l'utilisateur tape une
 * seule lettre — la borne basse côté SQL filtrerait quand même mais
 * autant économiser le round-trip).
 */
export async function searchItems(
  category: CategoryKey,
  query: string,
): Promise<ItemSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const { data, error } = await supabase.rpc('search_items', {
    q,
    category_key: category,
    lim: 20,
  });
  if (error) throw new Error(`Search failed: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    year: r.year,
    imageUrl: r.image_url,
    imageCredit: r.image_credit,
    score: r.score,
  }));
}

/**
 * Cherche les items validés proches d'une chaîne, pour le popup
 * anti-doublon AVANT soumission user. Threshold 0.4 par défaut côté SQL.
 */
export async function findSimilarItems(
  category: CategoryKey,
  query: string,
): Promise<SimilarItem[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const { data, error } = await supabase.rpc('find_similar_items', {
    q,
    category_key: category,
  });
  if (error) throw new Error(`Similar lookup failed: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    year: r.year,
    imageUrl: r.image_url,
    score: r.score,
  }));
}

/**
 * Soumet un item proposé par l'utilisateur. Le trigger SQL force
 * `status='pending'` et remplit `submitted_by` depuis `auth.uid()`.
 * Retourne l'ID du nouvel item (à utiliser pour `setBentoSlot`).
 *
 * Anti-spam basique côté client : trim + min length. Le serveur a déjà
 * une contrainte NOT NULL sur title mais on évite l'aller-retour pour
 * une chaîne vide.
 */
export async function submitItem(
  category: CategoryKey,
  rawTitle: string,
): Promise<string> {
  const title = rawTitle.trim();
  if (title.length < 2) {
    throw new Error('Titre trop court.');
  }
  const { data, error } = await supabase
    .from('items')
    .insert({
      category_id: CATEGORY_IDS[category],
      external_source: 'user',
      title,
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(`Soumission échouée : ${error?.message ?? 'inconnue'}`);
  }
  return data.id;
}
