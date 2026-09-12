'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createMobileClient } from '@/lib/supabase/mobile';
import {
  DISPLAY_NAME_MAX,
  checkPseudoShape,
  explainWriteFailure,
  normalizeDisplayName,
} from '@/lib/pseudo-rules';

export type ActionResult = { ok: true } | { ok: false; error: string };

const updateSchema = z.object({
  userId: z.string().uuid(),
  pseudo: z.string().min(1).max(64),
  displayName: z.string().max(200),
});

/**
 * Corrige le pseudo et le nom affiché d'un compte mobile.
 *
 * **Les règles de pseudo ne sont pas réimplémentées ici**, et c'est
 * volontaire : la base les applique toutes, y compris au service-role. Le
 * format vient de la contrainte `pseudo_format`, l'unicité insensible à la
 * casse de l'index `users_pseudo_lower_idx`, et les motifs de modération du
 * trigger `users_pseudo_block_check`, en `security definer`. Vérifié en
 * production : les trois refusent bien une écriture en service-role.
 *
 * Le contrôle de forme fait ici sert à répondre sans aller-retour réseau sur
 * le cas le plus courant. Les deux autres refus viennent de la base et sont
 * traduits par `explainWriteFailure`.
 *
 * Changer un pseudo change l'URL publique `/u/<pseudo>` : l'ancienne devient
 * un 404. L'interface prévient avant de valider.
 */
export async function updateMobileUser(input: {
  userId: string;
  pseudo: string;
  displayName: string;
}): Promise<ActionResult> {
  await requireAdmin();

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Champs invalides' };
  }

  const pseudo = parsed.data.pseudo.trim();
  const shape = checkPseudoShape(pseudo);
  if (!shape.ok) return { ok: false, error: shape.message };

  const displayName = normalizeDisplayName(parsed.data.displayName);
  if (displayName !== null && displayName.length > DISPLAY_NAME_MAX) {
    return { ok: false, error: `Le nom affiché fait ${DISPLAY_NAME_MAX} caractères au maximum.` };
  }

  const mobile = createMobileClient();
  if (!mobile) {
    return {
      ok: false,
      error: 'Supabase mobile non configuré (MOBILE_SUPABASE_URL / MOBILE_SUPABASE_SERVICE_ROLE_KEY).',
    };
  }

  const { error } = await mobile
    .from('users')
    .update({ pseudo, display_name: displayName })
    .eq('id', parsed.data.userId);

  if (error) return { ok: false, error: explainWriteFailure(error) };

  revalidatePath('/utilisateurs');
  // La page publique et le fil affichent le pseudo : la liste des bentos
  // deviendrait fausse sans ça.
  revalidatePath('/bentos');
  return { ok: true };
}
