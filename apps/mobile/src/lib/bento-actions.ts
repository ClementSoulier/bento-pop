import { supabase } from '@/supabase/client';
import { queryClient } from '@/lib/query-client';
import { refreshPublicViews } from '@/lib/public-bento-query';
import { CATEGORY_IDS } from '@bento-pop/supabase-mobile/bento';
import type { CategoryKey } from '@/supabase/types';
import { useBento } from '@/state/bento';
import { useSession } from '@/state/session';
import type { OwnBento } from './own-bento';
import { mapRemoteSlots, type Slots } from './bento-slots';
import { publishItemsFromSlots } from './bento-actions-pure';

export type { OwnBento };


const OWN_BENTO_SELECT = 'id, slug, is_primary, published_at' as const;

function toOwnBento(row: {
  id: string;
  slug: string;
  is_primary: boolean;
  published_at: string | null;
}): OwnBento {
  return {
    id: row.id,
    slug: row.slug,
    isPrimary: row.is_primary,
    publishedAt: row.published_at,
  };
}

/**
 * Tous les bentos du compte, le principal en tête puis du plus ancien au plus
 * récent.
 *
 * Une **liste**, et c'est tout le changement. `ensureBento` demandait « le »
 * bento avec `maybeSingle()` : dès qu'un compte en a deux, PostgREST répond
 * 406, l'erreur n'était pas déstructurée, et la fonction enchaînait sur une
 * insertion. Six cases remplies faisaient six bentos.
 */
export async function listOwnBentos(userId: string): Promise<OwnBento[]> {
  const { data, error } = await supabase
    .from('bentos')
    .select(OWN_BENTO_SELECT)
    .eq('user_id', userId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Bento list failed: ${error.message}`);
  return (data ?? []).map(toOwnBento);
}

/**
 * Le bento principal du compte, créé s'il n'existe pas encore.
 *
 * Remplace `ensureBento`. Deux différences qui comptent :
 *
 * - la lecture est une liste, donc elle survit à un compte qui a plusieurs
 *   bentos, et elle rend celui qui porte `is_primary` ;
 * - l'insertion ne pose toujours que `user_id`, les droits colonne
 *   n'accordant rien d'autre. La base remplit `slug` et `is_primary` par
 *   défaut, ce qui fait du premier bento d'un compte son principal.
 *
 * Le repli sur `own[0]` couvre un cas qui ne devrait pas exister, un compte
 * dont aucun bento n'est principal : mieux vaut éditer le plus ancien que
 * d'en créer un de plus.
 */
export async function ensurePrimaryBento(userId: string): Promise<OwnBento> {
  const own = await listOwnBentos(userId);
  const principal = own.find((b) => b.isPrimary) ?? own[0];
  if (principal) return principal;

  const { data, error } = await supabase
    .from('bentos')
    .insert({ user_id: userId })
    .select(OWN_BENTO_SELECT)
    .single();
  if (error || !data) {
    throw new Error(`Bento create failed: ${error?.message ?? 'unknown'}`);
  }
  return toOwnBento(data);
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
 * Charge un bento nommé, cases et items joints, pour hydrater le store.
 *
 * Par identifiant et non par compte : c'est la différence avec
 * `loadOwnBento`, qui demandait « le » bento avec `maybeSingle()` et n'avait
 * aucun moyen de dire lequel.
 */
export async function loadBentoById(bentoId: string) {
  const { data, error } = await supabase
    .from('bentos')
    .select(
      `
      id,
      slug,
      is_primary,
      published_at,
      bento_items (
        category_id,
        item_id,
        items ( id, title, subtitle, image_url, external_source, external_id )
      )
      `,
    )
    .eq('id', bentoId)
    .maybeSingle();
  if (error) throw new Error(`Bento load failed: ${error.message}`);
  return data;
}

/**
 * Crée un bento secondaire à l'adresse donnée.
 *
 * Passe par `create_bento()`, seule voie d'écriture du slug côté client : les
 * droits colonne n'accordent que `user_id` à l'insertion. La fonction refuse
 * un slug mal formé, réservé, déjà pris, ou au-delà du plafond par compte, et
 * rend un message lisible plutôt qu'une violation de contrainte.
 */
export async function createSecondaryBento(slug: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_bento', { p_slug: slug });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Bento create failed');
  return data;
}

/**
 * L'identifiant du bento à écrire, pour les appelants qui ne le portent pas.
 *
 * Remplace `ensureBento(userId)` sur les trois chemins d'écriture : le
 * composer, le profil et la recherche. La différence tient en une phrase :
 * **on écrit dans le bento qu'on édite**, celui que le store garde, et on ne
 * redemande à la base que si le store n'en a pas encore, c'est-à-dire au tout
 * premier remplissage d'un compte neuf.
 */
export async function editableBentoId(userId: string): Promise<string | null> {
  // Pas encore de profil : le brouillon vit sur l'appareil jusqu'à la
  // publication, et `bentos.user_id` référence `users(id)`, donc il n'y a
  // simplement rien où écrire côté serveur. Chantier 9.
  if (!useSession.getState().profile) return null;

  const courant = useBento.getState().current;
  if (courant) return courant.id;

  const principal = await ensurePrimaryBento(userId);
  // Le store n'avait rien : on lui pose ce qu'on vient d'apprendre, pour que
  // l'écriture suivante n'ait pas à redemander.
  useBento.getState().setOwn([principal], principal.id);
  return principal.id;
}

/**
 * Change le bento qu'on édite, et charge ses cases.
 *
 * Le store pose le bento courant **avant** la lecture : le titre et le
 * sélecteur du composer basculent tout de suite, la grille suit. L'inverse
 * laisserait une grille de l'ancien bento sous le nom du nouveau.
 */
export async function switchBento(bentoId: string): Promise<void> {
  const store = useBento.getState();
  store.setOwn(store.own, bentoId);
  const data = await loadBentoById(bentoId);
  store.hydrate(mapRemoteSlots(data?.bento_items));
}

/**
 * Publie le premier bento d'un compte : profil, bento, cases et publication.
 *
 * Chantier 9. Tout passe par `publish_first_bento`, une fonction
 * `security definer`, et c'est une nécessité et non un confort : une suite
 * d'appels PostgREST laisserait un profil orphelin si les cases échouent, ou
 * des cases orphelines si la publication échoue. Ici, ou tout passe, ou rien.
 *
 * `slots` vient du brouillon gardé sur l'appareil, `termsAcceptedAt` de
 * l'écran des règles. La fonction refuse un bento incomplet, un pseudo pris
 * ou mal formé, et un compte qui a déjà un profil.
 */
export async function publishFirstBento(
  pseudo: string,
  termsAcceptedAt: string | null,
  slots: Slots,
): Promise<string> {
  const { data, error } = await supabase.rpc('publish_first_bento', {
    p_pseudo: pseudo,
    p_terms_accepted_at: termsAcceptedAt,
    p_items: publishItemsFromSlots(slots),
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('First publish failed');
  invalidatePublicViews();
  return data;
}
