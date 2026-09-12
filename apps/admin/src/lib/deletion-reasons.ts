/**
 * Motifs de suppression de compte.
 *
 * Une liste fermée plus un champ libre, plutôt qu'un champ libre seul : un
 * registre RGPD dont les motifs sont tous rédigés différemment n'est pas
 * exploitable, et c'est justement pour être relu plus tard qu'il existe.
 */

export const DELETION_REASONS = [
  { id: 'test', label: 'Compte de test' },
  { id: 'demande', label: "Demande de la personne" },
  { id: 'contenu', label: 'Contenu inapproprié' },
  { id: 'doublon', label: 'Doublon' },
  { id: 'autre', label: 'Autre' },
] as const;

export type DeletionReasonId = (typeof DELETION_REASONS)[number]['id'];

export const REASON_DETAIL_MAX = 300;

/**
 * Compose le motif enregistré.
 *
 * Le libellé est repris en clair plutôt que l'identifiant : le registre doit
 * rester lisible dans dix mois sans avoir à retrouver ce code, y compris si
 * la liste a changé entre-temps.
 *
 * « Autre » **exige** une précision : un motif qui dit « Autre » ne trace
 * rien, et le seul intérêt du registre est d'expliquer une suppression qu'on
 * ne se rappelle plus.
 */
export function composeReason(
  id: DeletionReasonId,
  detail: string,
): { ok: true; reason: string } | { ok: false; error: string } {
  const entry = DELETION_REASONS.find((r) => r.id === id);
  if (!entry) return { ok: false, error: 'Motif inconnu.' };

  const trimmed = detail.replace(/\s+/g, ' ').trim();
  if (trimmed.length > REASON_DETAIL_MAX) {
    return { ok: false, error: `La précision fait ${REASON_DETAIL_MAX} caractères au maximum.` };
  }
  if (id === 'autre' && trimmed.length === 0) {
    return { ok: false, error: 'Précise le motif : « Autre » seul ne trace rien.' };
  }

  return { ok: true, reason: trimmed ? `${entry.label} : ${trimmed}` : entry.label };
}
