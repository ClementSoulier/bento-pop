import { supabase } from '@/supabase/client';
import { MAIN_CASE_SET, type CaseSet } from './case-set';
import type { OwnBento } from './own-bento';

/**
 * Lire les éditions et leurs cases.
 *
 * Séparé de `case-set.ts`, qui doit rester chargeable sous `node:test` :
 * importer le client Supabase y ferait entrer React Native, et
 * `bento-actions-pure.ts` ne se testerait plus.
 */

/**
 * Les cases d'une édition, lues en base.
 *
 * La RLS ne rend que les cases des éditions **sorties** : une édition
 * programmée est annoncée sans être dévoilée, et c'est la base qui le
 * garantit, pas l'écran. Une liste vide veut donc dire « pas encore sortie »
 * autant que « pas encore décrite », et l'appelant traite les deux pareil :
 * il n'y a rien à composer.
 */
export async function loadEditionCases(editionId: number): Promise<CaseSet[]> {
  const { data, error } = await supabase
    .from('bento_categories')
    .select('id, key, prompt, stamp, gender, display_order')
    .eq('edition_id', editionId)
    .eq('is_active', true)
    .order('display_order');

  if (error) throw new Error(`Edition cases failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id as number,
    key: row.key as string,
    prompt: row.prompt as string,
    stamp: row.stamp as string,
    gender: (row.gender as 'm' | 'f') ?? 'm',
  }));
}

/** Une édition telle que l'app la nomme. */
export type Edition = {
  id: number;
  slug: string;
  title: string;
  /** Toujours passée : la RLS ne rend que les éditions sorties. */
  releasedAt: string;
};

/**
 * Les éditions sorties, de la plus récente à la plus ancienne.
 *
 * Aucun filtre de date ici : la policy `editions_read_released` s'en charge,
 * et la refaire côté client laisserait croire que c'est l'app qui décide.
 */
export async function loadReleasedEditions(): Promise<Edition[]> {
  const { data, error } = await supabase
    .from('editions')
    .select('id, slug, title, released_at')
    .order('released_at', { ascending: false });

  if (error) throw new Error(`Editions failed: ${error.message}`);
  return (data ?? [])
    .filter((row) => row.released_at !== null)
    .map((row) => ({
      id: row.id as number,
      slug: row.slug as string,
      title: row.title as string,
      releasedAt: row.released_at as string,
    }));
}

/**
 * Crée le bento d'une édition pour le compte connecté, et rend son
 * identifiant.
 *
 * Passe par la fonction `security definer` : les droits colonne n'accordent
 * au client ni `slug`, ni `is_primary`, ni `edition_id`. Elle refuse une
 * édition non sortie et un doublon.
 */
export async function createEditionBento(editionId: number): Promise<string> {
  const { data, error } = await supabase.rpc('create_edition_bento', {
    p_edition: editionId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Le jeu de cases d'un bento : les six du principal, ou celles de son
 * édition.
 *
 * ⚠️ Ici et pas dans `bento-actions.ts`, qui importe la session : la session
 * en a besoin à l'hydratation, et l'y laisser formait le cycle
 * `session → bento-actions → session`. Metro l'a signalé à la recette du
 * chantier 13, le typage et les tests non.
 *
 * Un bento d'édition dont les cases ne se lisent pas, parce que l'édition a
 * été dépubliée entre-temps, retombe sur un jeu vide plutôt que sur les six
 * du principal : mieux vaut une boîte qu'on ne peut pas composer qu'une boîte
 * qui écrirait dans les cases du bento principal.
 */
export async function caseSetFor(bento: OwnBento | null): Promise<readonly CaseSet[]> {
  if (!bento?.editionId) return MAIN_CASE_SET;
  return loadEditionCases(bento.editionId);
}
