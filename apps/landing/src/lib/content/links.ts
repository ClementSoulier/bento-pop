import { cache } from 'react';
import type { LinkKind, LinkSurface } from '@bento-pop/supabase/types';
import { createAnonServerClient } from '@/lib/supabase/server';

export type LinkRecord = {
  id: string;
  kind: LinkKind;
  name: string;
  url: string;
  enabled: boolean;
  surfaces: LinkSurface[];
  order: number;
};

/**
 * Charge tous les liens activés depuis Supabase, déjà ordonnés.
 * Retourne `null` si Supabase est indisponible — l'appelant doit alors
 * basculer sur ses valeurs statiques.
 */
export const loadEnabledLinks = cache(async (): Promise<LinkRecord[] | null> => {
  const supabase = createAnonServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('landing_links')
    .select('id, kind, name, url, enabled, surfaces, display_order')
    .eq('enabled', true)
    .order('display_order', { ascending: true });
  if (error || !data) return null;
  const rows = data as unknown as Array<{
    id: string;
    kind: LinkKind;
    name: string;
    url: string;
    enabled: boolean;
    surfaces: LinkSurface[];
    display_order: number;
  }>;
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    name: r.name,
    url: r.url,
    enabled: r.enabled,
    surfaces: r.surfaces,
    order: r.display_order,
  }));
});

export function pickBySurface(links: LinkRecord[], surface: LinkSurface): LinkRecord[] {
  return links.filter((l) => l.surfaces.includes(surface));
}

export function pickByKind(links: LinkRecord[], kind: LinkKind): LinkRecord | undefined {
  return links.find((l) => l.kind === kind);
}
