import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/supabase/client';
import { withTimeout } from '@/lib/with-timeout';
import { compareVersions } from '@/lib/version';

export { compareVersions };

/**
 * Lecture de la config runtime de l'app (table publique `app_config`).
 *
 * Sert au boot et au retour foreground pour décider si l'app doit afficher
 * un écran maintenance / force update plutôt que l'UI normale. Lecture
 * publique : pas besoin d'auth (et c'est volontaire — l'utilisateur doit
 * voir la maintenance même si l'anonymous sign-in échoue).
 */

const FETCH_TIMEOUT_MS = 4000;

export type AppConfig = {
  maintenanceMode: boolean;
  maintenanceTitle: string;
  maintenanceMessage: string;
  iosMinVersion: string;
  iosLatestVersion: string;
  androidMinVersion: string | null;
  androidLatestVersion: string | null;
};

/**
 * Verdict BLOQUANT. Chacune de ces valeurs (hors 'ok') remplace toute l'app
 * par un écran sans navigation. L'invitation douce à mettre à jour n'est
 * volontairement PAS ici : elle cohabite avec l'app, elle ne la remplace pas.
 * Cf. `deriveLatestVersion` et `state/app-status.ts`.
 */
export type AppStatus = 'ok' | 'maintenance' | 'force_update';

/**
 * Récupère la config depuis Supabase avec timeout. En cas d'échec
 * (réseau, downtime, RLS), renvoie `null` → l'appelant décide de
 * laisser passer (fail-open).
 *
 * Le PostgrestBuilder est thenable mais pas un vrai `Promise` selon TS, on
 * encapsule dans une fonction async pour rentrer dans la signature de
 * `withTimeout`.
 */
export async function fetchAppConfig(): Promise<AppConfig | null> {
  const fetcher = async () =>
    supabase
      .from('app_config')
      .select(
        'maintenance_mode, maintenance_title, maintenance_message, ios_min_version, ios_latest_version, android_min_version, android_latest_version',
      )
      .eq('id', 1)
      .maybeSingle();

  const result = await withTimeout(fetcher(), FETCH_TIMEOUT_MS, null);
  if (!result || result.error || !result.data) return null;

  const r = result.data;
  return {
    maintenanceMode: r.maintenance_mode,
    maintenanceTitle: r.maintenance_title,
    maintenanceMessage: r.maintenance_message,
    iosMinVersion: r.ios_min_version,
    iosLatestVersion: r.ios_latest_version,
    androidMinVersion: r.android_min_version,
    androidLatestVersion: r.android_latest_version,
  };
}

/**
 * Version courante de l'app (depuis app.config.ts → expo.version).
 * Si absente (cas dev très tordu), on renvoie '0.0.0' → toute borne
 * min > 0.0.0 déclenchera le force update, ce qui est le comportement
 * conservateur souhaité.
 */
export function getCurrentAppVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

/**
 * Combine config + version + plateforme pour produire le verdict final.
 * `null` config → 'ok' (fail-open).
 */
export function deriveAppStatus(config: AppConfig | null): AppStatus {
  if (!config) return 'ok';
  if (config.maintenanceMode) return 'maintenance';

  const minVersion = Platform.OS === 'ios'
    ? config.iosMinVersion
    : config.androidMinVersion;
  if (!minVersion) return 'ok';

  const current = getCurrentAppVersion();
  return compareVersions(current, minVersion) < 0 ? 'force_update' : 'ok';
}

/**
 * Version la plus récente publiée sur le store de la plateforme courante.
 * `null` quand le back-office ne l'a pas renseignée, ce qui est le cas
 * d'Android en production aujourd'hui.
 */
export function deriveLatestVersion(config: AppConfig | null): string | null {
  if (!config) return null;
  return Platform.OS === 'ios' ? config.iosLatestVersion : config.androidLatestVersion;
}
