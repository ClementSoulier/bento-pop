import { z } from 'zod';
import { SLUG_PATTERN } from '@/lib/slugify';

// ============================================================
// Sous-objets : invités, mentions, chapitres
// ============================================================

export const guestSchema = z.object({
  name: z.string().trim().min(1, 'Nom requis').max(120),
  role: z.string().trim().max(120).optional().default(''),
  photo_url: z.string().trim().max(500).optional().default(''),
});

export const mentionTypeEnum = z.enum(['game', 'movie', 'series', 'book', 'other']);
export const MENTION_TYPE_LABELS: Record<z.infer<typeof mentionTypeEnum>, string> = {
  game: 'Jeu vidéo',
  movie: 'Film',
  series: 'Série',
  book: 'Livre',
  other: 'Autre',
};

export const mentionSchema = z.object({
  type: mentionTypeEnum,
  title: z.string().trim().min(1, 'Titre requis').max(200),
  url: z.string().trim().max(500).optional().default(''),
  cover_url: z.string().trim().max(500).optional().default(''),
});

export const chapterSchema = z.object({
  label: z.string().trim().min(1, 'Libellé requis').max(120),
  start_seconds: z.coerce.number().int().min(0, 'Doit être ≥ 0'),
});

// ============================================================
// Champs communs aux deux types d'épisodes
// ============================================================

const commonShape = {
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .min(1, 'Slug requis')
    .max(120)
    .regex(SLUG_PATTERN, 'Slug invalide (lettres minuscules, chiffres, tirets)'),
  title: z.string().trim().min(1, 'Titre requis').max(200),
  description: z.string().max(5000).optional().default(''),
  thumbnail_url: z.string().trim().max(500).optional().default(''),
  /* Stocké en secondes ; le BO saisit en mm:ss et convertit. */
  duration_seconds: z.coerce.number().int().min(0).nullable().optional(),
  /* Datetime-local string (ex: "2026-05-13T18:30") — converti en ISO en server action. */
  published_at: z.string().optional().default(''),
  season: z.coerce.number().int().min(1).default(1),
  episode_number: z.coerce.number().int().min(1).nullable().optional(),
  status: z.enum(['draft', 'published']).default('draft'),
  display_order: z.coerce.number().int().default(0),
  seo_title: z.string().trim().max(200).optional().default(''),
  seo_description: z.string().trim().max(500).optional().default(''),
  guests: z.array(guestSchema).max(20).default([]),
  mentions: z.array(mentionSchema).max(100).default([]),
  chapters: z.array(chapterSchema).max(100).default([]),
  /* IDs de landing_team (animateurs présents). L'ordre du tableau
     pilote display_order dans la table de jointure. */
  host_ids: z.array(z.string().uuid()).max(10).default([]),
};

export const showEpisodeSchema = z.object({
  ...commonShape,
  youtube_id: z.string().trim().min(1, 'YouTube ID requis').max(40),
});

export const podcastEpisodeSchema = z.object({
  ...commonShape,
  spotify_episode_id: z.string().trim().min(1, 'Spotify ID requis').max(40),
});

export type ShowEpisodePayload = z.infer<typeof showEpisodeSchema>;
export type PodcastEpisodePayload = z.infer<typeof podcastEpisodeSchema>;
export type EpisodeGuest = z.infer<typeof guestSchema>;
export type EpisodeMention = z.infer<typeof mentionSchema>;
export type EpisodeChapter = z.infer<typeof chapterSchema>;
export type EpisodeMentionType = z.infer<typeof mentionTypeEnum>;

/* Shape des champs partagés entre les deux formulaires — utilisé par les
   sous-composants qui acceptent un Control<EpisodeFormCommon> via duck-typing
   structurel (les deux schémas satisfont cette forme). */
export type EpisodeFormCommon = {
  guests: EpisodeGuest[];
  mentions: EpisodeMention[];
  chapters: EpisodeChapter[];
  host_ids: string[];
};
