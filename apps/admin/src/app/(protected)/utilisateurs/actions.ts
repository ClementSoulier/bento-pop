'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createMobileClient } from '@/lib/supabase/mobile';
import { deleteMobileAccount } from '@/lib/mobile-users';
import { composeReason, type DeletionReasonId } from '@/lib/deletion-reasons';
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

const deleteSchema = z.object({
  userId: z.string().uuid(),
  reasonId: z.string().min(1),
  detail: z.string().max(500),
  hasAuthAccount: z.boolean(),
});

/**
 * Supprime un compte, avec son motif enregistré au registre.
 *
 * **Irréversible et sans corbeille.** Le profil part, et avec lui son bento
 * et ses cases par cascade. La page publique `/u/<pseudo>` devient un 404.
 *
 * Le motif n'est pas décoratif : c'est la trace RGPD, écrite dans la même
 * transaction que la suppression du profil, côté SQL. Ni suppression sans
 * trace, ni trace sans suppression.
 *
 * Les signalements émis par la personne sont conservés
 * (`on delete set null` sur `reporter_id`) : ils concernent quelqu'un
 * d'autre, et les perdre effacerait le travail de modération d'un tiers.
 */
export async function deleteMobileUser(input: {
  userId: string;
  reasonId: string;
  detail: string;
  hasAuthAccount: boolean;
}): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Champs invalides' };
  }

  const reason = composeReason(parsed.data.reasonId as DeletionReasonId, parsed.data.detail);
  if (!reason.ok) return { ok: false, error: reason.error };

  const mobile = createMobileClient();
  if (!mobile) {
    return {
      ok: false,
      error: 'Supabase mobile non configuré (MOBILE_SUPABASE_URL / MOBILE_SUPABASE_SERVICE_ROLE_KEY).',
    };
  }

  const result = await deleteMobileAccount(mobile, parsed.data.userId, {
    hasAuthAccount: parsed.data.hasAuthAccount,
    reason: reason.reason,
    adminEmail: admin.email,
  });
  if (!result.ok) return result;

  revalidatePath('/utilisateurs');
  revalidatePath('/bentos');
  return { ok: true };
}

const orphanSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) });

/**
 * Supprime des installations qui n'ont jamais choisi de pseudo.
 *
 * **Pas d'entrée au registre, et c'est délibéré.** Ces comptes n'ont aucun
 * profil : ni pseudo, ni nom, ni bento, ni CGU acceptées. Il n'y a jamais eu
 * de donnée personnelle à supprimer, seulement une ligne d'authentification
 * anonyme créée au premier lancement de l'app. Un registre de suppression de
 * données personnelles n'a rien à y consigner.
 *
 * Le lot est borné à 200 pour que l'action reste dans le temps d'une requête.
 */
export async function deleteOrphanAccounts(input: {
  ids: string[];
}): Promise<{ ok: true; deleted: number } | { ok: false; error: string }> {
  await requireAdmin();

  const parsed = orphanSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Sélection invalide' };
  }

  const mobile = createMobileClient();
  if (!mobile) return { ok: false, error: 'Supabase mobile non configuré.' };

  // Garde-fou : refuser de supprimer un compte qui porte un profil, même si
  // l'appelant l'a demandé. L'écran ne le proposera jamais, mais cette
  // action est irréversible et ne doit pas dépendre de la justesse de son
  // appelant.
  const { data: withProfile, error: lookupError } = await mobile
    .from('users')
    .select('id')
    .in('id', parsed.data.ids);
  if (lookupError) return { ok: false, error: lookupError.message };
  if ((withProfile ?? []).length > 0) {
    return {
      ok: false,
      error: `${withProfile!.length} compte(s) de la sélection ont un profil : passe par la suppression avec motif.`,
    };
  }

  let deleted = 0;
  for (const id of parsed.data.ids) {
    const { error } = await mobile.auth.admin.deleteUser(id);
    // On continue plutôt que d'abandonner : un échec isolé ne doit pas
    // annuler le ménage déjà fait, et le compte restera visible dans la
    // liste au prochain chargement.
    if (!error) deleted += 1;
  }

  revalidatePath('/utilisateurs');
  return { ok: true, deleted };
}

/**
 * Purge les entrées du registre de plus de 12 mois.
 *
 * Appelée à l'ouverture de l'écran plutôt que par une tâche planifiée : le
 * projet n'a pas d'ordonnanceur, et la table grossit de quelques lignes par
 * mois. Son échec n'est pas remonté à l'écran : une purge ratée n'empêche
 * personne de travailler, et elle repassera au chargement suivant.
 */
export async function purgeDeletionRegistry(): Promise<number> {
  const mobile = createMobileClient();
  if (!mobile) return 0;
  const { data, error } = await mobile.rpc('purge_user_deletions');
  if (error) {
    console.warn('[utilisateurs] purge du registre', error.message);
    return 0;
  }
  return data ?? 0;
}
