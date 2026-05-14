'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

const optionalUrl = z.string().trim().max(500).url('URL invalide').or(z.literal('')).optional();

const memberSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Nom requis').max(80),
  nick: z.string().trim().min(1, 'Surnom requis').max(80),
  bio: z.string().trim().max(500).default(''),
  initials: z.string().trim().min(1, 'Initiales requises').max(4),
  photo_kind: z.enum(['gradient', 'image']).default('gradient'),
  photo_from: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur HEX').optional(),
  photo_to: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur HEX').optional(),
  photo_url: z.string().trim().url('URL invalide').or(z.literal('')).optional(),
  rotation: z.coerce.number().min(-15).max(15).default(0),
  display_order: z.coerce.number().int().min(0).default(0),
  instagram_url: optionalUrl,
  youtube_url: optionalUrl,
  twitch_url: optionalUrl,
  x_url: optionalUrl,
  website_url: optionalUrl,
});

export type MemberFormPayload = z.infer<typeof memberSchema>;

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath('/');
  revalidatePath('/team');
}

export async function saveMember(input: MemberFormPayload): Promise<ActionResult> {
  await requireAdmin();
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Champs invalides' };
  const supabase = await createServerClient();
  const row = {
    name: parsed.data.name,
    nick: parsed.data.nick,
    bio: parsed.data.bio,
    initials: parsed.data.initials.toUpperCase(),
    photo_kind: parsed.data.photo_kind,
    photo_from: parsed.data.photo_from ?? null,
    photo_to: parsed.data.photo_to ?? null,
    photo_url: parsed.data.photo_url || null,
    rotation: parsed.data.rotation,
    display_order: parsed.data.display_order,
    instagram_url: parsed.data.instagram_url || null,
    youtube_url: parsed.data.youtube_url || null,
    twitch_url: parsed.data.twitch_url || null,
    x_url: parsed.data.x_url || null,
    website_url: parsed.data.website_url || null,
  };
  const { error } = parsed.data.id
    ? await supabase.from('landing_team').update(row as never).eq('id', parsed.data.id)
    : await supabase.from('landing_team').insert(row as never);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteMember(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createServerClient();
  const { error } = await supabase.from('landing_team').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
