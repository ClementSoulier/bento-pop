'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

const linkSchema = z.object({
  id: z.string().uuid(),
  url: z.string().trim().max(500),
  enabled: z.boolean(),
});

const ctaSchema = z.object({
  slot: z.enum(['primary', 'secondary']),
  label: z.string().trim().min(1, 'Libellé requis').max(80),
  url: z.string().trim().url('URL invalide'),
});

/**
 * Accepte soit un ID YouTube brut (ex: "8JVSPC2ozOw"), soit n'importe quelle
 * URL YouTube/Shorts/youtu.be → on en extrait l'ID 11 caractères.
 */
const YT_ID_RX = /^[A-Za-z0-9_-]{11}$/;
function extractYoutubeId(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  if (YT_ID_RX.test(v)) return v;
  // tente d'extraire un v=, /embed/, /shorts/, youtu.be/
  const match = v.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/,
  );
  return match?.[1] ?? null;
}

const heroVideoSchema = z.object({
  youtubeId: z
    .string()
    .trim()
    .min(1, 'ID YouTube requis')
    .transform((v, ctx) => {
      const id = extractYoutubeId(v);
      if (!id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ID YouTube introuvable' });
        return z.NEVER;
      }
      return id;
    }),
  title: z.string().trim().min(1, 'Titre requis').max(120),
  episodeLabel: z.string().trim().min(1, 'Label épisode requis').max(60),
  live: z.boolean(),
});

export type HeroVideoFormPayload = z.input<typeof heroVideoSchema>;

/**
 * URL TikTok valide : https://www.tiktok.com/@user/video/1234567890123456789
 * On accepte aussi /v/{id}. Les URLs courtes (vm.tiktok.com) ne sont pas
 * supportées car non résolubles côté serveur sans HEAD request.
 */
const TIKTOK_RX = /\/(?:video|v)\/(\d{10,})/;

const heroTiktokSchema = z
  .object({
    tiktokUrl: z.string().trim().max(500).optional(),
    enabled: z.boolean(),
  })
  .superRefine((val, ctx) => {
    if (val.enabled) {
      const url = val.tiktokUrl ?? '';
      if (!url) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tiktokUrl'],
          message: 'URL TikTok requise pour activer',
        });
      } else if (!TIKTOK_RX.test(url)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tiktokUrl'],
          message: "Format attendu : https://www.tiktok.com/@…/video/123…",
        });
      }
    }
  });

export type HeroTiktokFormPayload = z.input<typeof heroTiktokSchema>;

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath('/');
  revalidatePath('/links');
}

export async function updateLink(input: z.infer<typeof linkSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Champs invalides' };
  const supabase = await createServerClient();
  const { error } = await supabase
    .from('landing_links')
    .update({ url: parsed.data.url, enabled: parsed.data.enabled } as never)
    .eq('id', parsed.data.id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function updateCta(input: z.infer<typeof ctaSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = ctaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Champs invalides' };
  const supabase = await createServerClient();
  const { error } = await supabase
    .from('landing_ctas')
    .update({ label: parsed.data.label, url: parsed.data.url } as never)
    .eq('slot', parsed.data.slot);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function updateHeroVideo(input: HeroVideoFormPayload): Promise<ActionResult> {
  await requireAdmin();
  const parsed = heroVideoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Champs invalides' };
  const supabase = await createServerClient();
  const row = {
    youtube_id: parsed.data.youtubeId,
    title: parsed.data.title,
    episode_label: parsed.data.episodeLabel,
    live: parsed.data.live,
  };
  const { error } = await supabase
    .from('landing_hero_video')
    .update(row as never)
    .eq('id', 'singleton');
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function updateHeroTiktok(input: HeroTiktokFormPayload): Promise<ActionResult> {
  await requireAdmin();
  const parsed = heroTiktokSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Champs invalides' };
  const supabase = await createServerClient();
  const row = {
    tiktok_url: parsed.data.tiktokUrl?.trim() || null,
    enabled: parsed.data.enabled,
  };
  const { error } = await supabase
    .from('landing_hero_tiktok')
    .update(row as never)
    .eq('id', 'singleton');
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
