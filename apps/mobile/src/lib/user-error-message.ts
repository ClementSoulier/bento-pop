/**
 * Ce qu'un échec dit à l'utilisateur.
 *
 * Six `Alert` de l'app affichaient `error.message`, et le bandeau d'erreur de la
 * modale de recherche aussi. Or `bento-actions.ts` et `items.ts` lèvent des
 * chaînes techniques, en partie anglaises : « Unpublish failed: … », « Account
 * deletion failed: … », « Search failed: … ». Elles ne disent ni ce qui s'est
 * passé ni quoi faire, et elles ne sont pas écrites pour être lues.
 *
 * Une phrase par action, donc, et un cas à part : une panne réseau, qui se
 * reconnaît au message de `fetch` et qui appelle une autre conduite. Le détail
 * technique reste au journal, où il sert.
 *
 * Aucun import de `react-native` : testé sous `node:test`.
 */

export type FailedAction =
  | 'publish'
  | 'unpublish'
  | 'delete-account'
  | 'export'
  | 'report'
  | 'create-profile'
  | 'accept-terms'
  | 'search';

const MESSAGES: Record<FailedAction, string> = {
  publish: "La publication n'a pas marché. Réessaie.",
  unpublish: "Le retrait n'a pas marché. Réessaie.",
  'delete-account': "La suppression n'a pas abouti. Réessaie dans un instant.",
  export: "L'export n'a pas abouti. Réessaie dans un instant.",
  report: "Le signalement n'est pas parti. Réessaie.",
  'create-profile': "Le profil n'a pas pu être créé. Réessaie.",
  'accept-terms': "L'acceptation n'a pas pu être enregistrée. Réessaie.",
  search: "La recherche n'a pas abouti. Vérifie ta connexion.",
};

/**
 * Ce que `fetch` dit quand la requête n'est jamais partie.
 *
 * Les formulations diffèrent par plateforme, et se lisent dans le journal :
 * « fetch failed: UnexpectedException: The network connection was lost. » sur
 * iOS, relevé au chantier 11 relais coupé ; « Network request failed » sur
 * Android.
 */
const NETWORK =
  /network request failed|network connection was lost|fetch failed|failed to fetch|network error|timeout|timed out|abort|econnrefused|econnreset/i;

/** Le pseudo refusé par la base : un motif réservé, pas une panne. */
const FORBIDDEN_PSEUDO = /pseudo non autoris/i;

export function userErrorMessage(action: FailedAction, error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  if (action === 'create-profile' && FORBIDDEN_PSEUDO.test(raw)) {
    return "Ce pseudo n'est pas disponible. Choisis-en un autre.";
  }
  if (NETWORK.test(raw)) {
    return 'Pas de connexion. Réessaie quand tu es en ligne.';
  }
  return MESSAGES[action];
}
