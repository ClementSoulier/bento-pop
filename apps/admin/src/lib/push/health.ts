/**
 * Le contrôle de santé des notifications, lu par la carte du tableau de bord
 * (D19). Chantier 17, §6.2 : le back-office se redéploie à la main, et une
 * chaîne qui cesse de tourner ne se verrait pas sans lui.
 */

/** Le battement passe toutes les 5 minutes ; trois manqués, c'est une panne. */
export const TICK_LATE_AFTER_MS = 15 * 60 * 1000;
/** Une erreur plus ancienne ne s'affiche plus. */
export const HEALTH_ERROR_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type TickState = 'never' | 'ok' | 'late';

export function tickState(lastTickAt: string | null, now: Date): TickState {
  if (!lastTickAt) return 'never';
  const at = Date.parse(lastTickAt);
  if (Number.isNaN(at)) return 'never';
  return now.getTime() - at <= TICK_LATE_AFTER_MS ? 'ok' : 'late';
}

/** « à l'instant », « il y a 3 min », « il y a 2 h », « il y a 4 j ». */
export function formatAgo(iso: string, now: Date): string {
  const elapsed = Math.max(0, now.getTime() - Date.parse(iso));
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

/**
 * L'heure de Paris, quel que soit le fuseau du serveur : le conteneur du
 * back-office tourne en UTC.
 */
export function formatParis(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** La dernière erreur, si elle a moins de 7 jours. */
export function recentError(
  lastErrorAt: string | null,
  lastError: string | null,
  now: Date,
): { at: string; message: string } | null {
  if (!lastErrorAt || !lastError) return null;
  const at = Date.parse(lastErrorAt);
  if (Number.isNaN(at) || now.getTime() - at > HEALTH_ERROR_WINDOW_MS) return null;
  return { at: lastErrorAt, message: lastError };
}
