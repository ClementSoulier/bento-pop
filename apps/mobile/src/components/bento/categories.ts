import type { CategoryKey } from '@/supabase/types';

/**
 * Métadonnées affichables des 6 catégories MVP — labels FR + stamp tout-caps.
 * Doit rester aligné avec le seed de `bento_categories` (cf. migration
 * `supabase/migrations/20260511000000_initial_schema.sql`).
 *
 * À terme : peut être chargé depuis la BDD pour rester évolutif sans
 * redéploiement (P3+).
 */
export const CATEGORY_META: Record<CategoryKey, { label: string; stamp: string }> = {
  film:    { label: 'Film',                stamp: 'FILM' },
  series:  { label: 'Série',               stamp: 'SÉRIE' },
  artist:  { label: 'Artiste',             stamp: 'ARTISTE' },
  track:   { label: 'Chanson',             stamp: 'SON' },
  creator: { label: 'Créateur de contenu', stamp: 'CRÉA' },
  place:   { label: 'Lieu',                stamp: 'LIEU' },
};

export const CATEGORY_ORDER: readonly CategoryKey[] = [
  'film',
  'series',
  'artist',
  'track',
  'creator',
  'place',
];
