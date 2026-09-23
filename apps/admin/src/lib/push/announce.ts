/**
 * Quelle édition annoncer, et jusqu'à quand. Chantier 17, D10 et D16.
 *
 * Une édition s'annonce une fois, dans les 24 heures qui suivent sa sortie :
 * une panne ne rattrape pas l'édition de la semaine précédente, et la mise en
 * service n'annonce pas les éditions déjà sorties.
 */

export const EDITION_ANNOUNCE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type AnnounceableEdition = {
  id: number;
  slug: string;
  title: string;
  released_at: string | null;
  announced_at: string | null;
};

export function isAnnounceable(edition: AnnounceableEdition, now: Date): boolean {
  if (edition.announced_at !== null || edition.released_at === null) return false;
  const released = Date.parse(edition.released_at);
  if (Number.isNaN(released)) return false;
  const age = now.getTime() - released;
  return age >= 0 && age < EDITION_ANNOUNCE_WINDOW_MS;
}

/**
 * La plus récente des éditions dues s'annonce ; les autres sont marquées sans
 * envoi. Deux éditions sorties le même jour ne font pas deux notifications.
 */
export function planAnnouncements(
  editions: AnnounceableEdition[],
  now: Date,
): { announce: AnnounceableEdition | null; skip: AnnounceableEdition[] } {
  const due = editions
    .filter((e) => isAnnounceable(e, now))
    .sort(
      (a, b) =>
        Date.parse(b.released_at as string) - Date.parse(a.released_at as string) || b.id - a.id,
    );
  const [announce = null, ...skip] = due;
  return { announce, skip };
}

/**
 * La durée de vie de l'annonce, en secondes : jusqu'à la fin de la fenêtre.
 * Un téléphone éteint jusqu'au samedi ne la reçoit pas en retard (D16).
 */
export function announcementTtlSeconds(releasedAt: string, now: Date): number {
  const end = Date.parse(releasedAt) + EDITION_ANNOUNCE_WINDOW_MS;
  return Math.max(60, Math.floor((end - now.getTime()) / 1000));
}
