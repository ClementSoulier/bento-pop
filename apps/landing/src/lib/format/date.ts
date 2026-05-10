/**
 * Formate une date ISO en triplet "jour / mois abrégé / année" pour l'agenda.
 * Ex: "2026-07-03" → { day: '03', month: 'Juil', year: '2026' }
 */
export function formatAgendaDate(iso: string): { day: string; month: string; year: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { day: '--', month: '???', year: '----' };
  }
  const day = String(date.getUTCDate()).padStart(2, '0');
  const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });
  const rawMonth = monthFormatter.format(date).replace('.', '');
  const month = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1);
  const year = String(date.getUTCFullYear());
  return { day, month, year };
}
