/**
 * Dates relatives en français, pour l'étiquette d'identité du fil.
 *
 * Pourquoi pas `Intl.RelativeTimeFormat` : son support dépend de la variante
 * ICU embarquée dans le build Hermes, il diffère entre iOS et Android, et son
 * découpage par défaut n'est pas celui qu'on veut (« il y a 72 heures » là où
 * on attend « il y a 3 jours »). Vingt lignes testables exhaustivement rendent
 * le même texte partout.
 *
 * L'horloge est un paramètre et non `Date.now()` en dur : sans ça les tests
 * seraient datés.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

export function relativeDate(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  // Chaîne inexploitable : rien plutôt qu'un « il y a NaN jours ». L'appelant
  // omet la mention, l'étiquette reste lisible.
  if (Number.isNaN(then)) return '';

  const delta = now - then;

  // Couvre aussi les dates futures (horloge de l'appareil en avance, ou
  // décalage avec le serveur) : mieux vaut « à l'instant » que « il y a
  // -3 min », qui donne l'impression d'un bug.
  if (delta < MINUTE) return "à l'instant";
  if (delta < HOUR) return `il y a ${Math.floor(delta / MINUTE)} min`;
  if (delta < DAY) return `il y a ${Math.floor(delta / HOUR)} h`;

  // `hier` absorbe toute la tranche 24h-48h, donc « il y a 1 jour » est
  // volontairement inatteignable.
  if (delta < 2 * DAY) return 'hier';
  if (delta < WEEK) return `il y a ${Math.floor(delta / DAY)} jours`;

  if (delta < 5 * WEEK) {
    const weeks = Math.floor(delta / WEEK);
    return `il y a ${weeks} semaine${weeks > 1 ? 's' : ''}`;
  }

  const months = Math.floor(delta / MONTH);
  if (months < 12) return `il y a ${months} mois`;

  // Les années se dérivent des mois, et non d'un `delta / 365 jours`
  // indépendant : avec des mois de 30 jours, douze mois valent 360 jours, et
  // une division séparée par 365 rendrait « il y a 0 an » sur cette tranche.
  const years = Math.floor(months / 12);
  return `il y a ${years} an${years > 1 ? 's' : ''}`;
}
