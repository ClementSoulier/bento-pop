import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase/types';

/**
 * Ce que l'app dit d'elle-même à son profil.
 *
 * Trois valeurs, écrites une fois par lancement : la date de visite, la
 * plateforme et la version. Elles alimentent l'écran « Utilisateurs » du
 * back-office, qui n'avait jusqu'ici aucun moyen de savoir qui utilise
 * l'app, sur quoi, et depuis quand.
 *
 * **Pourquoi une écriture du client plutôt qu'une lecture côté serveur.**
 * `auth.users.last_sign_in_at` semblait suffire, il ne suffit pas : avec
 * l'anonymous sign-in la session est persistée et rafraîchie sans nouvelle
 * connexion. Mesuré sur les 106 comptes de production, l'écart médian entre
 * la création et cette « dernière connexion » est de 0,0 s, et aucun compte
 * ne dépasse une heure. C'est la date d'inscription, pas une date de visite.
 *
 * **Aucun import de `react-native` ni d'`expo-constants` ici.** Ce module
 * doit rester chargeable sous `node:test`, donc la lecture de `Platform.OS`
 * et de la version se fait chez l'appelant. Même raison et même forme que
 * `feed.ts` et `suggestions.ts`.
 */

export type TelemetryClient = SupabaseClient<Database>;

/** Plateformes acceptées par la contrainte SQL sur `users.platform`. */
export type Platform = 'ios' | 'android';

/** État courant de l'app, tel qu'il sera enregistré. */
export type AppSnapshot = {
  platform: Platform | null;
  appVersion: string | null;
};

/**
 * Normalise ce que l'app sait d'elle-même.
 *
 * `platform` est contraint à `ios | android` côté SQL. Le web sert au
 * développement et n'a rien à faire dans les statistiques du parc : il rend
 * `null` plutôt qu'une valeur que la contrainte refuserait, ce qui ferait
 * échouer l'écriture au lieu de simplement ne rien dire.
 *
 * Une version vide est ramenée à `null` : une chaîne vide en base se
 * distingue mal d'une version réelle dans une liste.
 */
export function describeApp(os: string, version: string | null | undefined): AppSnapshot {
  return {
    platform: os === 'ios' ? 'ios' : os === 'android' ? 'android' : null,
    appVersion: version && version.trim().length > 0 ? version.trim() : null,
  };
}

/**
 * Enregistre la visite courante sur le profil.
 *
 * **Ne lève jamais et ne bloque rien.** L'appelant ne l'attend pas. Une
 * télémétrie qui empêcherait l'app de démarrer, ou qui ferait remonter une
 * erreur à l'utilisateur, serait un très mauvais échange contre une colonne
 * d'écran d'administration.
 *
 * Une fois par lancement, et pas à chaque retour au premier plan : c'est la
 * granularité utile, et multiplier les écritures pour une précision dont
 * personne n'a besoin coûterait un aller-retour réseau à chaque fois.
 *
 * La policy `users_update_own` couvre déjà ce cas, aucune règle à ajouter :
 * l'app modifie sa propre ligne. Les trois colonnes lui sont accordées une à
 * une, et **la base ne les garde pas dans `users`**, lisible par tous : un
 * trigger les range dans `user_telemetry`, que seul le back-office lit, et les
 * remet à `null`. Cf. `20260915000000_close_privilege_gaps.sql`.
 *
 * Renvoie `true` si l'écriture a abouti, pour les tests. Personne en
 * production ne regarde ce retour.
 */
export async function recordVisit(
  client: TelemetryClient,
  userId: string,
  snapshot: AppSnapshot,
  now: () => Date = () => new Date(),
): Promise<boolean> {
  try {
    const { error } = await client
      .from('users')
      .update({
        last_seen_at: now().toISOString(),
        platform: snapshot.platform,
        app_version: snapshot.appVersion,
      })
      .eq('id', userId);
    return !error;
  } catch {
    // Silencieux par conception, cf. le bloc ci-dessus. `supabase-js` rend
    // ses erreurs dans `error`, mais une panne réseau peut aussi rejeter.
    return false;
  }
}
