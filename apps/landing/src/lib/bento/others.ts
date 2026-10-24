import { CATEGORY_META, isMainCaseKey } from '@bento-pop/supabase-mobile/bento';
import type { CategoryKey } from '@bento-pop/supabase-mobile/types';

/**
 * Les autres bentos d'un compte, chantier 21 (D2, D9) : leur ordre et leurs
 * titres, les mêmes que dans l'app, pour que la page web et l'écran disent la
 * même chose (`apps/mobile/src/lib/public-bento.ts`, `accountBentoTitle`).
 *
 * Fonctions pures, chargeables sous `node:test`.
 */

/** Ce qu'il faut d'un bento pour le ranger. */
export type OrderedBento = {
  readonly id: string;
  readonly is_primary: boolean;
  readonly published_at: string;
};

/**
 * Le principal d'abord, quand la page en montre un autre, puis du plus récent
 * au plus ancien, l'identifiant départageant comme dans le fil de l'app : la
 * liste sous la boîte, et la bande de liens qui la résume. Chaînes ISO :
 * l'ordre lexicographique est l'ordre chronologique.
 */
export function compareOthers(a: OrderedBento, b: OrderedBento): number {
  return (
    Number(b.is_primary) - Number(a.is_primary) ||
    b.published_at.localeCompare(a.published_at) ||
    (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
  );
}

/** Le titre d'un autre bento : son édition, « Bento principal », ou son adresse. */
export function otherBentoTitle(bento: {
  readonly editionTitle: string | null;
  readonly isPrimary: boolean;
  readonly slug: string;
}): string {
  if (bento.editionTitle) return bento.editionTitle;
  return bento.isPrimary ? 'Bento principal' : bento.slug;
}

/**
 * Le nom d'une case dans les crédits des images : sa catégorie pour une case
 * du bento principal, comme jusqu'ici ; le tampon d'une case d'édition, en
 * minuscules, qui n'avait pas de crédits du tout.
 */
export function creditLabel(meta: { readonly key: string; readonly stamp: string }): string {
  if (isMainCaseKey(meta.key)) return CATEGORY_META[meta.key as CategoryKey].label;
  const stamp = meta.stamp.toLocaleLowerCase('fr-FR');
  return stamp.charAt(0).toLocaleUpperCase('fr-FR') + stamp.slice(1);
}
