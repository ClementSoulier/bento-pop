'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createMobileClient } from '@/lib/supabase/mobile';
import { requireAdmin } from '@/lib/auth';

const versionRegex = /^\d+\.\d+\.\d+$/;

const schema = z.object({
  maintenanceMode: z.boolean(),
  maintenanceTitle: z.string().trim().min(1, 'Titre requis').max(120, 'Titre trop long'),
  maintenanceMessage: z.string().trim().min(1, 'Message requis').max(500, 'Message trop long'),
  iosMinVersion: z.string().regex(versionRegex, 'Format X.Y.Z requis'),
  iosLatestVersion: z.string().regex(versionRegex, 'Format X.Y.Z requis'),
  androidMinVersion: z
    .string()
    .regex(versionRegex, 'Format X.Y.Z requis')
    .nullable()
    .or(z.literal('').transform(() => null)),
  androidLatestVersion: z
    .string()
    .regex(versionRegex, 'Format X.Y.Z requis')
    .nullable()
    .or(z.literal('').transform(() => null)),
});

export type MobileConfigPayload = z.input<typeof schema>;

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Met à jour la config mobile (`app_config` sur le projet Supabase mobile).
 * Service-role : bypass RLS, admin gate fait via `requireAdmin()` côté BO.
 */
export async function updateMobileConfig(input: MobileConfigPayload): Promise<ActionResult> {
  await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Champs invalides' };
  }
  const mobile = createMobileClient();
  if (!mobile) {
    return { ok: false, error: 'Projet mobile non configuré côté BO.' };
  }
  const { error } = await mobile
    .from('app_config')
    .update({
      maintenance_mode: parsed.data.maintenanceMode,
      maintenance_title: parsed.data.maintenanceTitle,
      maintenance_message: parsed.data.maintenanceMessage,
      ios_min_version: parsed.data.iosMinVersion,
      ios_latest_version: parsed.data.iosLatestVersion,
      android_min_version: parsed.data.androidMinVersion,
      android_latest_version: parsed.data.androidLatestVersion,
    })
    .eq('id', 1);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/config/mobile');
  return { ok: true };
}
