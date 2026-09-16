import { useBento } from '@/state/bento';
import { useDraft } from '@/state/draft';

/**
 * Le brouillon de l'appareil redevient ce que le composer affiche.
 *
 * **Dans son propre module, et c'est une correction.** Il vivait avec le
 * miroir, qui a besoin de la session ; la session, elle, appelle cette
 * fonction quand elle apprend qu'il n'y a pas de profil. Metro l'a dit sans
 * détour : « Require cycle: draft-mirror -> session -> draft-mirror », et un
 * cycle d'imports peut laisser une valeur non initialisée selon l'ordre
 * d'évaluation. Ici ce module ne connaît que les deux stores, et personne
 * n'a plus de raison de boucler.
 *
 * `hydrate` respecte le verrou d'écriture en vol, donc une case en cours de
 * saisie n'est pas écrasée par une relecture du brouillon.
 */
export function hydrateFromDraft(): void {
  const brouillon = useDraft.getState();
  if (Object.keys(brouillon.slots).length > 0) {
    useBento.getState().hydrate(brouillon.slots);
    return;
  }
  useBento.getState().markHydrated();
}
