

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
  | { kind: 'open-slot'; label: string; disabled: false; caseKey: string }
  /** Complet, mais une case attend la modération. */
  | { kind: 'blocked'; label: string; disabled: true }
  /**
   * Complet, une case attend, et la base publiera le bento à sa validation :
   * la marque est posée. Chantier 18, D1.
   */
  | { kind: 'awaiting-validation'; label: string; disabled: true }
  /**
   * Complet, une case attend, pas encore de profil : le pseudo et les CGU
   * d'abord, puis la base publiera à la validation. Chantier 18, D3.
   */
  | { kind: 'publish-on-validation'; label: string; disabled: false }
  /** Complet et publiable. */
  | { kind: 'publish'; label: string; disabled: false }
  /** Déjà en ligne : le bouton mène à la page publique, il ne republie pas. */
  | { kind: 'view-public'; label: string; disabled: false };

export type ComposeCtaInput = {
  /**
   * Les cases du bento édité, dans l'ordre de la boîte. Six pour le bento
   * principal, de deux à six pour une édition : c'est ce nombre qui décide
   * quand le bento est complet, et non plus un `CATEGORY_ORDER` en dur.
   */
  cases: readonly {
    readonly key: string;
    readonly prompt: string;
    readonly gender?: 'm' | 'f';
  }[];
  /**
   * Les intitulés sont-ils des noms communs ?
   *
   * Vrai pour le bento principal, « Film », « Série » : on dit alors « ton
   * film », « ta série ». Faux pour une édition, dont l'intitulé est une
   * question qui porte déjà son article : « le film qui t'a fait pleurer ».
   * Vrai par défaut, le cas historique.
   */
  nomsCommuns?: boolean;
  /** Clés des cases actuellement remplies. */
  filled: readonly string[];
  /** Au moins une case référence un item en attente de modération. */
  hasPending: boolean;
  /** Publication en cours. */
  publishing: boolean;
  /** Le bento est déjà en ligne. */
  published: boolean;
  /**
   * Le compte a un profil, donc un bento en base. Sans profil, on compose un
   * brouillon sur le téléphone (chantier 9) : rien ne peut le publier à sa
   * place avant le pseudo. Vrai par défaut, le cas historique.
   */
  hasProfile?: boolean;
  /**
   * La base a confirmé la marque « publié dès la validation » sur ce bento.
   * Tant qu'elle ne l'a pas fait, hors ligne par exemple, le bouton ne
   * promet rien. Chantier 18.
   */
  awaitingValidation?: boolean;
};

/**
 * Première case vide dans l'ordre de lecture de la boîte.
 *
 * `null` seulement si toutes sont pleines, ce que l'appelant traite avant
 * d'arriver ici.
 */
export function firstEmptyCase(
  cases: readonly { readonly key: string }[],
  filled: readonly string[],
): string | null {
  const taken = new Set(filled);
  return cases.find((c) => !taken.has(c.key))?.key ?? null;
}

export function composeCta({
  cases,
  nomsCommuns = true,
  filled,
  hasPending,
  publishing,
  published,
  hasProfile = true,
  awaitingValidation = false,
}: ComposeCtaInput): ComposeCta {
  if (publishing) {
    return { kind: 'busy', label: 'Publication…', disabled: true };
  }

  const next = firstEmptyCase(cases, filled);
  if (next) {
    // Le bento vide garde son libellé d'accueil : griser un gros bouton au
    // centre de l'écran d'un nouvel arrivant était pire que de l'orienter.
    // C'est la même action dans les deux cas, seul le mot change.
    //
    // Le libellé d'accueil nomme la première case au lieu de dire « ton
    // film » en dur : une édition ne commence pas forcément par un film, et
    // le mot en dur aurait envoyé sur une case qui n'existe pas.
    const remaining = cases.length - filled.length;
    // « Commence par ton film » pour un nom commun, avec l'article accordé ;
    // « Commence par le film qui t'a fait pleurer » pour une question, qui a
    // déjà le sien. La recette du chantier 13 a montré « Commence par film »,
    // une régression du lot 4 que le test avait été ajusté pour accepter.
    const tete = cases[0];
    const premiere = !tete
      ? 'ta première case'
      : nomsCommuns
        ? `${tete.gender === 'f' ? 'ta' : 'ton'} ${tete.prompt.toLowerCase()}`
        : tete.prompt.charAt(0).toLowerCase() + tete.prompt.slice(1);
    const label =
      filled.length === 0
        ? `Commence par ${premiere}`
        : `Compléter (${remaining} restant${remaining > 1 ? 's' : ''})`;
    return { kind: 'open-slot', label, disabled: false, caseKey: next };
  }

  // Avant la modération : un bento déjà en ligne le reste, quoi qu'il arrive
  // ensuite à ses items. Lui proposer « en attente de validation » laisserait
  // croire qu'il est retiré, ce qui est faux.
  if (published) {
    return { kind: 'view-public', label: 'Voir mon bento public', disabled: false };
  }

  // Chantier 18 : un item attend. Sans profil, le pseudo d'abord (D3) ; avec,
  // la base publiera à la validation, dès que la marque est posée (D1).
  if (hasPending) {
    if (!hasProfile) {
      return { kind: 'publish-on-validation', label: 'Publier dès la validation', disabled: false };
    }
    if (awaitingValidation) {
      return { kind: 'awaiting-validation', label: 'Publication à la validation', disabled: true };
    }
    return { kind: 'blocked', label: 'En attente de validation', disabled: true };
  }

  return { kind: 'publish', label: 'Publier mon bento', disabled: false };
}
