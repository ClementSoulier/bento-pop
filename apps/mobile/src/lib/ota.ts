/**
 * Séquence de mise à jour à distance au lancement.
 *
 * Comme `version.ts`, ce fichier n'importe RIEN : `expo-updates` est un
 * module natif, intestable sous `node:test`. Les trois appels sont injectés,
 * le câblage réel tient dans `ota-runtime.ts` et ne contient aucune décision.
 *
 * Principe directeur, valable à chaque ligne : **le chemin d'échec laisse
 * démarrer**. Une vérification qui traîne, un téléchargement qui casse, un
 * rechargement refusé, tout cela doit produire une app qui s'ouvre
 * normalement sur le bundle qu'elle a déjà. La promesse réelle continue en
 * arrière-plan et `expo-updates` appliquera au prochain démarrage à froid,
 * ce qui est exactement le comportement d'avant ce fichier.
 */

/** Phases visibles. `checking` retient le boot sans rien afficher de neuf. */
export type OtaPhase = 'checking' | 'downloading';

export type OtaOutcome =
  /** Désactivé (développement, ou `Updates.isEnabled` faux). */
  | 'skipped'
  /** Rien à installer, ou rien de neuf après téléchargement. */
  | 'none'
  /** Une étape a dépassé son plafond. */
  | 'timeout'
  /** Une étape a levé. */
  | 'failed'
  /** `reloadAsync` est parti : l'app redémarre, plus rien à faire ici. */
  | 'reloading';

export type OtaDeps = {
  enabled: boolean;
  check: () => Promise<{ isAvailable: boolean }>;
  fetchUpdate: () => Promise<{ isNew: boolean }>;
  reload: () => Promise<void>;
  onPhase: (phase: OtaPhase) => void;
};

export type OtaTimeouts = {
  /** Plafond de la vérification. Court : il se cache derrière le boot. */
  check: number;
  /** Plafond du téléchargement. Plus long : on a déjà engagé l'utilisateur. */
  fetch: number;
};

type Settled<T> = { ok: true; value: T } | { ok: false; reason: 'timeout' | 'failed' };

/**
 * Comme `withTimeout`, mais distingue le dépassement de l'erreur. On a
 * besoin de la différence pour le journal : un plafond atteint est banal sur
 * réseau lent, une exception veut dire qu'il y a autre chose à regarder.
 *
 * Le retard n'annule pas la promesse sous-jacente, et c'est voulu :
 * `fetchUpdateAsync` continue son téléchargement, qui servira au prochain
 * démarrage.
 */
function settle<T>(p: Promise<T>, ms: number): Promise<Settled<T>> {
  return new Promise<Settled<T>>((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      resolve({ ok: false, reason: 'timeout' });
    }, ms);
    p.then(
      (value) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve({ ok: true, value });
      },
      () => {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve({ ok: false, reason: 'failed' });
      },
    );
  });
}

/** Absorbe aussi les fonctions qui lèvent de façon synchrone. */
function call<T>(fn: () => Promise<T>): Promise<T> {
  return Promise.resolve().then(fn);
}

/**
 * Vérifie, télécharge, recharge. Ne lève jamais.
 *
 * La résolution de la promesse signifie « le boot peut continuer », que la
 * mise à jour ait abouti ou non. Le seul cas où l'appelant ne reprend pas la
 * main est `reloading`, où l'app redémarre sous ses pieds.
 */
export async function runStartupUpdate(
  deps: OtaDeps,
  timeouts: OtaTimeouts,
): Promise<OtaOutcome> {
  if (!deps.enabled) return 'skipped';

  deps.onPhase('checking');
  const checked = await settle(call(deps.check), timeouts.check);
  if (!checked.ok) return checked.reason;
  if (!checked.value?.isAvailable) return 'none';

  // À partir d'ici seulement, l'utilisateur voit qu'il se passe quelque
  // chose. Annoncer une mise à jour pendant la vérification montrerait un
  // écran qui n'aboutit à rien la plupart des lancements.
  deps.onPhase('downloading');
  const fetched = await settle(call(deps.fetchUpdate), timeouts.fetch);
  // Le cas qui compte de tout ce fichier : un téléchargement qui dépasse son
  // plafond ou qui casse ne doit JAMAIS mener au rechargement. Recharger sur
  // un bundle incomplet, c'est une app morte sans recours par le même canal.
  if (!fetched.ok) return fetched.reason;
  if (!fetched.value?.isNew) return 'none';

  try {
    await deps.reload();
  } catch {
    return 'failed';
  }
  return 'reloading';
}
