/**
 * La publication à la validation, côté app. Chantier 18.
 *
 * Un bento complet dont un item attend la modération sort tout seul à la
 * validation de cet item (D1). C'est la base qui publie ; l'app, elle, pose
 * la marque qui l'y autorise, et le dit sous la boîte. Les versions publiées
 * ne marquent rien, et leurs bentos gardent le comportement d'avant (D5).
 *
 * N'importe RIEN, donc chargeable sous `node:test`.
 */

export type MarkInput = {
  /** Un profil, donc un bento en base. Sans lui, le brouillon est local. */
  hasProfile: boolean;
  /** La première lecture du bento a répondu. */
  hydrated: boolean;
  /** Écritures de cases pas encore confirmées. */
  pendingWrites: number;
  published: boolean;
  /** La base porte déjà la marque. */
  marked: boolean;
  complete: boolean;
  hasPending: boolean;
};

/**
 * Faut-il poser la marque ? Seulement sur ce que la base sait : pas avant la
 * première lecture, ni pendant une écriture en vol, où la case qui attend
 * n'y est peut-être pas encore. La base revérifie tout de toute façon
 * (`mark_publish_on_validation`), ceci évite seulement des appels inutiles.
 */
export function shouldMarkForValidation(input: MarkInput): boolean {
  return (
    input.hasProfile &&
    input.hydrated &&
    input.pendingWrites === 0 &&
    !input.published &&
    !input.marked &&
    input.complete &&
    input.hasPending
  );
}

/**
 * La marque que garde le téléphone ne tient plus : la base l'a levée, ou le
 * fera à la prochaine lecture. Même règle qu'en base (D2) : elle tombe quand
 * le bento est publié, incomplet, ou que plus rien n'y attend.
 *
 * Sans elle, un auteur qui remplace l'item en attente, puis en propose un
 * autre, verrait « Publication à la validation » sur un bento que personne
 * n'a remarqué, et que la base ne publierait donc jamais.
 */
export function markNoLongerHolds(input: {
  marked: boolean;
  published: boolean;
  complete: boolean;
  hasPending: boolean;
}): boolean {
  return input.marked && (input.published || !input.complete || !input.hasPending);
}

/**
 * La fin de la ligne sous la boîte, après « Bientôt en ligne » : ce qu'on
 * attend. Un seul item est nommé ; plusieurs sont comptés, une liste coupée
 * ne disant plus rien. Le titre vient en dernier : s'il est trop long pour
 * la ligne, c'est lui qui se coupe, pas la phrase.
 */
export function validationHint(pendingTitles: readonly string[]): string {
  if (pendingTitles.length > 1) return `à la validation de tes ${pendingTitles.length} items`;
  const title = pendingTitles[0]?.trim();
  return title ? `à la validation de « ${title} »` : 'à la validation de ton item';
}
