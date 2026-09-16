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
  /**
   * Le titre de cette édition, ou `null`.
   *
   * `null` pour un bento libre, et aussi pour une édition que la RLS ne rend
   * plus, dépubliée depuis : le bento reste à son auteur, son nom retombe
   * alors sur le slug.
   */
  editionTitle: string | null;
  publishedAt: string | null;
};

/**
 * Ce que PostgREST rend pour un bento du compte, jointure d'édition comprise.
 *
 * `editions` absent ou `null` se lisent pareil : une lecture qui ne joint pas
 * l'édition ne doit pas inventer de titre.
 */
export type OwnBentoRow = {
  id: string;
  slug: string;
  is_primary: boolean;
  edition_id: number | null;
  published_at: string | null;
  editions?: { title: string } | null;
};

/** Les colonnes que `toOwnBento` lit, dans la syntaxe de `select()`. */
export const OWN_BENTO_COLUMNS = 'id, slug, is_primary, edition_id, published_at, editions ( title )';

export function toOwnBento(row: OwnBentoRow): OwnBento {
  return {
    id: row.id,
    slug: row.slug,
    isPrimary: row.is_primary,
    editionId: row.edition_id,
    editionTitle: row.editions?.title ?? null,
    publishedAt: row.published_at,
  };
}

/**
 * Le nom d'un bento, tel qu'on le montre à son auteur.
 *
 * « Mon bento » pour le principal. Le titre de l'édition pour un bento
 * d'édition : la recette du 16 septembre affichait « REC-DEUX » en tête du
 * composer, un slug là où l'équipe a écrit un titre. Le slug pour un bento
 * libre, seule chose qu'il porte.
 */
export function bentoName(bento: Pick<OwnBento, 'isPrimary' | 'slug' | 'editionTitle'>): string {
  if (bento.isPrimary) return 'Mon bento';
  return bento.editionTitle ?? bento.slug;
}
