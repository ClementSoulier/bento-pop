/**
 * Comparaison de versions et décision d'inviter à mettre à jour.
 *
 * Ce fichier n'importe RIEN, volontairement. C'est le cœur logique des deux
 * mécanismes de mise à jour, et un module qui importe `react-native` ou
 * `expo-constants` ne se charge pas sous `node:test`. Toute la partie qui
 * dépend de la plateforme reste dans `app-config.ts`.
 */

/**
 * Compare deux versions "X.Y.Z". Retourne -1 si a<b, 0 si égales, 1 si a>b.
 * Les segments manquants comptent comme 0. Suffixes non supportés (suffit
 * pour les versions Expo en production).
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = a.split('.').map((s) => Number.parseInt(s, 10) || 0);
  const pb = b.split('.').map((s) => Number.parseInt(s, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

/**
 * Y a-t-il une version plus récente que celle installée ?
 *
 * `latest` absent → non. Le champ Android vaut `null` en production, il ne
 * doit surtout pas produire de faux positif.
 *
 * `latest` strictement inférieur → non, évidemment ; mais aussi `latest`
 * égal, et c'est le cas qui compte : quelqu'un qui tourne sur une build
 * interne en avance sur le store ne doit pas être invité à « revenir en
 * arrière ».
 */
export function isUpdateAvailable(current: string, latest: string | null | undefined): boolean {
  if (!latest) return false;
  return compareVersions(current, latest) < 0;
}

/**
 * Faut-il afficher l'invitation ?
 *
 * Comme `isUpdateAvailable`, mais en tenant compte du refus mémorisé. Le
 * refus porte sur UNE version : une `latest` plus récente que celle qui a
 * été refusée rejoue l'invitation, sans code d'expiration.
 */
export function shouldOfferUpdate(
  current: string,
  latest: string | null | undefined,
  dismissed: string | null,
): boolean {
  if (!isUpdateAvailable(current, latest)) return false;
  return latest !== dismissed;
}
