import type { PublicBento, PublicBentoResult } from './public-bento';

/**
 * Ce que montre la page bento publique, décidé en un seul endroit.
 *
 * Pur : les états se testent sans écran, en particulier celui qu'aucune
 * recette sur simulateur n'atteint sans créer de compte, sa propre page sans
 * bento en ligne.
 */
export type PublicPageState =
  | { kind: 'loading' }
  | { kind: 'found'; bento: PublicBento; isOwn: boolean }
  | { kind: 'not-found' }
  | { kind: 'nothing-online'; pseudo: string; isOwn: boolean }
  | { kind: 'unreachable' };

export type PublicPageInput = {
  /** Pseudo du profil connecté sur cet appareil, s'il y en a un. */
  ownPseudo: string | null | undefined;
  /** `data` de `useQuery` : `undefined` tant que rien n'est revenu. */
  data: PublicBentoResult | undefined;
  isError: boolean;
  isFetching: boolean;
  /** `useIsOffline()`, lu sur NetInfo. */
  isOffline: boolean;
};

/**
 * Règles, dans cet ordre :
 *
 * 1. une réponse, même périmée, l'emporte sur tout : un bento déjà vu reste
 *    affiché hors ligne, et un rafraîchissement raté ne l'efface pas ;
 * 2. sans réponse et hors ligne, « Connexion perdue » tout de suite, sans
 *    attendre qu'une requête échoue ;
 * 3. sans réponse, une requête en cours montre le squelette, y compris celle
 *    que « Réessayer » relance après une erreur ;
 * 4. sinon l'erreur, et en dernier recours le squelette.
 */
export function publicPageState(input: PublicPageInput): PublicPageState {
  const { data } = input;
  if (data === null) return { kind: 'not-found' };
  if (data !== undefined) {
    const isOwn = samePseudo(input.ownPseudo, data.pseudo);
    return data.bento
      ? { kind: 'found', bento: data.bento, isOwn }
      : { kind: 'nothing-online', pseudo: data.pseudo, isOwn };
  }
  if (input.isOffline) return { kind: 'unreachable' };
  if (input.isFetching) return { kind: 'loading' };
  return input.isError ? { kind: 'unreachable' } : { kind: 'loading' };
}

/** Les liens et les profils peuvent différer par la casse. */
function samePseudo(own: string | null | undefined, pseudo: string): boolean {
  return Boolean(own) && own!.toLowerCase() === pseudo.toLowerCase();
}
