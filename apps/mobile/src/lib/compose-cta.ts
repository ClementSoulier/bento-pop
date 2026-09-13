import { CATEGORY_ORDER } from '@bento-pop/supabase-mobile/bento';
import type { CategoryKey } from '@/supabase/types';

/**
 * Décide de ce que fait, et de ce que dit, le bouton principal du composer.
 *
 * Ce fichier existe parce que le libellé et l'action avaient divergé. Le
 * bouton affichait « Compléter (3 restants) », n'était pas grisé, et
 * `onPublish` sortait en silence dès que les six cases n'étaient pas pleines :
 * pour toute personne ayant entre une et cinq cases, le plus gros bouton de
 * l'écran ne faisait strictement rien. Relevé le 13 septembre 2026 sur les
 * données de production : 16 bentos dans ce cas, sur 58.
 *
 * Le remède n'est pas de rajouter une condition, c'est de ne plus décider à
 * deux endroits. Une seule fonction rend le libellé, l'action et l'état
 * désactivé, et un test vérifie qu'ils vont ensemble.
 *
 * N'importe RIEN, donc chargeable sous `node:test`.
 */

export type ComposeCta =
  /** Publication en cours. */
  | { kind: 'busy'; label: string; disabled: true }
  /** Ouvre une case à remplir. Couvre le bento vide ET le bento partiel. */
  | { kind: 'open-slot'; label: string; disabled: false; category: CategoryKey }
  /** Complet, mais une case attend la modération. */
  | { kind: 'blocked'; label: string; disabled: true }
  /** Complet et publiable. */
  | { kind: 'publish'; label: string; disabled: false }
  /** Déjà en ligne : le bouton mène à la page publique, il ne republie pas. */
  | { kind: 'view-public'; label: string; disabled: false };

export type ComposeCtaInput = {
  /** Catégories actuellement remplies. */
  filled: readonly CategoryKey[];
  /** Au moins une case référence un item en attente de modération. */
  hasPending: boolean;
  /** Publication en cours. */
  publishing: boolean;
  /** Le bento est déjà en ligne. */
  published: boolean;
};

/**
 * Première case vide dans l'ordre de lecture de la boîte.
 *
 * `null` seulement si les six sont pleines, ce que l'appelant traite avant
 * d'arriver ici.
 */
export function firstEmptyCategory(filled: readonly CategoryKey[]): CategoryKey | null {
  const taken = new Set(filled);
  return CATEGORY_ORDER.find((c) => !taken.has(c)) ?? null;
}

export function composeCta({
  filled,
  hasPending,
  publishing,
  published,
}: ComposeCtaInput): ComposeCta {
  if (publishing) {
    return { kind: 'busy', label: 'Publication…', disabled: true };
  }

  const next = firstEmptyCategory(filled);
  if (next) {
    // Le bento vide garde son libellé d'accueil : griser un gros bouton au
    // centre de l'écran d'un nouvel arrivant était pire que de l'orienter.
    // C'est la même action dans les deux cas, seul le mot change.
    const remaining = CATEGORY_ORDER.length - filled.length;
    const label =
      filled.length === 0
        ? 'Commence par ton film'
        : `Compléter (${remaining} restant${remaining > 1 ? 's' : ''})`;
    return { kind: 'open-slot', label, disabled: false, category: next };
  }

  // Avant la modération : un bento déjà en ligne le reste, quoi qu'il arrive
  // ensuite à ses items. Lui proposer « en attente de validation » laisserait
  // croire qu'il est retiré, ce qui est faux.
  if (published) {
    return { kind: 'view-public', label: 'Voir mon bento public', disabled: false };
  }

  if (hasPending) {
    return { kind: 'blocked', label: 'En attente de validation', disabled: true };
  }

  return { kind: 'publish', label: 'Publier mon bento', disabled: false };
}
