import { z } from 'zod';
import { SLUG_PATTERN } from '@/lib/slugify';

import { problemeAudio } from './audio-rules';

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
// Flux RSS : le fichier audio et son identité
// ============================================================

/* Ces champs sont ceux que le flux RSS publie. Ils valent pour les deux rubriques :
   les émissions sortent aussi en podcast, le mardi qui suit leur diffusion YouTube.

   Rien n'est obligatoire ici : un épisode se saisit d'abord, se complète ensuite.
   C'est la cohérence de l'ensemble qui est contrôlée, dans `audioComplet` plus bas. */
const audioShape = {
  audio_url: z.string().trim().max(1000).optional().default(''),
  audio_bytes: z.coerce.number().int().min(0).optional().default(0),
  audio_mime: z.string().trim().max(60).optional().default('audio/mpeg'),
  /* Datetime-local, comme published_at. Vide = l'épisode n'entre pas dans le flux. */
  audio_published_at: z.string().optional().default(''),
  /* Identifiant de l'épisode dans le flux. Généré à la création s'il manque : les
     applis d'écoute s'en servent pour reconnaître un épisode déjà téléchargé, donc
     il ne doit jamais changer ensuite. */
  feed_guid: z.string().trim().max(200).optional().default(''),
  feed_season: z.coerce.number().int().min(1).nullable().optional(),
  feed_number: z.coerce.number().int().min(1).nullable().optional(),
  explicit: z.boolean().default(false),
  episode_type: z.enum(['full', 'trailer', 'bonus']).default('full'),
  /* Textes et image propres aux plateformes audio (charte : un titre et une description
     à part). Vides, le flux reprend le titre et la description de la fiche ; sans image,
     les applis montrent la pochette du podcast. */
  audio_title: z.string().trim().max(200).optional().default(''),
  audio_description: z
    .string()
    .max(4000, 'Apple Podcasts n’affiche pas plus de 4000 caractères')
    .optional()
    .default(''),
  audio_image_url: z.string().trim().max(1000).optional().default(''),
};

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
  ...audioShape,
};

export const episodeTypeEnum = z.enum(['full', 'trailer', 'bonus']);

export const showEpisodeSchema = z
  .object({
    ...commonShape,
    youtube_id: z.string().trim().min(1, 'YouTube ID requis').max(40),
  })
  /* Voir audio-rules.ts : un épisode daté dans le flux doit être écoutable. */
  .superRefine((v, ctx) => {
    const probleme = problemeAudio(v);
    if (probleme) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: probleme.message,
        path: [probleme.champ],
      });
    }
  });

export const audioPlatformEnum = z.enum(['spotify', 'deezer', 'apple']);

export const podcastEpisodeSchema = z
  .object({
    ...commonShape,
    /* Vide tant que l'épisode n'est pas diffusé : on ne le connaît qu'après coup. */
    spotify_episode_id: z.string().trim().max(64).optional().default(''),
    audio_platform: audioPlatformEnum.default('spotify'),
    audio_show_id: z.string().trim().max(64).optional().default(''),
  })
  // L'embed Apple Podcasts a besoin de l'id de l'émission en plus de l'épisode.
  .refine(
    (v) => v.audio_platform !== 'apple' || !v.spotify_episode_id || v.audio_show_id.length > 0,
    {
      message: "ID de l'émission requis pour Apple Podcasts",
      path: ['audio_show_id'],
    },
  )
  .superRefine((v, ctx) => {
    const probleme = problemeAudio(v);
    if (probleme) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: probleme.message,
        path: [probleme.champ],
      });
    }
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
