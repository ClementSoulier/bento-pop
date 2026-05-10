const MONTHS = [
  'Janv',
  'Févr',
  'Mars',
  'Avr',
  'Mai',
  'Juin',
  'Juil',
  'Août',
  'Sept',
  'Oct',
  'Nov',
  'Déc',
] as const;

/**
 * Formate "YYYY-MM-DD" en triplet jour/mois abrégé/année (UTC pour éviter
 * les sauts de jour selon le fuseau).
 */
export function formatDateBlock(iso: string | null | undefined): {
  day: string;
  month: string;
  year: string;
} {
  if (!iso) return { day: '--', month: '???', year: '----' };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { day: '--', month: '???', year: '----' };
  return {
    day: String(date.getUTCDate()).padStart(2, '0'),
    month: MONTHS[date.getUTCMonth()] ?? '???',
    year: String(date.getUTCFullYear()),
  };
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n);
}
