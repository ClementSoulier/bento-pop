import { cache } from 'react';
import type { AgendaContent, AgendaEvent, AgendaStatus } from '@/lib/content/schemas';
import { createServerClient } from '@/lib/supabase/server';

const STATIC_FALLBACK: AgendaContent = {
  eyebrow: "L'Agenda du Bento",
  title: 'Le Bento pose ses valises',
  description:
    "On parcourt la France de convention en convention. Retrouvez-nous bientôt près de chez vous !",
  events: [
    { id: 'jx-2026',        date: '2026-07-03', title: 'Japan Expo',     place: 'Paris Nord Villepinte',      stand: 'Stand B-12 · Hall 7', status: 'live', statusLabel: 'En direct',     order: 1 },
    { id: 'pm-2026',        date: '2026-09-12', title: 'Paris Manga',    place: 'Porte de Versailles, Paris', stand: 'Stand Pop·14',        status: 'soon', statusLabel: 'Prochainement', order: 2 },
    { id: 'cc-2026',        date: '2026-10-24', title: 'Comic Con',      place: 'Paris Expo · Pavillon 5',    stand: 'Plateau Pop·22',      status: 'soon', statusLabel: 'Prochainement', order: 3 },
    { id: 'mangazur-2026',  date: '2026-02-14', title: "Mang'Azur",      place: 'Mandelieu-la-Napoule',       stand: 'Plateau Hall 1',      status: 'done', statusLabel: 'Replay dispo',  order: 4 },
    { id: 'tgs-2025',       date: '2025-11-08', title: 'TGS · Toulouse', place: 'Parc des Expositions',       stand: 'Stand A-09',          status: 'done', statusLabel: 'Replay dispo',  order: 5 },
  ],
};

export const getAgenda = cache(async (): Promise<AgendaContent> => {
  const supabase = await createServerClient();
  if (!supabase) return STATIC_FALLBACK;

  const { data, error } = await supabase
    .from('landing_events')
    .select('id, date, title, place, stand, status, status_label, replay_url, display_order')
    .order('display_order', { ascending: true });

  if (error || !data || data.length === 0) return STATIC_FALLBACK;

  const rows = data as unknown as Array<{
    id: string;
    date: string;
    title: string;
    place: string;
    stand: string;
    status: AgendaStatus;
    status_label: string;
    replay_url: string | null;
    display_order: number;
  }>;

  const events: AgendaEvent[] = rows.map((r) => ({
    id: r.id,
    date: r.date,
    title: r.title,
    place: r.place,
    stand: r.stand,
    status: r.status,
    statusLabel: r.status_label,
    replayUrl: r.replay_url ?? undefined,
    order: r.display_order,
  }));

  return { ...STATIC_FALLBACK, events };
});
