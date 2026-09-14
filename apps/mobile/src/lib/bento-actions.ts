import { supabase } from '@/supabase/client';
import { queryClient } from '@/lib/query-client';
import { refreshPublicViews } from '@/lib/public-bento-query';
import { CATEGORY_IDS } from '@bento-pop/supabase-mobile/bento';
import type { CategoryKey } from '@/supabase/types';


/**
 * S'assure que l'utilisateur a un bento (en crée un vide sinon).
 * Renvoie l'ID du bento.
 */
export async function ensureBento(userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('bentos')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('bentos')
    .insert({ user_id: userId })
    .select('id')
    .single();
  if (error || !created) {
    throw new Error(`Bento create failed: ${error?.message ?? 'unknown'}`);
  }
  return created.id;
}

/**
 * Affecte (ou remplace) l'item d'une case du bento. Upsert sur la PK
 * composite `(bento_id, category_id)`.
 */
export async function setBentoSlot(
  bentoId: string,
  category: CategoryKey,
  itemId: string,
): Promise<void> {
  const { error } = await supabase
    .from('bento_items')
    .upsert(
      {
        bento_id: bentoId,
        category_id: CATEGORY_IDS[category],
        item_id: itemId,
      },
      { onConflict: 'bento_id,category_id' },
    );
  if (error) {
    throw new Error(`Slot upsert failed: ${error.message}`);
  }
  invalidatePublicViews();
}

/**
 * Publie un bento. **Idempotent** : `published_at` n'est posé qu'à la
 * première publication.
 *
 * Le `.is('published_at', null)` n'est pas une précaution cosmétique. Le CTA
 * du composer reste « Publier mon bento » une fois le bento publié
 * (`compose.tsx`), donc cette fonction est rappelée à chaque nouveau tap.
 * Sans ce filtre, chaque tap remettait la date à `now()` : le fil « La
 * table », trié sur `published_at desc`, n'ordonnait plus les dernières
 * publications mais les derniers taps sur un bouton, et un bento de mai
 * pouvait réapparaître en tête.
 *
 * Un bento déjà publié produit donc zéro ligne affectée, sans erreur.
 * L'appelant n'a rien à distinguer : dans les deux cas le bento est public
 * à la sortie, ce qui est la seule chose qui l'intéresse.
 */
export async function publishBento(bentoId: string): Promise<void> {
  const { error } = await supabase
    .from('bentos')
    .update({ published_at: new Date().toISOString() })
    .eq('id', bentoId)
    .is('published_at', null);
  if (error) throw new Error(`Publish failed: ${error.message}`);
  invalidatePublicViews();
}

/**
 * Le fil a un `staleTime` d'une minute et un `gcTime` de trente : sans cette
 * invalidation, publier puis ouvrir « La table » ne montre pas son bento, et
 * le retirer ne l'en fait pas partir. Mesuré en recette le 13 septembre 2026 :
 * la base disait `published_at: null` pendant que le fil l'affichait encore.
 *
 * C'est aussi la seule chose qui rende la dépublication crédible. Du point de
 * vue de la personne qui vient de retirer son bento, le voir toujours en
 * ligne, c'est un geste qui n'a pas marché.
 *
 * Les pages publiques en cache sont remises à zéro dans le même geste, et pas
 * seulement invalidées : cf. `refreshPublicViews`. Appelée par toute mutation
 * qui change ce qu'un autre écran montre, pour qu'aucune n'en oublie la
 * moitié.
 */
function invalidatePublicViews(): void {
  refreshPublicViews(queryClient);
}

/**
 * Retire le bento du fil et de sa page publique.
 *
 * Aucune migration : `bentos_update_own` autorise déjà le propriétaire à
 * écrire sur sa ligne, et `bentos_read_published` masque le bento aux autres
 * dès que `published_at` est nul tout en le laissant visible à son auteur.
 *
 * Ne touche ni aux cases, ni à `is_featured`. Republier reposera une date
 * fraîche, puisque `publishBento` ne s'abstient que sur un bento déjà en
 * ligne : un bento qui revient repart en tête du fil, ce qui est le
 * comportement voulu. Il rentrerait invisible autrement, à sa place
 * historique.
 */
export async function unpublishBento(bentoId: string): Promise<void> {
  const { error } = await supabase
    .from('bentos')
    .update({ published_at: null })
    .eq('id', bentoId);
  if (error) throw new Error(`Unpublish failed: ${error.message}`);
  invalidatePublicViews();
}

/**
 * Supprime le compte de l'utilisateur (Apple guideline 5.1.1(v)).
 *
 * DELETE public.users → cascade automatique vers `bentos` puis
 * `bento_items` (configurés ON DELETE CASCADE dans la migration initiale).
 * L'utilisateur n'a plus aucune donnée publique liée.
 *
 * Note : `auth.users` reste orphelin (anonymous) mais sans aucune info
 * perso stockée dessus → conforme Apple. Le caller doit ensuite signOut
 * et reset les stores locaux pour repartir sur un état propre.
 */
export async function deleteOwnAccount(userId: string): Promise<void> {
  const { error } = await supabase.from('users').delete().eq('id', userId);
  if (error) throw new Error(`Account deletion failed: ${error.message}`);
  // Le bento supprimé ne doit survivre ni dans le fil ni sur sa page publique
  // en cache, sur l'appareil même où on vient de le supprimer.
  invalidatePublicViews();
}

/**
 * Vide une case du bento : supprime la ligne `bento_items` pour la
 * catégorie donnée. L'item lui-même reste dans le catalogue mutualisé.
 */
export async function clearBentoSlot(
  bentoId: string,
  category: CategoryKey,
): Promise<void> {
  const { error } = await supabase
    .from('bento_items')
    .delete()
    .eq('bento_id', bentoId)
    .eq('category_id', CATEGORY_IDS[category]);
  if (error) throw new Error(`Clear slot failed: ${error.message}`);
  invalidatePublicViews();
}

/**
 * Charge le bento de l'utilisateur (slots + items joints) pour hydrater le
 * store local au démarrage.
 */
export async function loadOwnBento(userId: string) {
  const { data, error } = await supabase
    .from('bentos')
    .select(
      `
      id,
      published_at,
      bento_items (
        category_id,
        item_id,
        items ( id, title, subtitle, image_url, external_source, external_id )
      )
      `,
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`Bento load failed: ${error.message}`);
  return data;
}
