import { supabase } from '@/supabase/client';
import type { CategoryKey } from '@/supabase/types';
import { PALETTES, type PaletteKey } from '@/components/bento/palettes';
import type { BentoItems } from '@/components/bento';

const CATEGORY_BY_ID: Record<number, CategoryKey> = {
  1: 'film',
  2: 'series',
  3: 'artist',
  4: 'track',
  5: 'creator',
  6: 'place',
};
const PALETTE_KEYS = Object.keys(PALETTES) as PaletteKey[];

export type FeaturedBento = {
  bentoId: string;
  pseudo: string;
  displayName: string | null;
  isFeatured: boolean;
  featuredOrder: number | null;
  publishedAt: string;
  slots: BentoItems;
};

/**
 * Charge la liste des bentos featured (triés par `featured_order`) + leurs
 * items + user. Une requête joint tout pour minimiser les round-trips.
 */
export async function loadFeaturedBentos(limit = 12): Promise<FeaturedBento[]> {
  const { data, error } = await supabase
    .from('bentos')
    .select(
      `
      id,
      published_at,
      is_featured,
      featured_order,
      users:user_id ( id, pseudo, display_name ),
      bento_items (
        category_id,
        items ( id, title, subtitle, image_url )
      )
      `,
    )
    .eq('is_featured', true)
    .not('published_at', 'is', null)
    .order('featured_order', { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((b) => {
    const user = b.users as
      | { id: string; pseudo: string; display_name: string | null }
      | null;
    const slots: BentoItems = {};
    (b.bento_items ?? []).forEach((bi, idx) => {
      const cat = CATEGORY_BY_ID[bi.category_id];
      const item = bi.items as
        | { id: string; title: string; subtitle: string | null; image_url: string | null }
        | null;
      if (!cat || !item) return;
      slots[cat] = {
        title: item.title,
        subtitle: item.subtitle ?? undefined,
        imageUrl: item.image_url ?? undefined,
        paletteKey: PALETTE_KEYS[idx % (PALETTE_KEYS.length - 1)] ?? 'neutral',
      };
    });
    return {
      bentoId: b.id,
      pseudo: user?.pseudo ?? '???',
      displayName: user?.display_name ?? null,
      isFeatured: b.is_featured,
      featuredOrder: b.featured_order,
      publishedAt: b.published_at!,
      slots,
    };
  });
}
