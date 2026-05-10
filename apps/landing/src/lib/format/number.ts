/**
 * Formate un nombre en notation française avec espaces fines insécables.
 * Ex: 1234 → "1 234"
 */
export function formatVoteCount(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n);
}
