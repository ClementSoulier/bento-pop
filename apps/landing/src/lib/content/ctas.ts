import { cache } from 'react';
import type { CtaSlot } from '@bento-pop/supabase/types';
import { createAnonServerClient } from '@/lib/supabase/server';

export type CtaRecord = {
  slot: CtaSlot;
  label: string;
  url: string;
  iconKey: string | null;
};

/**
 * Charge les 2 CTAs (primary + secondary) configurés via le BO.
 * Retourne `null` si Supabase est indisponible.
 */
export const loadCtas = cache(async (): Promise<Record<CtaSlot, CtaRecord> | null> => {
  const supabase = createAnonServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('landing_ctas')
    .select('slot, label, url, icon_key');
  if (error || !data || data.length === 0) return null;
  const rows = data as unknown as Array<{ slot: CtaSlot; label: string; url: string; icon_key: string | null }>;
  const map: Partial<Record<CtaSlot, CtaRecord>> = {};
  for (const r of rows) {
    map[r.slot] = { slot: r.slot, label: r.label, url: r.url, iconKey: r.icon_key };
  }
  if (!map.primary || !map.secondary) return null;
  return { primary: map.primary, secondary: map.secondary };
});
