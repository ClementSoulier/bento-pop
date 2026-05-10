import { cache } from 'react';
import { createServerClient } from '@/lib/supabase/server';

export type LandingSettings = {
  seasonNumber: number;
  /** Format affiché : "Saison 02". Toujours sur 2 chiffres. */
  seasonLabel: string;
};

const STATIC_FALLBACK: LandingSettings = {
  seasonNumber: 2,
  seasonLabel: 'Saison 02',
};

function formatSeasonLabel(n: number): string {
  return `Saison ${String(n).padStart(2, '0')}`;
}

/**
 * Charge les réglages globaux de la landing depuis la table singleton
 * `landing_settings` (V1 : numéro de saison ; on étendra ce loader à mesure
 * qu'on ajoute des colonnes côté DB).
 *
 * Fallback statique si Supabase indisponible — la landing reste affichable.
 */
export const loadSettings = cache(async (): Promise<LandingSettings> => {
  const supabase = await createServerClient();
  if (!supabase) return STATIC_FALLBACK;
  const { data, error } = await supabase
    .from('landing_settings')
    .select('season_number')
    .eq('id', 'singleton')
    .maybeSingle();
  if (error || !data) return STATIC_FALLBACK;
  const row = data as unknown as { season_number: number };
  return {
    seasonNumber: row.season_number,
    seasonLabel: formatSeasonLabel(row.season_number),
  };
});
