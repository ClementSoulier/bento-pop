import { z } from 'zod';
import { SLUG_PATTERN } from '@/lib/slugify';

const slugField = z
  .string()
  .trim()
  .min(1, 'Slug requis')
  .max(120)
  .regex(SLUG_PATTERN, 'Minuscules, chiffres et tirets uniquement');

const optionalText = (max: number) => z.string().trim().max(max).optional().default('');

/** Un épisode cité par l'article : une émission ou un podcast. */
export const relatedEpisodeSchema = z.object({
  kind: z.enum(['show', 'podcast']),
  id: z.string().uuid(),
});

export type RelatedEpisodeRef = z.infer<typeof relatedEpisodeSchema>;

/**
 * Données du formulaire d'article. Le contenu (`content`) n'est pas validé ici :
 * il passe par `validateBlogDoc`, qui connaît la liste des éléments autorisés.
 */
/* Segments déjà pris par des pages de la landing sous /blog/. */
const RESERVED_POST_SLUGS = new Set(['categorie', 'apercu']);

export const blogPostSchema = z.object({
  id: z.string().uuid().optional(),
  slug: slugField.refine((v) => !RESERVED_POST_SLUGS.has(v), 'Ce slug est réservé par le site, choisis-en un autre.'),
  title: z.string().trim().min(1, 'Titre requis').max(200),
  excerpt: optionalText(400),
  content: z.unknown(),
  cover_url: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .default('')
    .refine((v) => v === '' || /^https?:\/\//.test(v), 'Adresse d’image invalide'),
  cover_alt: optionalText(200),
  category_id: z
    .string()
    .optional()
    .default('')
    .refine((v) => v === '' || z.string().uuid().safeParse(v).success, 'Catégorie inconnue'),
  status: z.enum(['draft', 'published']),
  /* ISO : le navigateur convertit l'heure de Paris avant l'envoi (cf. episodes/format). */
  published_at: z.string().optional().default(''),
  seo_title: optionalText(70),
  seo_description: optionalText(200),
  author_ids: z.array(z.string().uuid()).max(6, '6 auteurs au plus'),
  related: z.array(relatedEpisodeSchema).max(12, '12 épisodes liés au plus'),
}).superRefine((data, ctx) => {
  if (data.status === 'published' && data.author_ids.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['author_ids'],
      message: 'Choisis au moins un auteur avant de publier.',
    });
  }
  if (data.cover_url && !data.cover_alt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['cover_alt'],
      message: 'Décris l’image de couverture (texte alternatif).',
    });
  }
});

export type BlogPostPayload = z.input<typeof blogPostSchema>;

export const blogCategorySchema = z.object({
  id: z.string().uuid().optional(),
  slug: slugField,
  name: z.string().trim().min(1, 'Nom requis').max(60),
  description: optionalText(300),
  display_order: z.coerce.number().int().min(0).max(999).default(0),
});

export type BlogCategoryPayload = z.input<typeof blogCategorySchema>;
