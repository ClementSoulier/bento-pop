/**
 * Un bento du compte connecté, tel que l'app a besoin de le nommer.
 *
 * Dans son propre module pour que le store et les actions le partagent sans
 * se citer l'un l'autre : `state/bento.ts` garde la liste, `bento-actions.ts`
 * la lit et l'écrit, et aucun des deux n'a de raison d'importer l'autre.
 *
 * Chantier 16 : jusque-là, l'app ne portait aucun identifiant de bento hors
 * du temps d'une écriture. « Le » bento se redemandait à chaque fois, ce qui
 * n'a de sens que tant qu'un compte n'en a qu'un.
 */
export type OwnBento = {
  id: string;
  /** Adresse publique : `/u/<pseudo>/<slug>`. */
  slug: string;
  /** Le bento que `/u/<pseudo>` met en avant. Un seul par compte. */
  isPrimary: boolean;
  /**
   * L'édition que ce bento compose, ou `null` pour un bento libre.
   *
   * Chantier 13. C'est lui qui décide du jeu de cases à charger : les six
   * compilées dans l'app, ou celles de l'édition, lues en base.
   */
  editionId: number | null;
  publishedAt: string | null;
};
