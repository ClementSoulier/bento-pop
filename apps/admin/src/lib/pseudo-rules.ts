/**
 * Règles de pseudo, côté back-office.
 *
 * ─── Ce qui garantit quoi ─────────────────────────────────────────────
 *
 * Les trois règles sont appliquées par la **base**, et le service-role n'y
 * échappe pas. Vérifié en production le 12 septembre 2026 :
 *
 *   format      → 23514, « violates check constraint "pseudo_format" »
 *   motif banni → 23514, « Pseudo non autorisé. » (trigger
 *                 `users_pseudo_block_check`, en `security definer`)
 *   doublon     → 23505 sur `users_pseudo_lower_idx`, insensible à la casse
 *
 * Le back-office n'a donc **rien à réimplémenter** : il ne peut pas poser un
 * pseudo que l'app refuserait, même par erreur de code. Ce module sert à deux
 * choses seulement : donner un retour immédiat sur ce qui se vérifie sans
 * réseau, et traduire les erreurs de la base en français lisible.
 *
 * La liste des motifs bannis n'est de toute façon pas lisible ici : la table
 * `blocked_pseudo_patterns` n'a aucune policy, et sa recopie côté admin
 * dériverait au premier ajout.
 */

/** Alignée sur la contrainte SQL `pseudo_format`. */
export const PSEUDO_REGEX = /^[A-Za-z0-9_.]{3,20}$/;
export const PSEUDO_MIN = 3;
export const PSEUDO_MAX = 20;

export type PseudoIssue =
  | { ok: true }
  | { ok: false; reason: 'vide' | 'trop-court' | 'trop-long' | 'caracteres'; message: string };

/**
 * Contrôle de forme, sans réseau.
 *
 * Ne dit **rien** de l'unicité ni des motifs bannis : ces deux-là demandent la
 * base, et c'est elle qui tranche.
 */
export function checkPseudoShape(raw: string): PseudoIssue {
  const value = raw.trim();
  if (value.length === 0) {
    return { ok: false, reason: 'vide', message: 'Le pseudo ne peut pas être vide.' };
  }
  if (value.length < PSEUDO_MIN) {
    return {
      ok: false,
      reason: 'trop-court',
      message: `Le pseudo fait ${PSEUDO_MIN} caractères au minimum.`,
    };
  }
  if (value.length > PSEUDO_MAX) {
    return {
      ok: false,
      reason: 'trop-long',
      message: `Le pseudo fait ${PSEUDO_MAX} caractères au maximum.`,
    };
  }
  if (!PSEUDO_REGEX.test(value)) {
    return {
      ok: false,
      reason: 'caracteres',
      message: 'Lettres, chiffres, point et tiret bas uniquement. Ni espace ni accent.',
    };
  }
  return { ok: true };
}

/** Ce que renvoie PostgREST quand une contrainte lâche. */
export type PostgrestFailure = { code?: string; message?: string };

/**
 * Traduit un refus de la base en phrase compréhensible.
 *
 * Les deux causes de refus de pseudo partagent le code `23514` : la contrainte
 * de format et le trigger de modération. Elles ne se distinguent que par le
 * message, donc c'est bien lui qu'on inspecte, et non le seul code.
 *
 * Tout ce qui n'est pas reconnu est rendu tel quel plutôt que masqué derrière
 * un « une erreur est survenue » : sur un back-office, un message technique
 * vaut mieux qu'un message vide.
 */
export function explainWriteFailure(error: PostgrestFailure): string {
  const code = error.code ?? '';
  const message = error.message ?? '';

  if (code === '23505' && message.includes('users_pseudo_lower_idx')) {
    return 'Ce pseudo est déjà pris, à la casse près.';
  }
  if (code === '23514' && message.includes('pseudo_format')) {
    return 'Format invalide : 3 à 20 caractères, lettres, chiffres, point et tiret bas.';
  }
  if (code === '23514' && message.includes('Pseudo non autorisé')) {
    return 'Ce pseudo tombe sous un motif bloqué par la modération.';
  }
  if (code === '23514' && message.includes('users_editorial_has_no_terms')) {
    return "Un profil éditorial ne peut pas avoir accepté les CGU : personne n'est derrière.";
  }
  return message || 'La modification a échoué.';
}

/** Nom affiché : facultatif, mais pas n'importe quoi. */
export const DISPLAY_NAME_MAX = 40;

export function normalizeDisplayName(raw: string): string | null {
  // Espaces multiples réduits : un nom collé depuis une autre source en
  // traîne souvent, et ils se voient à l'affichage.
  const value = raw.replace(/\s+/g, ' ').trim();
  return value.length === 0 ? null : value;
}

export function checkDisplayName(raw: string): { ok: true } | { ok: false; message: string } {
  const value = normalizeDisplayName(raw);
  if (value !== null && value.length > DISPLAY_NAME_MAX) {
    return { ok: false, message: `Le nom affiché fait ${DISPLAY_NAME_MAX} caractères au maximum.` };
  }
  return { ok: true };
}
