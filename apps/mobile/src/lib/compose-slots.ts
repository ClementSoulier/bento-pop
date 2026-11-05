/**
 * Le pont entre les cases du store et le plateau du design (chantier 32), et ce
 * qui décide d'une célébration. Aucun import de `react-native` : les tests lisent
 * ce module sous `node:test`.
 */
import { isMainCaseKey } from '@bento-pop/supabase-mobile/bento';
import type { TileData } from '@/components/bento/Tile';
import type { BentoSlot } from '@/design/bento/Bento';
import { caseCategory } from '@/design/bento/categories';
import type { CaseSet } from './case-set';
import { firstEmptyCase } from './compose-cta';
import { cleanTitle } from './text';

type StoreSlots = Partial<Record<string, TileData>>;

/**
 * Les cases du bento édité, telles que le plateau les dessine : la catégorie de
 * chacune (D5), sa question sur une édition (D2), et la première case vide, celle
 * à remplir maintenant.
 */
export function composerSlots(cases: readonly CaseSet[], slots: StoreSlots): BentoSlot[] {
  const next = firstEmptyCase(cases, Object.keys(slots));
  return cases.map((meta) => {
    const tile = slots[meta.key];
    return {
      key: meta.key,
      category: caseCategory(meta),
      label: meta.prompt,
      question: !isMainCaseKey(meta.key),
      stamp: meta.stamp,
      next: meta.key === next,
      item: tile
        ? {
            title: cleanTitle(tile.title),
            subtitle: tile.subtitle,
            credit: tile.imageCredit,
            imageUrl: tile.imageUrl,
            pending: tile.pending,
          }
        : null,
    };
  });
}

/**
 * Remplir cette case complète-t-il le bento ? À demander avant de la poser. Une
 * case déjà remplie qu'on remplace ne célèbre rien : le bento l'était déjà (D13).
 */
export function fillsBento(
  cases: readonly { readonly key: string }[],
  slots: StoreSlots,
  caseKey: string,
): boolean {
  if (slots[caseKey]) return false;
  return cases.every((meta) => meta.key === caseKey || Boolean(slots[meta.key]));
}
