import { useBento } from '@/state/bento';
import { useDraft } from '@/state/draft';
import { useSession } from '@/state/session';

/**
 * Tant qu'il n'y a pas de profil, les cases composées vont aussi sur
 * l'appareil.
 *
 * Un seul endroit plutôt qu'un appel à chaque mutation. Le composer, la
 * recherche et l'annulation d'un toast écrivent tous dans `useBento` ; leur
 * demander à chacun de penser au brouillon, c'est s'assurer qu'un chemin
 * l'oubliera, et un brouillon perdu ne lève aucune erreur, il disparaît
 * simplement au prochain démarrage.
 *
 * Dès qu'un profil existe, le miroir se tait : les cases ont alors leur place
 * en base, et le brouillon a été vidé par la publication.
 */
export function startDraftMirror(): () => void {
  return useBento.subscribe((state) => {
    if (useSession.getState().profile) return;
    useDraft.getState().setSlot(state.slots);
  });
}

/**
 * Le chemin inverse, au démarrage : ce que l'appareil a gardé redevient ce que
 * le composer affiche.
 *
 * Appelé quand la lecture du profil a répondu qu'il n'y en a pas. `hydrate`
 * respecte le verrou d'écriture en vol, donc une case en cours de saisie n'est
 * pas écrasée par une relecture du brouillon.
 */
export function hydrateFromDraft(): void {
  const brouillon = useDraft.getState();
  if (Object.keys(brouillon.slots).length > 0) {
    useBento.getState().hydrate(brouillon.slots);
    return;
  }
  useBento.getState().markHydrated();
}

/**
 * Branche les deux sens, une fois, au démarrage.
 *
 * La relecture du brouillon est asynchrone : au moment où la lecture du profil
 * répond « pas de profil », l'appareil n'a peut-être pas encore rendu ses
 * cases. On hydrate donc aussi quand la relecture se termine, si le compte n'a
 * toujours pas de profil. Sans cela, quelqu'un qui rouvre l'app sur un
 * brouillon de trois cases voit une boîte vide, ce qui est la pire des
 * réponses : il croira avoir tout perdu.
 */
export function startDraft(): () => void {
  const stopMirror = startDraftMirror();
  const stopWatch = useDraft.subscribe((state, previous) => {
    if (state.hydrated && !previous.hydrated && !useSession.getState().profile) {
      hydrateFromDraft();
    }
  });
  if (useDraft.getState().hydrated && !useSession.getState().profile) hydrateFromDraft();
  return () => {
    stopMirror();
    stopWatch();
  };
}
