import { cache } from 'react';
import type { TeamContent, TeamMember, TeamPhoto } from '@/lib/content/schemas';
import { createServerClient } from '@/lib/supabase/server';

const STATIC_FALLBACK: TeamContent = {
  eyebrow: 'La Team Bento',
  title: 'Une vraie équipe de passionnés',
  members: [
    { id: 'dark-hifus', name: 'Dark Hifus', nick: 'Le Captain',  bio: "Capitaine du plateau et voix de l'émission. Il pose les bonnes questions, et les piquantes aussi.", photo: { kind: 'gradient', from: '#2a3142', to: '#4a5266', initials: 'DH' }, rotation: -2,  order: 1 },
    { id: 'todalf',     name: 'ToDalf',     nick: 'Le Pilier',   bio: "Mémoire vivante du gaming et du cinéma. Si c'est sorti, il l'a vu, joué, ou démonté.",            photo: { kind: 'gradient', from: '#c41e3a', to: '#882a3a', initials: 'TD' }, rotation: 1.5, order: 2 },
    { id: 'elda',       name: 'Elda',       nick: "L'Experte",   bio: "Manga, Webtoon et K-culture. Quand elle parle de Séoul, c'est rarement depuis Paris.",            photo: { kind: 'gradient', from: '#ff8fb0', to: '#ff5588', initials: 'EL' }, rotation: -1,  order: 3 },
    { id: 'rob',        name: 'Rob',        nick: 'Le Visuel',   bio: 'Réalisation, montage et direction artistique. Il rend tout ça regardable — et beau.',             photo: { kind: 'gradient', from: '#2ec4b6', to: '#1a8a80', initials: 'RB' }, rotation: 2,   order: 4 },
  ],
  quote:
    "Au quatre coin de la France, on vous donne rendez-vous IRL sur les conventions avec nos invités et notre bonne humeur.",
};

export const getTeam = cache(async (): Promise<TeamContent> => {
  const supabase = await createServerClient();
  if (!supabase) return STATIC_FALLBACK;

  const { data, error } = await supabase
    .from('landing_team')
    .select('id, name, nick, bio, photo_kind, photo_from, photo_to, photo_url, initials, rotation, display_order')
    .order('display_order', { ascending: true });

  if (error || !data || data.length === 0) return STATIC_FALLBACK;

  const rows = data as unknown as Array<{
    id: string;
    name: string;
    nick: string;
    bio: string;
    photo_kind: 'gradient' | 'image';
    photo_from: string | null;
    photo_to: string | null;
    photo_url: string | null;
    initials: string;
    rotation: number;
    display_order: number;
  }>;

  const members: TeamMember[] = rows.map((r) => {
    const photo: TeamPhoto =
      r.photo_kind === 'image' && r.photo_url
        ? { kind: 'image', url: r.photo_url, initials: r.initials }
        : {
            kind: 'gradient',
            from: r.photo_from ?? '#2a3142',
            to: r.photo_to ?? '#4a5266',
            initials: r.initials,
          };
    return {
      id: r.id,
      name: r.name,
      nick: r.nick,
      bio: r.bio,
      photo,
      rotation: r.rotation,
      order: r.display_order,
    };
  });

  return { ...STATIC_FALLBACK, members };
});
