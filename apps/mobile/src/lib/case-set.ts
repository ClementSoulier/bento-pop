import {
  CATEGORY_IDS,
  MAIN_CASES,
  type CaseMeta,
} from '@bento-pop/supabase-mobile/bento';
import type { CategoryKey } from '@/supabase/types';

/**
 * Les cases du bento qu'on édite, dans l'ordre de la boîte.
 *
 * ⚠️ **Ce module n'importe rien qui tire React Native**, client Supabase
 * compris : il est chargé par `bento-actions-pure.ts`, dont toute la raison
 * d'être est de rester testable sous `node:test`. Les lectures en base vivent
 * dans `editions.ts`, à côté.
 *
 * **Le bento principal et une édition ne se décrivent pas au même endroit.**
 * Les six cases du principal sont compilées dans l'app depuis toujours, et
 * doivent le rester : toute version déployée en dépend. Les cases d'une
 * édition n'existent pas à la compilation, elles viennent de la base. Ce
 * module rend les deux sous la même forme, pour que le composer n'ait pas à
 * savoir laquelle il édite.
 *
 * `id` est `bento_categories.id`, ce que `bento_items.category_id` référence :
 * c'est lui qui s'écrit, quand `key` est ce qui s'affiche et ce que la
 * recherche reçoit.
 */
export type CaseSet = CaseMeta & { readonly id: number };

/**
 * Les six cases du bento principal.
 *
 * Construites depuis les constantes de l'app, pas depuis la base : aucune
 * version déployée ne change d'affichage, et le parcours du bento principal
 * n'attend aucune requête de plus. `bento-cases-vs-app.test.ts` lie ces
 * valeurs à celles que la migration a posées en base.
 */
export const MAIN_CASE_SET: readonly CaseSet[] = MAIN_CASES.map((meta) => ({
  ...meta,
  id: CATEGORY_IDS[meta.key as CategoryKey],
}));

/**
 * Deux jeux de cases sont-ils les mêmes, cases et ordre compris ?
 *
 * Deux lectures d'une même édition rendent des objets différents : la
 * comparaison se fait sur ce qui s'écrit et s'affiche, l'identifiant et la
 * clé de chaque case.
 */
export function sameCaseSet(a: readonly CaseSet[], b: readonly CaseSet[]): boolean {
  return a.length === b.length && a.every((c, i) => c.id === b[i]?.id && c.key === b[i]?.key);
}

/** Correspondance identifiant vers clé, pour relire `bento_items`. */
export function caseKeyById(cases: readonly CaseSet[]): Map<number, string> {
  return new Map(cases.map((c) => [c.id, c.key]));
}

/** Correspondance clé vers identifiant, pour écrire `bento_items`. */
export function caseIdByKey(cases: readonly CaseSet[]): Map<string, number> {
  return new Map(cases.map((c) => [c.key, c.id]));
}
