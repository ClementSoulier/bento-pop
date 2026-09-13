import * as Updates from 'expo-updates';
import { runStartupUpdate, type OtaOutcome, type OtaPhase } from '@/lib/ota';

/**
 * Le seul endroit qui touche `expo-updates`. Aucune décision ici : toute la
 * logique et tous ses cas d'échec sont dans `ota.ts`, qui est testé.
 */

/**
 * Plafond de la vérification. Court exprès : le boot dure déjà 500 ms à 2 s
 * (polices, session anonyme, app_config), donc la vérification se cache
 * derrière un temps déjà payé. Au delà, on cesse de l'attendre et l'app
 * démarre ; `expo-updates` finira en arrière-plan et appliquera au prochain
 * démarrage à froid, ce qui est le comportement d'avant ce code.
 *
 * C'est aussi pourquoi on ne passe pas par `fallbackToCacheTimeout` dans
 * `app.json` : ce réglage impose l'attente à tous les démarrages sans
 * distinguer « je vérifie » de « je télécharge ».
 */
const CHECK_TIMEOUT_MS = 1500;

/** Plus long : on a déjà annoncé la mise à jour à l'utilisateur. */
const FETCH_TIMEOUT_MS = 8000;

export function runStartupUpdateWithExpo(
  onPhase: (phase: OtaPhase) => void,
): Promise<OtaOutcome> {
  return runStartupUpdate(
    {
      // `isEnabled` est faux en développement et dans Expo Go. La garde
      // `__DEV__` est redondante et c'est très bien : elle rend l'intention
      // lisible sans dépendre du comportement d'un module natif.
      enabled: !__DEV__ && Updates.isEnabled,
      check: () => Updates.checkForUpdateAsync(),
      fetchUpdate: () => Updates.fetchUpdateAsync(),
      reload: () => Updates.reloadAsync(),
      onPhase,
    },
    { check: CHECK_TIMEOUT_MS, fetch: FETCH_TIMEOUT_MS },
  );
}
